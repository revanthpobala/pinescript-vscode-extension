# Changelog

## [1.1.1] - 2026-01-20
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
