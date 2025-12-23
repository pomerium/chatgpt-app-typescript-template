# Repository Guidelines

This file provides guidance to AI assistants (including Claude Code at claude.ai/code) when working with code in this repository.

## Project Overview

This is a ChatGPT app template built with the OpenAI Apps SDK and Model Context Protocol (MCP). The architecture consists of:

- **MCP Server** (Node.js + Express): Handles tool registration, execution, and widget resource serving
- **React Widgets**: Interactive components rendered in ChatGPT iframes that communicate via `window.openai` API
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

### Base `Server` Class Usage

This template uses the **base `Server` class** from `@modelcontextprotocol/sdk/server/index.js`, NOT the higher-level `McpServer` class. This is critical because:

- ChatGPT apps require the `_meta` field to reference widgets via `outputTemplate`
- Higher-level abstractions may strip custom metadata fields
- Pattern follows OpenAI's official examples

When adding new tools, always preserve the `_meta.outputTemplate` structure in responses.

### Widget Resource Registration

Widgets MUST be registered with the exact MIME type `text/html+skybridge` for ChatGPT to load them:

```typescript
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri.startsWith('ui://')) {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/html+skybridge', // CRITICAL - must be exact
          text: html,
        },
      ],
    };
  }
});
```

### Tool Response Structure

All tool responses follow this pattern:

```typescript
{
  content: [{ type: 'text', text: 'Human-readable message' }],
  structuredContent: {
    // Data passed to widget via window.openai.toolOutput
    // Keep this under 4,000 tokens for performance
  },
  _meta: {
    outputTemplate: {
      type: 'resource',
      resource: { uri: 'ui://widget-name' }
    }
  }
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
- Widget name comes from the filename (e.g., `echo-marquee.tsx` → `echo-marquee` widget)
- **Widgets must include their own mounting code** at the bottom of the file
- Generates content-hashed assets (e.g., `echo-marquee-a1b2c3d4.js`)
- Creates HTML templates with preload hints that reference hashed assets
- Both hashed and unhashed filenames are generated for flexibility
- Widget bundles in `assets/` are generated artifacts; never edit them manually

**Widget folder structure:**

```
widgets/src/
  ├── widgets/              # Widget entry points (auto-discovered)
  │   ├── echo-marquee.tsx  # Widget entry - includes mounting code
  │   └── counter.tsx       # Another widget entry
  ├── echo-marquee/         # Widget-specific components
  │   ├── EchoMarquee.tsx
  │   └── styles.css
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
import { useOpenAiGlobal } from '../hooks/use-openai-global';

function MyWidget() {
  const toolOutput = useOpenAiGlobal('toolOutput');
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

Widgets use two key custom hooks:

**`useOpenAiGlobal(key)`** - Read reactive values from ChatGPT host:

```typescript
const toolOutput = useOpenAiGlobal('toolOutput'); // Tool's structuredContent
const theme = useOpenAiGlobal('theme'); // 'light' | 'dark'
const displayMode = useOpenAiGlobal('displayMode'); // 'inline' | 'pip' | 'fullscreen'
const safeArea = useOpenAiGlobal('safeArea'); // Insets for layout
```

**`useWidgetState(initialState)`** - Persistent state synchronized with host:

```typescript
const [state, setState] = useWidgetState({ count: 0 });
// State persists per message and syncs automatically
// Keep under 4,000 tokens for optimal performance
```

Both hooks are implemented using React's `useSyncExternalStore` for proper reactivity with the ChatGPT host's event system.

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
- `widgets/src/hooks/` - Shared React hooks for OpenAI API integration
- `widgets/src/types/openai.d.ts` - TypeScript definitions for window.openai
- `widgets/vite-plugin-widgets.ts` - Custom Vite plugin for auto-discovery and building

### Generated Assets

- `assets/` - Built widget bundles (gitignored)
- Files include both hashed versions (`echo-marquee-{hash}.js`) and unhashed (`echo-marquee.js`)
- HTML templates reference the hashed assets for cache busting

## Coding Style & Conventions

- TypeScript runs in strict mode; prefer explicit types at module boundaries
- Keep React components in PascalCase modules (e.g., `EchoMarquee.tsx`)
- Run `npm run lint` to apply ESLint (React, hooks, a11y plugins) and guard import order, unused vars, and hook usage
- Format with `npm run format`; Prettier defaults to 2-space indentation and double quotes

## Testing Guidelines

- Vitest powers all suites. Run `npm test` to cover both workspaces or target `npm run test:server` / `npm run test:widgets` while iterating
- Each workspace offers `npm run test:coverage`
- Keep widget specs with Testing Library under `.test.ts[x]` filenames and store server specs in `server/tests/`

### Testing ChatGPT Integration

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
```

Requirements:

- Node.js 22+ with npm 10+ (consider `corepack enable` to pin versions in CI)
- When tunneling or redeploying, check `/health` and rerun `npm run inspect` to ensure the MCP manifest is current

## Common Troubleshooting

**Widget not loading in ChatGPT:**

- Verify `text/html+skybridge` MIME type in resource handler
- Check `assets/` directory exists and contains built files
- Rebuild widgets: `npm run build:widgets`
- Restart server and refresh connector in ChatGPT settings

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
- Deploy to publicly accessible URL (ChatGPT requires HTTPS)
- Ensure `assets/` directory is deployed with the server
- Configure reverse proxy if needed (nginx, Caddy, etc.)
- Set up SSL/TLS certificates

**Monitoring:**
- Monitor `/health` endpoint for server status
- Set up logging aggregation (Pino outputs JSON in production)
- Configure alerts for errors and performance issues

## Important Notes for AI Assistants

- Always read `server/src/server.ts` to understand current tool implementations before modifying
- The `_meta.outputTemplate` field is critical for widget loading - never omit it
- Widget build is separate from server build - always run `npm run build:widgets` when modifying widgets
- The `text/html+skybridge` MIME type is non-negotiable for ChatGPT widget loading
- Session cleanup runs automatically but sessions are isolated - each HttpStreamable connection gets its own MCP server instance
- Node.js 22+ is required for ES2023 features and native type stripping
- Use `npm run inspect` for rapid local testing before connecting to ChatGPT
