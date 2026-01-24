# Pine Script Pro: Project Workspace

This repository contains the source code for **Pine Script Pro**, a high-performance VS Code extension for TradingView developers, along with its custom Tree-sitter grammar.

## 📁 Repository Structure

- [**pine-script-extension/**](pine-script-extension/): The primary VS Code extension source.
  - See the [**Extension Guide**](pine-script-extension/README.md) for full features and visuals.
- [**tree-sitter-pinescript/**](tree-sitter-pinescript/): Custom grammar for Pine Script v6 (Patched for WASM stability).

---

## ✨ Features at a Glance

| Feature | Description | Preview |
| :--- | :--- | :--- |
| **Real-time Diagnostics** | Catch logic errors like namespace misuse. | ![Diagnostics](pine-script-extension/resources/screenshot-linter-diagnostics.png) |
| **Hover Tooltips** | See function signatures and types instantly. | ![Hover ATR](pine-script-extension/resources/screenshot-hover-atr.png) |

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
The project includes a dedicated test suite for verifying linter logic and type inference.

```bash
cd pine-script-extension/server
npm run build
node out/test/test_runner.js
```
*Note: New test cases should be added to `pine-script-extension/server/test/cases.json`.*

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

## ⚠️ Disclaimer

**NOT FINANCIAL ADVICE**. This software is for development purposes only. The author (**Revanth Pobala**) is not responsible for any financial losses. Use at your own risk.

## ⚖️ License
This project is licensed under a modified MIT License. **Mandatory attribution to Revanth Pobala is required** for any usage of the code (including single lines or snippets). See [LICENSE.txt](LICENSE.txt) for full details.
