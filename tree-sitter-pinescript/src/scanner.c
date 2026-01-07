#include "tree_sitter/parser.h"

// External tokens - must match grammar.js externals order
enum TokenType {
  NEWLINE,
  INDENT,
  DEDENT,
};

void *tree_sitter_pinescript_external_scanner_create() { return NULL; }

void tree_sitter_pinescript_external_scanner_destroy(void *payload) {}

unsigned tree_sitter_pinescript_external_scanner_serialize(void *payload,
                                                           char *buffer) {
  return 0;
}

void tree_sitter_pinescript_external_scanner_deserialize(void *payload,
                                                         const char *buffer,
                                                         unsigned length) {}

bool tree_sitter_pinescript_external_scanner_scan(void *payload, TSLexer *lexer,
                                                  const bool *valid_symbols) {
  // Defer to grammar's built-in whitespace handling.
  // External scanner is a stub - all whitespace/newlines handled by extras in
  // grammar.js
  (void)payload;
  (void)lexer;
  (void)valid_symbols;
  return false;
}
