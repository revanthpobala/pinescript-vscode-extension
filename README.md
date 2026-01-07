# Pine Script Pro: Project Workspace

This repository contains the source code for **Pine Script Pro**, a high-performance VS Code extension for TradingView developers, along with its custom Tree-sitter grammar.

## 📁 Repository Structure

- [**pine-script-extension/**](pine-script-extension/): The primary VS Code extension source, including:
  - **Language Client**: VS Code side integration.
  - **Language Server**: The "Pine Script Pro" analyzer (Type system, resilient symbol collection).
  - **WASM Binaries**: Pre-built Tree-sitter parsers.
- [**tree-sitter-pinescript/**](tree-sitter-pinescript/): The custom grammar for Pine Script v6.
  - Includes the **patched `scanner.c`** which ensures stable performance in WebAssembly environments by disabling problematic indentation-based parsing.
- [**pine-script-extension/server/scripts/update_core_params.js**](pine-script-extension/server/scripts/update_core_params.js): Maintenance script for synchronizing built-in function metadata (`definitions.json`).

## 🚀 Getting Started

To install the extension, we recommend using the pre-compiled `.vsix` from the [Releases](https://github.com/revanthpobala/pinescript-vscode-extension/releases) page.

### Source Build

```bash
git clone https://github.com/revanthpobala/pinescript-vscode-extension.git
cd pinescript-vscode-extension/pine-script-extension

# Install dependencies
npm install

# Bundle and Package
npm run bundle
npx vsce package
```

## 🛠 Features Highlights

- **Ultra-Resilient Linter**: Our custom "Greedy Symbol Scrapper" recovers definitions even from broken parse trees.
- **Pine v6 Lambda Support**: Full awareness of assigned functions and anonymous lambdas.
- **High-Performance WASM**: Core parser runs on WebAssembly for sub-millisecond AST generation.

## ⚖️ License

The code in this repository is licensed under the MIT License.
