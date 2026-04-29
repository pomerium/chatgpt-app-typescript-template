---
name: create-mcp-tool
description: Add a plain (text-only) or UI-enhanced MCP tool to this template's server. Use when asked to "add a tool", "add an MCP tool", "create a new tool", "add a server-side tool without a widget", "add a tool with a UI", "add a tool with a widget", or "create a tool and a widget".
metadata:
  author: nickytonline
  version: "1.0.0"
---

# Add an MCP Tool to This Template

Fetch the upstream `add-app-to-server` skill for core SDK patterns, then apply them using the template-specific conventions below:

```
https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/main/plugins/mcp-apps/skills/add-app-to-server/SKILL.md
```

Use WebFetch to retrieve that skill now. The steps below cover what is **different** in this template.

---

## How This Template Differs from the Generic SDK Examples

| Generic ext-apps approach | This template |
|---|---|
| Edit `server.ts` directly | Edit `server/src/server.ts` inside the `createMcpServer()` function |
| Inline Zod schemas in the tool handler | Define schemas in `server/src/types.ts`, import into `server.ts` |
| `vite-plugin-singlefile` for UI | Widget build system in `widgets/` — see the `add-widget` skill if you want a UI |
| Single-file server | `SessionManager` in `server/src/utils/session.ts` handles per-session isolation |

All tools must be registered inside `createMcpServer()` in `server/src/server.ts`. This function is called once per new MCP session, so each session gets its own isolated `McpServer` instance.

---

## Step 1: Define the Schema and Types

Edit `server/src/types.ts`. Every tool input must have a Zod schema and an inferred TypeScript type:

```typescript
export const MyToolInputSchema = z.object({
  query: z.string().describe('The search query'),
  limit: z.number().int().min(1).max(50).optional().describe('Max results'),
});
export type MyToolInput = z.infer<typeof MyToolInputSchema>;

export interface MyToolOutput {
  results: string[];
  count: number;
  [key: string]: unknown;
}
```

---

## Step 2: Register the Tool

Inside `createMcpServer()` in `server/src/server.ts`, use `registerAppTool` (already imported):

### Text-only tool (no widget UI)

```typescript
registerAppTool(
  server,
  'my-tool',
  {
    title: 'My Tool',
    description: 'Does something useful',
    inputSchema: MyToolInputSchema.shape,
  },
  async (args) => {
    sessionLogger.info({ toolName: 'my-tool', args }, 'Tool invoked');

    const result = MyToolInputSchema.safeParse(args);
    if (!result.success) {
      return {
        content: [{ type: 'text', text: `Error: ${result.error.issues.map(e => e.message).join(', ')}` }],
        isError: true,
      };
    }

    const output: MyToolOutput = {
      results: ['a', 'b'],
      count: 2,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(output) }],
    };
  }
);
```

### UI-enhanced tool (has a widget)

When adding a UI, also follow the `add-widget` skill. The key addition is the `_meta.ui.resourceUri` field, gated on `canRenderUiByCapability` so text-only hosts still get a usable plain-text response:

```typescript
registerAppTool(
  server,
  'my-tool',
  {
    title: 'My Tool',
    description: 'Does something useful',
    inputSchema: MyToolInputSchema.shape,
    _meta: canRenderUiByCapability
      ? { ui: { resourceUri: MY_WIDGET.uri } }
      : {},
  },
  async (args) => {
    // ... validate, compute output ...
    return {
      content: [{ type: 'text', text: 'Plain text fallback for non-UI hosts' }],
      structuredContent: output,   // passed to the widget via App.ontoolresult
    };
  }
);
```

---

## Step 3: Write Tests

Add tests in `server/tests/`. Follow the pattern of existing test files. Run with:

```bash
npm run test:server
```

---

## Step 4: Verify

```bash
npm run dev          # start server + widget dev server
npm run type-check   # TypeScript across all workspaces
npm run lint         # ESLint
npm run inspect      # test the tool with MCP Inspector
```
