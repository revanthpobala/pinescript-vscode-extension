# Pine Script Pro

**Pine Script Pro** is a high-performance, professional-grade VS Code extension for TradingView developers. It bridges the gap between script writing and professional software development by providing industrial-strength static analysis, intelligent type Checking, and an ultra-resilient engine optimized for Pine Script v6.

---

## 🚀 Why Pine Script Pro?

Unlike generic syntax highlighters, **Pine Script Pro** understands the execution model of Pine Script. Our custom-built analyzer is designed to handle complex indicators, massive libraries, and the latest v6 syntax with near-zero latency.

### 🛡️ Ultra-Resilient Linter (Battle-Tested for Production)
Never get bogged down by thousands of false positives again. Our v1.1.2 engine has been successfully verified against real-world production scripts spanning 200,000+ lines.
- **Zero False-Positive Goal**: Specialized handling for dual-use built-ins (`alert`, `plot`, `box`) and flexible argument signatures (`nz`, `fill`, `log.*`).
- **Greedy Symbol Scrapper**: Automatically identifies user-defined functions and variables even if your code has minor indentation or parse errors.
- **Pine v6 Native Awareness**: Full support for namespaces like `log.`, `chart.point`, and advanced UDT constructors.
- **Optimized for Massive Files**: The WASM-powered engine comfortably processes 10,000+ line scripts with sub-millisecond response times.

### 🧠 Intelligent Developer Features
- **Hover Documentation**: Detailed technical reference for every built-in function, including parameter types and return values.
- **Advanced Diagnostics**: Catch `void` return assignment errors, argument count mismatches, and namespace misuses before you even hit "Save" on TradingView.
- **Contextual Autocomplete**: Organized namespaces (`ta.`, `math.`, `array.`) for lightning-fast discovery.

### ⚡ Blazing Performance
- **WASM Powered**: Core parser runs on WebAssembly for sub-millisecond AST generation.
- **Zero-Dependency Core**: Bundled with `esbuild`, keeping the extension lightweight and fast.

---

## 🎨 Professional Visuals

| Feature | Description | Preview |
| :--- | :--- | :--- |
| **Hover Tooltips** | See function signatures and types instantly. | ![Hover ATR](https://raw.githubusercontent.com/revanthpobala/pinescript-vscode-extension/main/pine-script-extension/resources/screenshot-hover-atr.png) |
| **Real-time Diagnostics** | Catch logic errors like namespace misuse. | ![Diagnostics](https://raw.githubusercontent.com/revanthpobala/pinescript-vscode-extension/main/pine-script-extension/resources/screenshot-linter-diagnostics.png) |
| **Advanced Verification** | Catch void assignments and parameter leaks. | ![Verification](https://raw.githubusercontent.com/revanthpobala/pinescript-vscode-extension/main/pine-script-extension/resources/screenshot-hover-ema.png) |

---

## � Open Source & Contribution

This extension is part of a larger project dedicated to modernizing Pine Script development.
- **Source Code**: [GitHub Repository](https://github.com/revanthpobala/pinescript-vscode-extension)
- **Grammar Source**: [Tree-sitter Pinescript](https://github.com/revanthpobala/pinescript-vscode-extension/tree/main/tree-sitter-pinescript)
- **Author**: [Revanth Pobala](https://github.com/revanthpobala)

If you find a bug or have a suggestion, please open an Issue on GitHub!

---

## ⚠️ Disclaimer & Risk Warning

**NOT FINANCIAL ADVICE**. **Pine Script Pro** is a static analysis tool designed for development and educational purposes only. It is intended to assist in the identification of syntax and logical errors. 

- **No Liability**: The author (**Revanth Pobala**) is not responsible for any financial or monetary losses resulting from the use of this software, its suggestions, or any indicators developed using this tool. 
- **Verification Required**: Trading logic should always be manually verified and backtested on TradingView before deployment. 
- **"As Is"**: This software is provided "as is" without warranty of any kind. Use at your own risk.

---

## 📜 Requirements
- **VS Code**: 1.75.0 or higher.
- **Language**: Pine Script v6 (optimized), compatible with v3, v4, and v5.

---
**License**: Modified MIT. **Mandatory attribution to Revanth Pobala is required** for any usage of the code (including single lines). See root [LICENSE.txt](../LICENSE.txt) for the full legal text and disclaimer.
