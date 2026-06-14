# Changelog
 
## [1.3.0] - 2026-06-13
### Added
- **Go to Definition**: Navigate directly to variable declarations and user-defined functions by using `Cmd+Click` (`F12`). Accurately respects lexical block-scoping.
- **Inlay Hints**: Native inline parameter labels (e.g., `source:`, `length:`) automatically populate for built-in Pine Script functions and your custom methods.
- **Auto-Formatter**: A safe, non-destructive formatting provider that automatically standardizes spacing around assignment operators (`=`, `:=`) and commas without mangling syntax.
- **Test-Driven Architecture**: Fully integrated LSP feature tests into the `test_runner.ts` framework, boosting suite to 50 active regression tests.
## [1.2.1] - 2026-05-29
### Fixed
- **False Positive: `plot(close)` flagged as error** — `title` and `show_last` were incorrectly marked as required in `definitions.json`. Only `series` is required for `plot()`. Resolves [#2](https://github.com/revanthpobala/pinescript-vscode-extension/issues/2).
- **False Positives across all `plot*` functions** — Corrected 16 parameters marked `optional: false` that are genuinely optional per the Pine Script v5/v6 reference:
  - `plot`: `title`, `show_last`
  - `plotshape`: `title`, `text`, `show_last`
  - `plotchar`: `title`, `char`, `text`, `show_last`
  - `plotarrow`: `title`, `show_last`
  - `plotbar`: `show_last`
  - `plotcandle`: `show_last`
  - `barcolor`: `show_last`
  - `bgcolor`: `show_last`
  - `hline`: `title`
- **Restored zero-arg validation for `plotshape()` and `plotchar()`** — Removed them from the `RELAXED_PARAM_FUNCTIONS` bypass now that their metadata is correct. `plotshape()` and `plotchar()` with no arguments will now correctly report an error.
- **Test coverage**: Added 18 new regression test cases (suite: 46 passing, 0 failing).

## [1.2.0] - 2026-03-01
### Infrastructure
- **Dependency Upgrade**: Major modernization of the development stack.
    - Upgraded `typescript` to `^5.9.3` for improved type inference and performance.
    - Upgraded `@types/node` to `^22.0.0` to match modern runtime requirements.
    - Updated `web-tree-sitter` to `^0.26.6` for improved stability in the WASM parser.
    - Updated `esbuild` to `^0.27.3` for faster and more reliable bundling.
- **Project Maintenance**: Synchronized dependencies across Root, Client, and Server to ensure build consistency.
- **Ecosystem Recognition**: Formally added to the `awesome-pinescript` community resource.
 
## [1.1.2] - 2026-01-24
### Stability & Precision
- **Relaxed Argument Validation**: Implemented smart validation relaxation for built-ins with flexible signatures (`nz`, `fill`, `plotchar`, `plotshape`, `log.info`, `log.warning`, `log.error`). This eliminates hundreds of false positive "Missing required arguments" errors in large scripts.
- **Enhanced Linter Logic**: Refined handling of dual-use identifiers (like `alert` and `plot`) to prevent "Namespace misuse" false positives while maintaining strict validation for true misuse (e.g., `ta()`).
- **Void Expression Checker**: Hardened enforcement of void-return rules for v6. Functions returning void are now reliably blocked from being used as expressions.
- **Improved Namespace Support**: Added the `log` namespace to support the latest Pine Script v6 native logging features.
- **Exhaustive Verification**: Successfully verified the analyzer's accuracy against a massive 200k+ line local trading repository with zero false positives on production code.

### Infrastructure
- **Clean Project Architecture**: Reorganized the server codebase into strict `src/`, `test/`, and `tools/` directories for better maintainability.
- **Robust Build System**: Automated the bundling of WASM and Pine Script metadata into the final extension package, ensuring 100% environment compatibility.
- **Automated Quality Testing**: Integrated a new test runner with 29+ core regression scenarios to ensure long-term stability.
### Fixed
- **Critical Memory Leak**: Resolved a major memory leak in the Tree-sitter WASM runtime by ensuring explicit deletion of syntax trees.
- **Memory Optimization**: Refactored internal traversal loops to use native WASM accessors, preventing `memory access out of bounds` errors on scripts over 5000 lines.
- **Improved Symbol Collection**: Added a regex-based fallback to harvest function definitions even when the parser encounters fragmented syntax (resolves common "Undefined function" false positives).
- **Shadowing Support**: Allowed local variables and parameters to share names with standard namespaces (e.g., `size`, `color`), fixing "Cannot assign to read-only" errors.
- **Descriptive Type Handling**: improved extraction of return types from core library methods with complex documentation strings.
- **Parameter Alignment**: Fixed a bug in `plotshape` and other multi-argument functions where syntax errors would cause positional arguments to shift wrongly.
- **Signature Help**: Hardened parameter detection to resist fractured AST nodes in broken code.

### Added
- **AST Caching**: Implemented per-document syntax tree caching to reduce CPU usage and improve response times for Hover, Completion, and Signature Help.

## [1.1.0] - 2026-01-05
### Added
- **Pine Script v6 Support**: Full support for newest Pine Script types and methods.
- **User-Defined Types (UDT)**: Intelligent tooltips and type checking for custom types and constructors.
- **Anonymous Functions**: Support for `=>` syntax in assignments and variable declarations.
- **Enhanced Global Search**: Improved symbol resolution across large files.
