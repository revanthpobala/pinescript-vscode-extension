# Pine Script Pro: Project Workspace

This repository contains the source code for **Pine Script Pro**, a high-performance VS Code extension for TradingView developers, along with its custom Tree-sitter grammar.

## 📁 Repository Structure

- [**pine-script-extension/**](pine-script-extension/): The primary VS Code extension source.
  - **client/**: VS Code side integration (Language Client).
  - **server/**: The "Pine Script Pro" analyzer (Language Server).
  - **server/scripts/**: Maintenance scripts for metadata.
- [**tree-sitter-pinescript/**](tree-sitter-pinescript/): Custom grammar for Pine Script v6 (Patched for WASM stability).

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher.
- **npm**: v9.0.0 or higher.

### Quick Installation (VSIX)
The easiest way to use Pine Script Pro is to install the pre-compiled extension:
1. Download the latest `pine-script-pro-1.0.0.vsix` from [Releases](https://github.com/revanthpobala/pinescript-vscode-extension/releases).
2. In VS Code, run `Cmd+Shift+P` → **Extensions: Install from VSIX...**
3. Select the file and restart VS Code.

### Building from Source
If you want to contribute or build the extension yourself:

```bash
# 1. Clone the repository
git clone https://github.com/revanthpobala/pinescript-vscode-extension.git
cd pinescript-vscode-extension/pine-script-extension

# 2. Install dependencies (Top-level, Client, and Server)
npm run postinstall

# 3. Build the Extension
# This compiles TypeScript and bundles everything with esbuild
npm run bundle

# 4. Package as VSIX
npx vsce package
```

---

## 🛠 Developer Guide

### Running Quality Tests
The project includes a dedicated test suite for verifying linter logic and type infection.

```bash
cd pine-script-extension/server
npm run compile
node out/tests/test_runner.js
```
*Note: New test cases should be added to `pine-script-extension/server/src/tests/cases.json`.*

### Updating Built-in Metadata
To update function signatures or return types in the linter:
1. Edit `pine-script-extension/server/scripts/update_core_params.js`.
2. Run the script:
   ```bash
   cd pine-script-extension/server/scripts
   node update_core_params.js
   ```

### Regenerating the Parser (Tree-Sitter)
If you modify the grammar:
```bash
cd tree-sitter-pinescript
npx tree-sitter build --wasm
cp tree-sitter-pinescript.wasm ../pine-script-extension/server/wasm/
```

---

## ⚖️ License
This project is licensed under the MIT License. Developed for the Pine Script community.
