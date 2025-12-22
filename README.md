# ChatGPT App Template

> Minimal, production-ready template for building ChatGPT apps with the OpenAI Apps SDK

A well-architected starter template demonstrating best practices for building ChatGPT apps using the Model Context Protocol (MCP) with React widgets.

**Template Score: 85%+** against [OpenAI Apps SDK requirements](https://developers.openai.com/apps-sdk/)

## Features

- **MCP Server** - Node.js server with base `Server` class (preserves `_meta` fields)
- **Echo Tool** - Example tool with Zod 4 validation and widget response
- **React Widgets** - Interactive marquee component with `callTool` demo
- **Pino Logging** - Structured logging with pretty printing in development
- **TypeScript** - Strict mode with ES2023 target
- **Tailwind CSS v4** - Modern styling with dark mode support
- **Storybook** - Component development with a11y addon
- **Testing** - Vitest for server and widgets with accessibility checks
- **Build Optimizations** - Parallel builds, content hashing, compression
- **Docker** - Multi-stage builds with health checks
- **Production Ready** - Session management, graceful shutdown, error handling

## Architecture

```
┌─────────────┐
│   ChatGPT   │
└──────┬──────┘
       │ SSE
       ▼
┌─────────────────────────────────────┐
│  MCP Server (Node.js + Express)    │
│  - Echo Tool                        │
│  - Resource Registration            │
│  - text/html+skybridge MIME type    │
└──────┬──────────────────────────────┘
       │
       │ _meta.outputTemplate
       ▼
┌─────────────────────────────────────┐
│  Widget (React in iframe)           │
│  - Reads window.openai.toolOutput   │
│  - Calls window.openai.callTool()   │
│  - Theme, displayMode, safeArea     │
└─────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- **Node.js 22+** (required for ES2023 support)
- **npm 10+** (ships with Node 22)
- **Tunnel service** (for testing with ChatGPT)

### Installation

```bash
git clone <your-repo-url> chatgpt-app
cd chatgpt-app
npm install
```

### Development Workflow

```bash
# 1. Start server (watch mode)
npm run dev:server

# 2. Build widgets (in separate terminal)
npm run build:widgets

# 3. Test with MCP Inspector
npm run inspect

# 4. Run Storybook (optional)
npm run storybook
```

Server runs on `http://localhost:3000/mcp`

### Testing Your App

#### 1. Local Testing with MCP Inspector

```bash
npm run inspect
```

This opens a browser interface to:
- List available tools
- Test tool invocations
- Inspect responses and metadata
- Verify widget resources load correctly

#### 2. Connect from ChatGPT

1. Deploy your server (or use a tunnel service for local dev)
2. In ChatGPT: **Settings → Connectors → Add Connector**
3. Enter your server URL: `https://your-domain.com/mcp`
4. Test the `echo` tool in ChatGPT

#### 3. Refresh Connector

After code changes:
1. **Settings → Connectors → Your App → Refresh**
2. This reloads tool definitions and metadata

## Project Structure

```
chatgpt-app-template/
├── server/                  # MCP server
│   ├── src/
│   │   ├── server.ts       # Main server with echo tool
│   │   ├── types.ts        # Type definitions
│   │   └── utils/
│   │       └── session.ts  # Session management
│   ├── tests/
│   │   └── echo-tool.test.ts
│   └── package.json        # Server dependencies
│
├── widgets/                 # React widgets
│   ├── src/
│   │   ├── widgets/
│   │   │   └── echo-marquee.tsx   # Widget entry (auto-discovered)
│   │   ├── echo-marquee/
│   │   │   ├── EchoMarquee.tsx    # Shared components
│   │   │   ├── EchoMarquee.stories.tsx
│   │   │   └── styles.css
│   │   ├── components/
│   │   │   └── ui/              # ShadCN components
│   │   ├── hooks/
│   │   │   ├── use-openai-global.ts
│   │   │   └── use-widget-state.ts
│   │   └── types/
│   │       └── openai.d.ts
│   ├── .storybook/         # Storybook config
│   └── package.json        # Widget dependencies
│
├── assets/                  # Built widgets (gitignored)
│   ├── echo-marquee.html
│   ├── echo-marquee-[hash].js
│   └── echo-marquee-[hash].css
│
├── scripts/
│   └── build-all.mts       # Parallel widget builds
│
├── docker/
│   ├── Dockerfile          # Multi-stage build
│   └── docker-compose.yml
│
└── package.json            # Root workspace
```

## Adding New Tools

### 1. Define Tool Schema

```typescript
// server/src/server.ts

const myTool: Tool = {
  name: 'my_tool',
  description: 'Does something cool',
  inputSchema: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Tool input' }
    },
    required: ['input']
  }
};
```

### 2. Implement Tool Handler

```typescript
// In CallToolRequestSchema handler

if (name === 'my_tool') {
  const args = MyToolInputSchema.parse(request.params.arguments);

  return {
    content: [{ type: 'text', text: 'Result' }],
    structuredContent: {
      result: args.input
    },
    _meta: {
      outputTemplate: {
        type: 'resource',
        resource: { uri: 'widget://my-widget' }
      }
    }
  };
}
```

### 3. Create Widget

Create `widgets/src/widgets/my-widget.tsx`:

```tsx
// widgets/src/widgets/my-widget.tsx
import { useOpenAiGlobal } from '../hooks/use-openai-global';

export default function MyWidget() {
  const toolOutput = useOpenAiGlobal('toolOutput');
  const theme = useOpenAiGlobal('theme');

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <h1>My Widget</h1>
      <pre>{JSON.stringify(toolOutput, null, 2)}</pre>
    </div>
  );
}
```

**That's it!** No mounting code needed - the build system handles it automatically.

### 4. Register Widget Resource

```typescript
// In ReadResourceRequestSchema handler

if (uri === 'widget://my-widget') {
  const html = readWidgetHtml('my-widget');
  return {
    contents: [{
      uri,
      mimeType: 'text/html+skybridge', // CRITICAL!
      text: html
    }]
  };
}
```

### 5. Build

```bash
npm run build:widgets
npm run dev:server
```

The build script auto-discovers widgets in `widgets/src/widgets/*.{tsx,jsx}` and automatically handles mounting

## Widget Development

### Widget Pattern

Widgets are simple React components - **no mounting code required**:

**1. Create widget entry point** in `widgets/src/widgets/[name].tsx`:
```tsx
import { useOpenAiGlobal } from '../hooks/use-openai-global';

export default function MyWidget() {
  const toolOutput = useOpenAiGlobal('toolOutput');
  return <div>Widget content</div>;
}
```

**2. Build automatically discovers and mounts it**:
```bash
npm run build:widgets
```

**3. Widget available as** `widget://my-widget`

The build system:
- Auto-discovers all files in `widgets/src/widgets/*.{tsx,jsx}`
- Generates virtual entry points with mounting code
- Injects `StrictMode` wrapper and DOM mounting logic
- Creates content-hashed bundles and HTML templates

### window.openai API Reference

#### State & Data

```typescript
const toolOutput = useOpenAiGlobal('toolOutput');     // Tool's structured content
const toolInput = useOpenAiGlobal('toolInput');       // Tool arguments
const [state, setState] = useWidgetState({ count: 0 }); // Persistent state
```

**State Limits**: Keep `widgetState` under **4,000 tokens** for optimal performance.

#### Context Signals

```typescript
const theme = useOpenAiGlobal('theme');               // 'light' | 'dark'
const displayMode = useOpenAiGlobal('displayMode');   // 'inline' | 'pip' | 'fullscreen'
const maxHeight = useOpenAiGlobal('maxHeight');       // Max height in pixels
const safeArea = useOpenAiGlobal('safeArea');         // Insets for responsive layout
const viewport = useOpenAiGlobal('viewport');         // { width, height }
const locale = useOpenAiGlobal('locale');             // User locale (e.g., 'en-US')
```

#### Runtime APIs

```typescript
// Call other tools from widget
const result = await window.openai?.callTool('tool_name', { arg: 'value' });

// Toggle display mode
await window.openai?.requestDisplayMode({ mode: 'fullscreen' });

// Send follow-up message
await window.openai?.sendFollowUpMessage({ prompt: 'Continue...' });

// File operations
const { fileId } = await window.openai?.uploadFile(file);
const { url } = await window.openai?.getFileDownloadUrl({ fileId });

// Open external links
window.openai?.openExternal({ href: 'https://example.com' });

// Close widget
await window.openai?.requestClose();
```

### Example: Full Widget with Safe Area

```tsx
// widgets/src/widgets/my-widget.tsx
import { useState } from 'react';
import { useOpenAiGlobal } from '../hooks/use-openai-global';

export default function MyWidget() {
  const toolOutput = useOpenAiGlobal('toolOutput');
  const theme = useOpenAiGlobal('theme');
  const safeArea = useOpenAiGlobal('safeArea');
  const [count, setCount] = useState(0);

  const containerStyle = {
    paddingTop: safeArea?.insets?.top || 0,
    paddingBottom: safeArea?.insets?.bottom || 0,
  };

  return (
    <div style={containerStyle} className={theme === 'dark' ? 'dark' : ''}>
      <h1>My Widget</h1>
      <p>Tool output: {JSON.stringify(toolOutput)}</p>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  );
}
```

**Note**: Just export the component as default - no mounting code needed!

## Configuration

### Environment Variables

Create `.env` file (see `.env.example`):

```bash
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=info          # fatal, error, warn, info, debug, trace

# Session Management
SESSION_MAX_AGE=3600000 # 1 hour in milliseconds

# CORS (development)
CORS_ORIGIN=*

# Asset Base URL (for CDN)
# ASSET_BASE_URL=https://cdn.example.com/assets

# Build Configuration
# BUILD_CONCURRENCY=4   # Parallel widget builds (default: CPU count / 2)
```

### Critical Configuration Notes

#### text/html+skybridge MIME Type

**Required** for widgets to load in ChatGPT:

```typescript
return {
  contents: [{
    uri: 'widget://my-widget',
    mimeType: 'text/html+skybridge', // ← CRITICAL
    text: html
  }]
};
```

#### Bundle Size Limits

- **Widget bundles**: Warn at 500kb (configured in Vite)
- **Widget state**: Keep under 4,000 tokens for performance

## API Reference

### MCP Server Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check (returns status, version, session count) |
| `/mcp` | GET | SSE connection endpoint for MCP clients |
| `/mcp/messages?sessionId=<id>` | POST | Message handling for MCP protocol |

### Echo Tool Schema

```json
{
  "name": "echo",
  "description": "Echoes back the user's message in a scrolling marquee widget",
  "inputSchema": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string",
        "description": "The message to echo back"
      }
    },
    "required": ["message"]
  }
}
```

### Tool Response Format

```typescript
{
  content: [{ type: 'text', text: 'Human-readable message' }],
  structuredContent: {
    // JSON data passed to widget via window.openai.toolOutput
    echoedMessage: 'Hello',
    timestamp: '2025-01-...'
  },
  _meta: {
    outputTemplate: {
      type: 'resource',
      resource: { uri: 'widget://echo-marquee' }
    }
  }
}
```

## Testing

### Run All Tests

```bash
npm test              # All tests
npm run test:server   # Server tests only
npm run test:widgets  # Widget tests only
npm test -- --coverage # With coverage
```

### Test Structure

**Server Tests** (`server/tests/`):
- Input validation with Zod
- Tool response structure
- Session management
- Error handling

**Widget Tests** (`widgets/tests/`):
- Component rendering
- User interactions
- Accessibility (a11y) compliance
- window.openai API mocking

### MCP Inspector Workflow

```bash
# 1. Start server
npm run dev:server

# 2. Build widgets
npm run build:widgets

# 3. Test with Inspector
npm run inspect

# 4. Verify:
#    - Tools list correctly
#    - Tool invocations work
#    - Widget HTML loads
#    - structuredContent is correct
```

## Deployment

### Docker Deployment

```bash
# Build image
docker build -f docker/Dockerfile -t chatgpt-app:latest .

# Run with docker-compose
docker-compose -f docker/docker-compose.yml up -d

# Check logs
docker-compose -f docker/docker-compose.yml logs -f

# Health check
curl http://localhost:3000/health
```

### Manual Deployment

```bash
# 1. Install dependencies
npm install

# 2. Build
npm run build

# 3. Start production server
NODE_ENV=production npm run start
```

### Production Checklist

- Set `NODE_ENV=production`
- Configure `CORS_ORIGIN` to your domain
- Set appropriate `LOG_LEVEL` (warn or error)
- Configure `SESSION_MAX_AGE` for your use case
- Use a tunnel or deploy to public URL
- Set up monitoring/alerts
- Configure CDN for assets (optional)

## Troubleshooting

### Widget Not Loading

**Symptom**: Widget doesn't appear in ChatGPT

**Solutions**:
1. Verify `text/html+skybridge` MIME type in resource registration
2. Check assets directory exists: `ls assets/`
3. Rebuild widgets: `npm run build:widgets`
4. Restart server and refresh connector in ChatGPT

### Tool Not Listed

**Symptom**: Tool doesn't appear in ChatGPT

**Solutions**:
1. Check server logs for errors
2. Test with MCP Inspector: `npm run inspect`
3. Refresh connector: Settings → Connectors → Refresh
4. Verify tool schema is valid JSON Schema

### Session Issues

**Symptom**: "Session not found" errors

**Solutions**:
1. Check `SESSION_MAX_AGE` setting
2. Review session cleanup logs
3. Ensure SSE connection is maintained
4. Check CORS configuration

### Build Failures

**Symptom**: `npm run build:widgets` fails

**Solutions**:
1. Clear node_modules: `rm -rf node_modules && npm install`
2. Check for TypeScript errors: `npm run type-check`
3. Verify all dependencies installed
4. Check Node.js version: `node -v` (should be 22+)

### Port Already in Use

**Symptom**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solutions**:
1. Change port in `.env`: `PORT=3001`
2. Kill existing process: `lsof -ti:3000 | xargs kill`

## Architecture Decisions

### Why Base `Server` Class?

The template uses the **base `Server` class** from `@modelcontextprotocol/sdk/server/index.js`, not the higher-level `McpServer` class, because:

- ChatGPT apps require the `_meta` field for widget references
- Higher-level abstractions might strip custom metadata
- Proven pattern from OpenAI's official examples

### Why Node.js 22 + ES2023?

- Native type stripping support
- Immutable array methods (`.toSorted()`, `.toReversed()`)
- Better performance and modern JavaScript features

### Why Tailwind CSS v4?

- Modern, performant, and well-documented
- Great dark mode support out of the box
- Smaller bundle sizes with new engine

### Why Pino for Logging?

- Fast, structured logging for production
- Pretty printing in development
- Easy integration with monitoring tools

## Contributing

Contributions welcome! Please:

1. Follow existing code style (ESLint + Prettier)
2. Add tests for new features
3. Update documentation
4. Ensure TypeScript strict mode compliance

## License

MIT

---

**Built with**:
- [OpenAI Apps SDK](https://developers.openai.com/apps-sdk/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [React 19](https://react.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Vite](https://vitejs.dev/)
- [Pino](https://getpino.io/)
