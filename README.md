# Pine Script Pro

<p align="center">
  <img src="pine-script-extension/resources/icon.png" width="128" />
</p>

<p align="center">
  <img src="https://img.shields.io/visual-studio-marketplace/v/revanthpobala.pine-script-pro?style=for-the-badge&color=089981&label=VS%20Code" alt="VS Code Marketplace Version" />
  <img src="https://img.shields.io/visual-studio-marketplace/i/revanthpobala.pine-script-pro?style=for-the-badge&color=007acc" alt="VS Code Installs" />
  <br/>
  <img src="https://img.shields.io/open-vsx/v/revanthpobala/pine-script-pro?style=for-the-badge&color=purple&label=Open%20VSX" alt="Open VSX Version" />
  <img src="https://img.shields.io/open-vsx/dt/revanthpobala/pine-script-pro?style=for-the-badge&color=purple" alt="Open VSX Downloads" />
  <br/>
  <img src="https://img.shields.io/badge/License-Modified%20MIT-orange?style=for-the-badge" alt="License" />
</p>

<p align="center">
  <strong>High-performance VS Code extension for TradingView developers.</strong><br>
  Industrial-strength static analysis, intelligent type checking, and ultra-resilient parsing for Pine Script v6.
</p>

---

## ✨ Features at a Glance

| Feature | Description | Preview |
| :--- | :--- | :--- |
| **Real-time Diagnostics** | Catch logic errors like namespace misuse. | ![Diagnostics](pine-script-extension/resources/screenshot-linter-diagnostics.png) |
| **Hover Tooltips** | See function signatures and types instantly. | ![Hover ATR](pine-script-extension/resources/screenshot-hover-atr.png) |
| **Advanced Verification** | Catch `void` assignment errors before deployment. | ![Verification](pine-script-extension/resources/screenshot-hover-ema.png) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher.
- **npm**: v9.0.0 or higher.

### Quick Installation (VSIX)
The easiest way to use Pine Script Pro is to install the pre-compiled extension:
1. Download the latest `pine-script-pro-1.1.2.vsix` from [Releases](https://github.com/revanthpobala/pinescript-vscode-extension/releases/tag/v1.1.2).
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
