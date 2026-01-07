# AI Agent Guide: Pine Script Static Checker

Context document for AI agents working on this codebase.

## Architecture

```
pine-script-extension/
├── client/src/extension.ts    # VS Code extension entry, starts Language Server
├── server/
│   ├── src/server.ts          # LSP server, handles hover/completion
│   ├── src/analyzer.ts        # Core type infection analysis
│   ├── src/types.ts           # PineType, Qualifier enum
│   └── src/data/definitions.json  # Function signatures (800+ functions)
└── wasm/tree-sitter-pinescript.wasm  # Parser (no native binaries)
```

## Key Files

### `analyzer.ts`
- **Symbol Table**: Tracks variable types (`Map<string, PineType>`)
- **Built-ins**: Pre-populated with `open`, `high`, `low`, `close`, `volume`, etc.
- **Type Inference**: Handles literals, identifiers, binary expressions, function calls
- **input.* Handling**: Returns `Input` qualifier for `input.int()`, `input.float()`, etc.
- **Unknown Types**: Silently skipped to avoid false positives

### `definitions.json`
- 800+ Pine Script functions with signatures
- Many have `UNKNOWN_REQUIRES_MANUAL_REVIEW` - these need completion
- Key functions like `ta.sma`, `ta.ema` have full type info

### `types.ts`
```typescript
enum Qualifier { Const = 0, Input = 1, Simple = 2, Series = 3 }
interface PineType { name: string; qualifier: Qualifier }
```

## Type Infection Rules

1. **Qualifier Hierarchy**: Const < Input < Simple < Series
2. **Passing Rule**: Lower qualifier can be passed where higher is expected
3. **Infection**: When a Simple var is assigned Series, it becomes Series
4. **Error Case**: Series value passed to Simple parameter → diagnostic

## Common Tasks

### Add New Built-in Variables
Edit `analyzer.ts` → `initializeBuiltIns()`:
```typescript
this.symbolTable.set('bar_index', { name: 'int', qualifier: Qualifier.Series });
```

### Add Function Definitions
Edit `definitions.json`:
```json
{
  "name": "ta.ema",
  "returnType": "series float",
  "params": [
    { "name": "source", "type": "series float", "required": true },
    { "name": "length", "type": "simple int", "required": true }
  ]
}
```

### Regenerate WASM
```bash
cd tree-sitter-pinescript
npx tree-sitter build --wasm
cp tree-sitter-pinescript.wasm ../pine-script-extension/server/wasm/
```

## Build Commands

```bash
cd pine-script-extension
cd client && npm run compile
cd ../server && npm run compile
cd .. && npx @vscode/vsce package --allow-missing-repository
```
