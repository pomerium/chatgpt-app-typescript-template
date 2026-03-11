# Repository Guidelines

This file provides guidance to AI assistants (including Claude Code at claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP Apps template built with the MCP Apps spec and Model Context Protocol (MCP). The architecture consists of:

- **MCP Server** (Node.js + Express): Handles tool registration, execution, and widget resource serving
- **MCP App Views**: Interactive components rendered in host iframes that communicate via the MCP Apps `App` API
- **Widget Build System**: Custom Vite-based parallel build pipeline with content hashing and auto-discovery

npm workspaces split the codebase: `server/` is the MCP backend, `widgets/` houses React widgets, and shared tooling sits in `scripts/`.

## Development Commands

### Quick Start

**Fastest way to get up and running:**

```bash
npm install
npm run dev
```

This starts both the MCP server (`http://localhost:8080`) and widget dev server (`http://localhost:4444`).

### All Available Commands

**Development:**

```bash
npm run dev           # Start everything (server + widgets in watch mode)
npm run dev:inline    # Inlined assets for Claude.ai or remote sharing via ssh -R 0 pom.run
npm run dev:server    # Start only MCP server (watch mode)
npm run dev:widgets   # Start only widget dev server
npm run inspect       # Test with MCP Inspector
```

**Building:**

```bash
npm run build         # Full production build (widgets + server)
npm run build:widgets # Build only widgets
npm run build:server  # Build only server
```

**Testing:**

```bash
npm test              # Run all tests
npm run test:server   # Run server tests only
npm run test:widgets  # Run widget tests only
npm run test:coverage # Run tests with coverage
```

**Code Quality:**

```bash
npm run lint          # Lint TypeScript files
npm run format        # Format code with Prettier
npm run format:check  # Check formatting without modifying
npm run type-check    # Type check all workspaces
```

**Storybook:**

```bash
npm run storybook        # Run Storybook dev server
npm run build:storybook  # Build Storybook for production
```

## Key Architectural Patterns

### MCP Apps Server Usage

This template uses `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` with the MCP Apps helpers:

- Register UI resources with `registerAppResource`
- Register tools with `registerAppTool`
- Include `_meta.ui.resourceUri` on tools to bind a UI resource

### Widget Resource Registration

Widgets MUST be registered with the exact MIME type `text/html;profile=mcp-app` for MCP Apps hosts to load them:

```typescript
registerAppResource(
  server,
  'ui://my-widget',
  'ui://my-widget',
  { mimeType: 'text/html;profile=mcp-app' }, // CRITICAL - must be exact
  async () => ({
    contents: [
      {
        uri: 'ui://my-widget',
        mimeType: 'text/html;profile=mcp-app',
        text: html,
      },
    ],
  })
);
```

### Tool Response Structure

All tool responses follow this pattern (UI binding happens in tool metadata):

```typescript
{
  content: [{ type: 'text', text: 'Human-readable message' }],
  structuredContent: {
    // Data passed to the app via App.ontoolresult
    // Keep this under 4,000 tokens for performance
  },
  // No outputTemplate required; UI linkage lives in tool _meta.ui.resourceUri
}
```

### Session Management

The server uses `SessionManager` (server/src/utils/session.ts) to track MCP sessions:

- Sessions are created per HttpStreamable connection with unique IDs
- Session IDs are communicated via the `mcp-session-id` header
- Automatic cleanup of stale sessions runs based on `SESSION_MAX_AGE` (default 1 hour)
- Each session has its own MCP server instance to maintain isolation
- Session data includes server instance, transport, and creation timestamp
- Resumability is enabled via `InMemoryEventStore` for handling connection interruptions

### Widget Build System

Vite auto-discovers and builds widgets via a custom plugin:

- Scans `widgets/src/widgets/*.{tsx,jsx}` for widget entry points
- Widget name comes from the filename (e.g., `echo.tsx` → `echo` widget)
- **Widgets must include their own mounting code** at the bottom of the file
- Generates content-hashed assets (e.g., `echo-a1b2c3d4.js`)
- Creates HTML templates with preload hints that reference hashed assets
- Both hashed and unhashed filenames are generated for flexibility
- Widget bundles in `assets/` are generated artifacts; never edit them manually

**Widget folder structure:**

```
widgets/src/
  ├── widgets/              # Widget entry points (auto-discovered)
  │   ├── echo.tsx          # Widget entry - includes mounting code
  │   └── counter.tsx       # Another widget entry
  ├── echo/                 # Widget-specific components
  │   ├── Echo.tsx
  │   └── Echo.stories.tsx
  ├── components/           # Shared components (including shadcn/ui)
  │   └── ui/
  ├── hooks/                # Shared hooks
  └── utils/                # Shared utilities
```

**To add a new widget:**

1. Create `widgets/src/widgets/my-widget.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@modelcontextprotocol/ext-apps';
import { useEffect, useState } from 'react';

function MyWidget() {
  const [toolOutput, setToolOutput] = useState(null);

  useEffect(() => {
    const app = new App({ name: 'MyWidget', version: '1.0.0' });
    app.ontoolresult = (result) =>
      setToolOutput(result.structuredContent ?? null);
    app.connect();
  }, []);

  return <div>{JSON.stringify(toolOutput)}</div>;
}

// Mounting code - required at the bottom of each widget file
const rootElement = document.getElementById('my-widget-root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <MyWidget />
    </StrictMode>
  );
}
```

2. Add supporting components in `widgets/src/my-widget/` if needed
3. Widget automatically discovered and built in dev mode
4. Widget will be available as `ui://my-widget`

### Widget Development Patterns

**`App` API** - Connect to the host and read tool results + context:

```typescript
const app = new App({ name: 'Echo', version: '1.0.0' });
app.ontoolresult = (result) => {
  console.log(result.structuredContent);
};
app.onhostcontextchanged = (context) => {
  console.log(
    context?.theme,
    context?.displayMode,
    context?.containerDimensions
  );
};
await app.connect();

const hostContext = app.getHostContext();
const theme = hostContext?.theme; // 'light' | 'dark'
const displayMode = hostContext?.displayMode; // 'inline' | 'pip' | 'fullscreen'
const safeAreaInsets = hostContext?.safeAreaInsets;
const containerDimensions = hostContext?.containerDimensions; // { maxHeight, maxWidth, height, width }
```

**Runtime APIs** - Call tools, open links, send messages, update model context, and toggle display mode:

```typescript
// Call other tools from the widget
const result = await app.callServerTool({
  name: 'echo',
  arguments: { message: 'Hello' },
});

// Open an external link via the host
await app.openLink({ url: 'https://example.com' });

// Send a message to the host chat
await app.sendMessage({
  role: 'user',
  content: [{ type: 'text', text: 'Hello from the widget!' }],
});

// Push widget state to the model context for future turns
await app.updateModelContext({
  content: [{ type: 'text', text: 'Current widget state summary' }],
  structuredContent: { key: 'value' },
});

// Toggle display mode (inline, pip, fullscreen)
const modeResult = await app.requestDisplayMode({ mode: 'fullscreen' });
// Always use modeResult.mode as the source of truth — the host may deny the request
```

### Display Modes

Widgets can run in three display modes: `inline` (within chat flow, default), `pip` (floating window), and `fullscreen` (overlay). The current mode is available via `hostContext.displayMode`. Use `app.requestDisplayMode()` to request a change — the host decides whether to honor it.

### Container Dimensions

Hosts provide `containerDimensions` (`maxHeight`, `maxWidth`, `height`, `width`) in the host context so widgets can size themselves responsively. This replaces viewport-based sizing and is especially important in inline mode where the widget shares space with chat content.

### UI Capability Negotiation

The server inspects client capabilities during session initialization via `getUiCapability()` from `@modelcontextprotocol/ext-apps/server`. UI-capable hosts get `_meta.ui.resourceUri` on tools and `structuredContent` in responses. Text-only hosts get plain text responses with no UI metadata. This is handled automatically in `createMcpServer()`.

### Inline Asset Mode (Local Development Only)

`npm run dev:inline` (`INLINE_DEV_MODE=true`) inlines JS/CSS into widget HTML as `<script>`/`<style>` blocks, inlines local images as data URIs via Vite's `assetsInlineLimit`, and loads fonts via Google Fonts (domains auto-added to `resourceDomains`). Use this for testing in Claude.ai or when sharing your work remotely via `ssh -R 0 pom.run`.

If you self-host tunneling, you can create a public route in Pomerium for widgets or host them elsewhere (Vercel, Netlify, etc.) — just add those domains to `resourceDomains`. Inline mode is not needed in production.

### External Resources & CSP

MCP Apps hosts render widgets in sandboxed iframes with strict CSP. Remote images and other external resources are blocked by default. To allow external domains, declare them in the resource `_meta.ui.csp`:

- `resourceDomains` — allows loading images, fonts, scripts from listed origins
- `connectDomains` — allows `fetch()`/XHR to listed origins
- Each domain must be explicitly listed (no wildcards); include redirect targets too
- Data URIs always work — Vite-imported images are inlined via `assetsInlineLimit` in inline asset mode
- In inline dev mode (`INLINE_DEV_MODE`), Google Fonts domains (`https://fonts.googleapis.com`, `https://fonts.gstatic.com`) are automatically added to `resourceDomains`

### Mock App for Testing & Storybook

`createMockApp()` in `widgets/src/mocks/mock-app.ts` provides a drop-in `AppLike` replacement for the real `App`. It supports all runtime APIs (`callServerTool`, `openLink`, `sendMessage`, `updateModelContext`, `requestDisplayMode`) and exposes `emitToolResult()` / `setHostContext()` for simulating host events in tests and Storybook stories.

### Zod Validation Pattern

All tool inputs are validated using Zod schemas:

1. Define schema in `server/src/types.ts`
2. Parse inputs in tool handler: `const args = SchemaName.parse(request.params.arguments)`
3. TypeScript types are auto-inferred via `z.infer<typeof SchemaName>`

This ensures type safety and runtime validation.

## File Organization

### Server Structure

- `server/src/server.ts` - Main server, tool registration, HttpStreamable transport setup
- `server/src/types.ts` - Zod schemas and TypeScript interfaces
- `server/src/utils/session.ts` - SessionManager class for MCP session lifecycle
- `server/tests/*.test.ts` - Vitest specs for tools and validation

### Widget Structure

- `widgets/src/widgets/{widget-name}.tsx` - Widget entry point (auto-discovered, includes mounting code)
- `widgets/src/{widget-name}/{Component}.tsx` - Supporting components for the widget
- `widgets/src/{widget-name}/styles.css` - Component-specific styles
- `widgets/src/{widget-name}/{Component}.stories.tsx` - Storybook stories
- `widgets/src/components/` - Shared components (including shadcn/ui)
- `widgets/src/types/mcp-app.ts` - Lightweight MCP Apps types for UI wiring
- `widgets/src/mocks/mock-app.ts` - Mock App implementation for tests/stories
- `widgets/vite-plugin-widgets.ts` - Custom Vite plugin for auto-discovery and building

### Generated Assets

- `assets/` - Built widget bundles (gitignored)
- Files include both hashed versions (`echo-{hash}.js`) and unhashed (`echo.js`)
- HTML templates reference the hashed assets for cache busting

## Coding Style & Conventions

- TypeScript runs in strict mode; prefer explicit types at module boundaries
- Keep React components in PascalCase modules (e.g., `Echo.tsx`)
- Run `npm run lint` to apply ESLint (React, hooks, a11y plugins) and guard import order, unused vars, and hook usage
- Format with `npm run format`; Prettier defaults to 2-space indentation and double quotes

## Testing Guidelines

- Vitest powers all suites. Run `npm test` to cover both workspaces or target `npm run test:server` / `npm run test:widgets` while iterating
- Each workspace offers `npm run test:coverage`
- Keep widget specs with Testing Library under `.test.ts[x]` filenames and store server specs in `server/tests/`

### Testing MCP Apps Hosts

#### Local Testing with MCP Inspector

```bash
# 1. Start server (terminal 1)
npm run dev:server

# 2. Build widgets (terminal 2)
npm run build:widgets

# 3. Open inspector
npm run inspect
```

The inspector allows testing tool invocations and verifying widget resources without deploying.

#### Connecting from ChatGPT

**Development Testing with Pomerium SSH Tunnel:**

With your project running (`npm run dev`), create a public URL in a new terminal:

```bash
ssh -R 0 pom.run
```

**First-time setup:**

1. You'll see a sign-in URL in your terminal:

   ```
   Please sign in with hosted to continue
   https://data-plane-us-central1-1.dataplane.pomerium.com/.pomerium/sign_in?user_code=some-code
   ```

2. Click the link and sign up
3. Authorize via the Pomerium OAuth flow
4. The terminal will display your connection details

Look for the **Port Forward Status** section, which shows:

- **Status**: `ACTIVE` (your tunnel is running)
- **Remote**: `https://template.first-wallaby-240.pom.run` (your public URL)
- **Local**: `http://localhost:8080` (your local server)

**Add to ChatGPT:**

1. Ensure ChatGPT apps dev mode is enabled in settings
2. In ChatGPT: Settings → Connectors → Add Connector
3. Enter your Remote URL + `/mcp`: `https://template.first-wallaby-240.pom.run/mcp`
4. Add the app to a chat and test with: `echo Hi there!`

The tunnel stays active as long as the SSH session is running.

**Production Setup:**

1. Deploy server or use tunnel service (ngrok, cloudflare tunnel, pomerium, etc.)
2. In ChatGPT: Settings → Connectors → Add Connector
3. Enter server URL: `https://your-domain.com/mcp`
4. After code changes: Settings → Connectors → Your App → Refresh

## Environment Configuration

Key environment variables (create `.env` from `.env.example`):

```bash
NODE_ENV=development           # Controls logging format
PORT=8080                      # Server port
WIDGET_PORT=4444               # Widget dev server port (default: 4444)
LOG_LEVEL=info                 # Pino log level: fatal, error, warn, info, debug, trace
SESSION_MAX_AGE=3600000        # Session cleanup threshold (1 hour in ms)
CORS_ORIGIN=*                  # CORS origin (set to domain in production)
BASE_URL=                      # Optional CDN URL for widget assets
INLINE_DEV_MODE=true      # Local dev only: inline JS/CSS + images, fonts via Google Fonts (npm run dev:inline)
```

Requirements:

- Node.js 22+ with npm 10+ (consider `corepack enable` to pin versions in CI)
- When tunneling or redeploying, check `/health` and rerun `npm run inspect` to ensure the MCP manifest is current

## Common Troubleshooting

**Widget not loading in a host:**

- Verify `text/html;profile=mcp-app` MIME type in resource handler
- Check `assets/` directory exists and contains built files
- Rebuild widgets: `npm run build:widgets`
- Restart server and refresh the connector in host settings

**"Widget assets not found" error:**

- Run `npm run build:widgets` before starting the server
- Check that `assets/` directory was created
- Verify widget entry points exist in `widgets/src/**/index.{tsx,jsx}`

**Port already in use:**

- Change `PORT` in `.env` file
- Or kill existing process: `lsof -ti:8080 | xargs kill`

**Type errors:**

- Run `npm run type-check` to see all TypeScript errors across workspaces
- Both `server/` and `widgets/` have separate `tsconfig.json` files

## Commit & Pull Request Guidelines

- Use concise, imperative subjects (example: `initial commit`); stay under 72 characters and add optional detail in the body
- Reference issues, note manual test commands, and attach UI screenshots or terminal logs when widgets or tooling shift
- In pull requests, describe the user impact, flag risks, and mention follow-up tasks so reviewers can confirm MCP behavior quickly

## Production Deployment

### Building for Production

```bash
# Full production build
npm run build
```

This runs:

1. `npm run build:widgets` - Builds optimized widget bundles with content hashing
2. `npm run build:server` - Compiles TypeScript server code

**Build outputs:**

- `assets/` - Optimized widget bundles (JS/CSS with content hashes)
- `server/dist/` - Compiled server code

### Manual Deployment

```bash
npm install
npm run build
NODE_ENV=production npm start
```

The server will:

- Serve MCP on `http://localhost:8080/mcp`
- Load pre-built widgets from `assets/`
- Use structured logging (JSON format)
- Run with production optimizations

### Docker Deployment

```bash
docker build -f docker/Dockerfile -t chatgpt-app:latest .
docker-compose -f docker/docker-compose.yml up -d
```

### Production Checklist

**Environment Variables:**

- Set `NODE_ENV=production`
- Configure `CORS_ORIGIN` to your domain (not `*`)
- Set `LOG_LEVEL=warn` or `error` for production
- Configure `SESSION_MAX_AGE` based on your use case
- Set `BASE_URL` if using a CDN for widget assets

**Deployment Requirements:**

- **MCP Server:** Must be behind a [Pomerium](https://www.pomerium.com/) route for OAuth and access policies
- **Widget assets:** Must be publicly accessible — same server, CDN (`BASE_URL`), or static host (Netlify/Vercel)
- Ensure `assets/` directory is deployed with the server (or served separately via `BASE_URL`)
- Set up SSL/TLS certificates (most MCP hosts require HTTPS)

**Monitoring:**

- Monitor `/health` endpoint for server status
- Set up logging aggregation (Pino outputs JSON in production)
- Configure alerts for errors and performance issues

## Important Notes for AI Assistants

- Always read `server/src/server.ts` to understand current tool implementations before modifying
- The `_meta.ui.resourceUri` field is critical for UI binding - never omit it
- UI capability negotiation is automatic — `getUiCapability()` checks client capabilities and the server omits UI metadata for text-only hosts
- Widget components accept an `app` prop typed as `AppLike<T>` so the real `App` or `createMockApp()` can be injected
- Use `containerDimensions.maxHeight` (not viewport height) for responsive widget sizing
- When adding new App API calls (`openLink`, `sendMessage`, `updateModelContext`), add the method signature to `AppLike` in `widgets/src/types/mcp-app.ts` and the mock in `widgets/src/mocks/mock-app.ts`
- Use `npm run dev:inline` for Claude.ai testing or remote sharing via `ssh -R 0 pom.run`
- Widget build is separate from server build - always run `npm run build:widgets` when modifying widgets
- The `text/html;profile=mcp-app` MIME type is non-negotiable for MCP Apps UI loading
- Session cleanup runs automatically but sessions are isolated - each HttpStreamable connection gets its own MCP server instance
- Node.js 22+ is required for ES2023 features and native type stripping
- Use `npm run inspect` for rapid local testing before connecting to hosts
