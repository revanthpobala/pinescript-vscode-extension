# AI Agent Guide: Pine Script Static Checker

Welcome, Agent. This document covers the core philosophies and maintenance workflows of the **Pine Script Pro** linter.

---

## 🏛️ Architecture

```
pine-script-extension/
├── client/src/extension.ts        # Language Client entry point
├── server/
│   ├── src/server.ts              # LSP server (Hover, Completion, Signature)
│   ├── src/analyzer.ts            # Core Logic: Type Analysis & Symbol Collection
│   ├── src/types.ts               # PineType, Qualifier enum
│   ├── src/data/definitions.json  # Metadata for 800+ built-in functions
│   └── scripts/                   # Maintenance scripts
└── tree-sitter-pinescript/        # Grammer Source (Patched scanner.c)
```

---

## 🛡️ Core Philosophy: The "No Noise" Policy

Because the WASM-based Pine Script parser is sensitive to indentation errors (due to a disabled scanner for stability), it frequently generates `ERROR` nodes in the AST.

**Critical Instruction**: Do NOT report diagnostics on symbols or blocks that the parser doesn't fully understand. We prioritize **zero false positives** over 100% error coverage.

### Resilient Symbol Collection (Greedy Scrapper)
Found in `analyzer.ts` (Pass 1):
- When an `ERROR` node is encountered, we recursively scrape *all* identifiers inside it and add them to the `symbolTable`. 
- This ensures that if a user defines a function inside a messy block, we don't flag its usage as an "Undefined Function" elsewhere.

---

## 🧪 Test-Driven Development (TDD)

All linter logic must be verified via our custom test runner.

1.  **Add a Test Case**: Edit `pine-script-extension/server/src/tests/cases.json`.
2.  **Format**:
    ```json
    {
      "name": "Describe the test",
      "code": "pine code here",
      "expectedErrors": 1,
      "expectedMessages": ["Expected error message fragment"]
    }
    ```
3.  **Run Tests**:
    ```bash
    cd pine-script-extension/server
    npm run compile && node out/tests/test_runner.js
    ```

---

## 🔧 Maintenance Workflows

### Updating Built-ins
 Built-in metadata (parameters, return types) is stored in `definitions.json`. This file is partially managed by `scripts/update_core_params.js`. If you add logic for a new namespace (e.g., `request.*`), update either the JSON or the script.

### Handling WASM Crashes
The `tree-sitter-pinescript/src/scanner.c` has been modified to disable the indentation scanner. This prevents WASM heap overflows but results in more `ERROR` nodes in the AST. Always verify the `analyzer.ts` resilient collection if adding new parsing logic.

---

## 🚀 Build Commands

```bash
cd pine-script-extension
npm run postinstall  # Installs all sub-dependencies
npm run bundle       # Bundles client/server with esbuild
npx vsce package     # Generates VSIX
```
