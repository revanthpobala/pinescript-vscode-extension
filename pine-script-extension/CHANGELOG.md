# Changelog

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
