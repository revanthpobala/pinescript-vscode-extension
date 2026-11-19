# AI Agent Guide: Pine Script Static Checker

Welcome, Agent. This document covers the core philosophies and maintenance workflows of the **Pine Script Pro** linter.

---

## 🏛️ Architecture

```
pine-script-extension/
├── client/src/extension.ts        # Language Client entry point
├── server/
│   ├── src/                       # Production Source Code
│   │   ├── server.ts              # LSP server (Hover, Completion, Signature)
│   │   ├── analyzer.ts            # Core Logic: Type Analysis & Symbol Collection
│   │   └── data/definitions.json  # Metadata for 800+ built-in functions
│   ├── test/                      # Automated Quality Tests
│   │   ├── cases.json             # 29+ core verification scenarios
│   │   └── test_runner.ts         # Custom test harness
│   └── tools/                     # Development Utilities
│       └── debug_diagnostics.js   # CLI debugger for local script analysis
└── tree-sitter-pinescript/        # Grammar Source (Patched scanner.c)
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

1.  **Add a Test Case**: Edit `pine-script-extension/server/test/cases.json`.
2.  **Format**:
    ```json
    {
      "name": "Describe the test",
      "code": "pine code here",
      "expectedErrors": 1,
      "errorMessages": ["Expected error message fragment"]
    }
    ```
    `cases.json` is an array of test-case objects. Each case requires `name` (string), `code` (Pine Script source string), and `expectedErrors` (exact count of error diagnostics).

    `errorMessages` is an optional array of case-sensitive message substrings. Every entry must appear in at least one diagnostic message (error or warning); omitting it or using an empty array skips message assertions. Use `errorMessages`, not `expectedMessages`, which the runner does not read. The optional `expectedWarnings` field asserts the exact warning count.

3.  **Run Tests**:
    ```bash
    cd pine-script-extension/server
    npm run build
    node out/test/test_runner.js
    ```

---

## 🔧 Maintenance Workflows

### Updating Built-ins
 Built-in metadata (parameters, return types) is stored in `src/data/definitions.json`. This file is partially managed by `tools/update_core_params.js`. If you add logic for a new namespace (e.g., `request.*`), update either the JSON or the script.

### Handling WASM Crashes
The `tree-sitter-pinescript/src/scanner.c` has been modified to disable the indentation scanner. This prevents WASM heap overflows but results in more `ERROR` nodes in the AST. Always verify the `analyzer.ts` resilient collection if adding new parsing logic.

---

## 🚀 Build & Publish Commands

```bash
cd pine-script-extension

# Build
npm run postinstall  # Installs all sub-dependencies
npm run bundle       # Bundles client/server with esbuild
npx vsce package     # Generates VSIX

# Publish (Dual-Registry)
npm run publish:vscode  # Publishes to VS Code Marketplace
npm run publish:ovsx    # Publishes to Open VSX Registry
```
