import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from 'dotenv';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { v4 as uuidv4 } from 'uuid';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { InMemoryEventStore } from '@modelcontextprotocol/sdk/examples/shared/inMemoryEventStore.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  isInitializeRequest,
  type CallToolRequest,
  type ListToolsRequest,
  type ListResourcesRequest,
  type ReadResourceRequest,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SessionManager } from './utils/session.js';
import {
  EchoToolInputSchema,
  type EchoToolOutput,
  type WidgetDescriptor,
} from './types.js';

// Load environment variables
config();

// Setup paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ASSETS_DIR = path.resolve(ROOT_DIR, 'assets');

// Configuration
const PORT = parseInt(process.env.PORT || '8080', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE || '3600000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Setup pino logger
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

// Widget descriptor
const ECHO_WIDGET: WidgetDescriptor = {
  id: 'echo-marquee',
  title: 'Echo Marquee',
  uri: 'widget://echo-marquee',
};

/**
 * Read widget HTML from assets directory
 */
function readWidgetHtml(widgetId: string): string {
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

/**
 * Create an MCP server instance with echo tool
 */
function createMcpServer(sessionId: string): Server {
  const server = new Server(
    {
      name: 'chatgpt-app-template',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  const sessionLogger = logger.child({ sessionId });

  // Define echo tool
  const echoTool: Tool = {
    name: 'echo',
    description: "Echoes back the user's message in a scrolling marquee widget",
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to echo back',
        },
      },
      required: ['message'],
    },
  };

  // List tools handler
  server.setRequestHandler(
    ListToolsRequestSchema,
    async (_request: ListToolsRequest) => {
      sessionLogger.debug('Listing tools');
      return {
        tools: [echoTool],
      };
    }
  );

  // List resources handler
  server.setRequestHandler(
    ListResourcesRequestSchema,
    async (_request: ListResourcesRequest) => {
      sessionLogger.debug('Listing resources');
      return {
        resources: [
          {
            uri: ECHO_WIDGET.uri,
            name: ECHO_WIDGET.title,
            description:
              'Interactive scrolling marquee widget for displaying echoed messages',
            mimeType: 'text/html+skybridge',
          },
        ],
      };
    }
  );

  // Call tool handler
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      sessionLogger.info({ toolName: name, args }, 'Tool invoked');

      if (name !== 'echo') {
        const error = `Unknown tool: ${name}`;
        sessionLogger.error({ toolName: name }, error);
        throw new Error(error);
      }

      try {
        // Validate input with Zod
        const validatedInput = EchoToolInputSchema.parse(args || {});

        // Create structured output
        const output: EchoToolOutput = {
          echoedMessage: validatedInput.message,
          timestamp: new Date().toISOString(),
        };

        sessionLogger.info({ output }, 'Tool execution successful');

        return {
          content: [
            {
              type: 'text',
              text: `Echoing: "${validatedInput.message}"`,
            },
          ],
          structuredContent: output,
          _meta: {
            outputTemplate: {
              type: 'resource',
              resource: {
                uri: ECHO_WIDGET.uri,
              },
            },
          },
        };
      } catch (err) {
        sessionLogger.error({ err, toolName: name }, 'Tool execution failed');
        throw err;
      }
    }
  );

  // Read resource handler - Critical for widget loading
  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request: ReadResourceRequest) => {
      const { uri } = request.params;

      sessionLogger.debug({ uri }, 'Reading resource');

      // Handle widget resources
      if (uri.startsWith('widget://')) {
        const widgetId = uri.replace('widget://', '');

        if (widgetId === ECHO_WIDGET.id) {
          try {
            const html = readWidgetHtml(widgetId);

            sessionLogger.info({ uri, widgetId }, 'Widget resource loaded');

            return {
              contents: [
                {
                  uri,
                  mimeType: 'text/html+skybridge', // CRITICAL for ChatGPT widget runtime
                  text: html,
                },
              ],
            };
          } catch (err) {
            sessionLogger.error(
              { err, uri, widgetId },
              'Failed to load widget'
            );
            throw err;
          }
        }
      }

      const error = `Unknown resource: ${uri}`;
      sessionLogger.error({ uri }, error);
      throw new Error(error);
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
    'Starting ChatGPT App Template server'
  );

  // Create Express app
  const app = express();

  // Add pino HTTP logging middleware
  app.use(pinoHttp({ logger }));

  // CORS middleware
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

  // Parse JSON bodies
  app.use(express.json());

  // Session manager
  const sessionManager = new SessionManager(logger);

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: '1.0.0',
      sessions: sessionManager.count(),
      timestamp: new Date().toISOString(),
    });
  });

  // Unified MCP endpoint for HttpStreamable transport (GET/POST/DELETE)
  app.all('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    logger.info({ method: req.method, sessionId, ip: req.ip }, 'MCP request');

    try {
      let session = sessionId ? sessionManager.get(sessionId) : undefined;

      // Handle initialization request (no session ID + POST with initialize message)
      if (
        !sessionId &&
        req.method === 'POST' &&
        isInitializeRequest(req.body)
      ) {
        logger.info('Initializing new session');

        // Create event store for resumability
        const eventStore = new InMemoryEventStore();

        // Create transport with session ID generator
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => uuidv4(),
          eventStore,
          onsessioninitialized: (newSessionId) => {
            logger.info({ sessionId: newSessionId }, 'Session initialized');
            // Session will be stored after transport is connected below
          },
        });

        // Set up close handler to clean up session
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            logger.info({ sessionId: sid }, 'Transport closed');
            sessionManager.delete(sid);
          }
        };

        // Create server and connect to transport BEFORE handling request
        // This allows the transport to route responses through the connected server
        const tempSessionId = 'initializing'; // Temporary ID until session is initialized
        const server = createMcpServer(tempSessionId);
        await server.connect(transport);

        // Handle the initialization request (this will trigger onsessioninitialized)
        await transport.handleRequest(req, res, req.body);

        // Store the session after initialization with the actual session ID
        const actualSessionId = transport.sessionId;
        if (actualSessionId) {
          sessionManager.create(actualSessionId, server, transport);
        }

        return;
      }

      // Reuse existing session
      if (session) {
        await session.transport.handleRequest(req, res, req.body);
        return;
      }

      // Invalid request - no session ID or not an initialization request
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

  // Cleanup stale sessions periodically
  const cleanupInterval = setInterval(() => {
    sessionManager.cleanup(SESSION_MAX_AGE);
  }, 60000); // Every minute

  // Create HTTP server
  const httpServer = createServer(app);

  // Graceful shutdown
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

  // Start listening
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

// Start server
main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
