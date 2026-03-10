import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from 'dotenv';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { v4 as uuidv4 } from 'uuid';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import type { ClientCapabilities } from '@modelcontextprotocol/sdk/types.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import {
  getUiCapability,
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from '@modelcontextprotocol/ext-apps/server';
import { SessionManager } from './utils/session.js';
import {
  EchoToolInputSchema,
  type EchoToolOutput,
  type WidgetDescriptor,
} from './types.js';

config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ASSETS_DIR = path.resolve(ROOT_DIR, 'assets');

const PORT = parseInt(process.env.PORT || '8080', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE || '3600000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const WIDGET_PORT = parseInt(process.env.WIDGET_PORT || '4444', 10);
const INLINE_WIDGET_ASSETS = process.env.INLINE_WIDGET_ASSETS === 'true';

const logger = pino({
  level: LOG_LEVEL,
  transport:
    NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

const ECHO_WIDGET: WidgetDescriptor = {
  id: 'echo',
  title: 'Echo',
  uri: 'ui://echo',
};

/**
 * Read widget HTML - from Vite dev server in development, from assets in production
 */
async function readWidgetHtml(widgetId: string): Promise<string> {
  if (NODE_ENV === 'development' && !INLINE_WIDGET_ASSETS) {
    try {
      const url = `http://localhost:${WIDGET_PORT}/${widgetId}.html`;
      logger.debug({ url }, 'Fetching widget HTML from Vite dev server');
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          {
            status: response.status,
            statusText: response.statusText,
            errorText,
            url,
          },
          'Vite dev server returned error'
        );
        throw new Error(`Failed to fetch widget HTML: ${response.statusText}`);
      }
      const html = await response.text();
      logger.debug(
        { url, htmlLength: html.length },
        'Successfully fetched widget HTML'
      );
      return html;
    } catch (err) {
      logger.warn(
        { err, widgetId, widgetPort: WIDGET_PORT },
        'Failed to fetch from Vite dev server, falling back to built assets'
      );
    }
  }

  if (!fs.existsSync(ASSETS_DIR)) {
    throw new Error(
      `Widget assets not found. Expected directory ${ASSETS_DIR}. Run "npm run build:widgets" before starting the server.`
    );
  }

  const htmlPath = path.join(ASSETS_DIR, `${widgetId}.html`);

  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Widget HTML not found: ${htmlPath}`);
  }

  return fs.readFileSync(htmlPath, 'utf-8');
}

function inlineWidgetAssets(html: string): string {
  let nextHtml = html;
  const scripts = Array.from(
    html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g)
  );
  for (const match of scripts) {
    const src = match[1];
    const filename = path.basename(src.split('?')[0]);
    const assetPath = path.join(ASSETS_DIR, filename);
    if (!fs.existsSync(assetPath)) {
      logger.warn({ assetPath }, 'Inline asset missing, leaving script tag as-is');
      continue;
    }
    const js = fs.readFileSync(assetPath, 'utf-8');
    const inlineTag = `<script type="module">\n${js}\n</script>`;
    nextHtml = nextHtml.replace(match[0], inlineTag);
  }

  const styles = Array.from(
    html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)
  );
  for (const match of styles) {
    const href = match[1];
    const filename = path.basename(href.split('?')[0]);
    const assetPath = path.join(ASSETS_DIR, filename);
    if (!fs.existsSync(assetPath)) {
      logger.warn({ assetPath }, 'Inline asset missing, leaving style tag as-is');
      continue;
    }
    const css = fs.readFileSync(assetPath, 'utf-8');
    const inlineTag = `<style>\n${css}\n</style>`;
    nextHtml = nextHtml.replace(match[0], inlineTag);
  }

  nextHtml = nextHtml
    .replace(/<link[^>]*rel="modulepreload"[^>]*>/g, '')
    .replace(/<link[^>]*rel="preload"[^>]*as="style"[^>]*>/g, '');

  return nextHtml;
}

/**
 * Create an MCP server instance with echo tool
 */
function createMcpServer(
  sessionId: string,
  clientCapabilities?: ClientCapabilities & { extensions?: Record<string, unknown> }
): McpServer {
  const server = new McpServer({
    name: 'mcp-app-template',
    version: '1.0.0',
  });

  const sessionLogger = logger.child({ sessionId });

  const resourceUri = ECHO_WIDGET.uri;
  const canRenderUiByCapability = Boolean(
    getUiCapability(clientCapabilities)?.mimeTypes?.includes(RESOURCE_MIME_TYPE)
  );

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const widgetId = resourceUri.replace('ui://', '');
      try {
        const html = await readWidgetHtml(widgetId);
        const devWidgetOrigin = `http://localhost:${WIDGET_PORT}`;
        const devWidgetOriginAlt = `http://127.0.0.1:${WIDGET_PORT}`;
        const devCspMeta =
          NODE_ENV === 'development' && !INLINE_WIDGET_ASSETS
            ? {
                ui: {
                  csp: {
                    resourceDomains: [devWidgetOrigin, devWidgetOriginAlt],
                    scriptDomains: [devWidgetOrigin, devWidgetOriginAlt],
                    styleDomains: [devWidgetOrigin, devWidgetOriginAlt],
                    connectDomains: [
                      devWidgetOrigin,
                      devWidgetOriginAlt,
                      devWidgetOrigin.replace('http://', 'ws://'),
                      devWidgetOriginAlt.replace('http://', 'ws://'),
                    ],
                  },
                },
              }
            : undefined;

        sessionLogger.info({ resourceUri, widgetId }, 'Widget resource loaded');

        const finalHtml = INLINE_WIDGET_ASSETS
          ? inlineWidgetAssets(html)
          : html;

        return {
          contents: [
            {
              uri: resourceUri,
              mimeType: RESOURCE_MIME_TYPE,
              text: finalHtml,
              _meta: devCspMeta,
            },
          ],
        };
      } catch (err) {
        sessionLogger.error(
          { err, resourceUri, widgetId },
          'Failed to load widget'
        );
        throw err;
      }
    }
  );

  registerAppTool(
    server,
    'echo',
    {
      title: 'Echo',
      description: "Echoes back the user's message in an interactive view",
      inputSchema: EchoToolInputSchema.shape,
      _meta: canRenderUiByCapability
        ? {
            ui: {
              resourceUri,
            },
          }
        : {},
    },
    async (args) => {
      sessionLogger.info(
        { toolName: 'echo', args, canRenderUiByCapability },
        'Tool invoked'
      );

      try {
        const result = EchoToolInputSchema.safeParse(args);

        if (!result.success) {
          sessionLogger.error(
            { err: result.error, toolName: 'echo' },
            'Validation failed'
          );
          return {
            content: [
              {
                type: 'text',
                text: `Error: ${result.error.issues.map((e) => e.message).join(', ')}`,
              },
            ],
            isError: true,
          };
        }

        const { message } = result.data;

        const output = {
          echoedMessage: message,
          timestamp: new Date().toISOString(),
        } satisfies EchoToolOutput;

        sessionLogger.info({ output }, 'Tool execution successful');

        if (!canRenderUiByCapability) {
          return {
            content: [
              {
                type: 'text',
                text: `Echoing: "${message}"`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `Echoing: "${message}"`,
            },
          ],
          structuredContent: output,
        };
      } catch (err) {
        sessionLogger.error({ err, toolName: 'echo' }, 'Tool execution failed');
        throw err;
      }
    }
  );

  return server;
}

/**
 * Main server setup
 */
async function main() {
  logger.info(
    {
      port: PORT,
      nodeEnv: NODE_ENV,
      logLevel: LOG_LEVEL,
      assetsDir: ASSETS_DIR,
    },
    'Starting MCP App Template server'
  );

  const app = express();

  app.use(pinoHttp({ logger }));

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    next();
  });

  app.use(express.json());

  app.use('/assets', express.static(ASSETS_DIR));

  const sessionManager = new SessionManager(logger);

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      sessions: sessionManager.count(),
      timestamp: new Date().toISOString(),
    });
  });

  app.all('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    logger.info({ method: req.method, sessionId, ip: req.ip }, 'MCP request');

    try {
      const session = sessionId ? sessionManager.get(sessionId) : undefined;

      if (
        !sessionId &&
        req.method === 'POST' &&
        isInitializeRequest(req.body)
      ) {
        logger.info('Initializing new session');

        const eventStore = new InMemoryEventStore();

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => uuidv4(),
          eventStore,
          onsessioninitialized: (newSessionId) => {
            logger.info({ sessionId: newSessionId }, 'Session initialized');
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            logger.info({ sessionId: sid }, 'Transport closed');
            sessionManager.delete(sid);
          }
        };

        const tempSessionId = 'initializing';
        const clientCapabilities = req.body.params.capabilities as
          | (ClientCapabilities & { extensions?: Record<string, unknown> })
          | undefined;
        const server = createMcpServer(tempSessionId, clientCapabilities);
        await server.connect(transport);

        await transport.handleRequest(req, res, req.body);

        const actualSessionId = transport.sessionId;
        if (actualSessionId) {
          sessionManager.create(actualSessionId, server, transport);
        }

        return;
      }

      if (session) {
        await session.transport.handleRequest(req, res, req.body);
        return;
      }

      logger.warn({ sessionId, method: req.method }, 'Invalid MCP request');
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
    } catch (err) {
      logger.error({ err, sessionId }, 'Error handling MCP request');
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });

  const cleanupInterval = setInterval(() => {
    sessionManager.cleanup(SESSION_MAX_AGE);
  }, 60000);

  const httpServer = createServer(app);

  const shutdown = async () => {
    logger.info('Shutting down server...');

    clearInterval(cleanupInterval);

    httpServer.close(() => {
      logger.info('HTTP server closed');
    });

    await sessionManager.closeAll();

    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  httpServer.listen(PORT, () => {
    logger.info(
      {
        port: PORT,
        mcpEndpoint: `http://localhost:${PORT}/mcp`,
        healthEndpoint: `http://localhost:${PORT}/health`,
      },
      'Server started successfully'
    );
  });
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
