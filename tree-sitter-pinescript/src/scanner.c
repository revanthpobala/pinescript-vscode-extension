#include "tree_sitter/parser.h"
#include <stdint.h>
#include <stdlib.h>

// External tokens - must match grammar.js externals order
enum TokenType {
  NEWLINE,
  INDENT,
  DEDENT,
};

#define STACK_SIZE 32

typedef struct {
  uint16_t stack[STACK_SIZE];
  uint8_t stack_depth;
} Scanner;

void *tree_sitter_pinescript_external_scanner_create() {
  Scanner *scanner = (Scanner *)calloc(1, sizeof(Scanner));
  if (scanner) {
    scanner->stack[0] = 0;
    scanner->stack_depth = 1;
  }
  return scanner;
}

void tree_sitter_pinescript_external_scanner_destroy(void *payload) {
  free(payload);
}

unsigned tree_sitter_pinescript_external_scanner_serialize(void *payload,
                                                           char *buffer) {
  Scanner *scanner = (Scanner *)payload;
  unsigned size = 0;
  buffer[size++] = (char)scanner->stack_depth;
  for (uint8_t i = 0; i < scanner->stack_depth &&
                      size + 1 < TREE_SITTER_SERIALIZATION_BUFFER_SIZE;
       i++) {
    buffer[size++] = (char)(scanner->stack[i] & 0xFF);
    buffer[size++] = (char)((scanner->stack[i] >> 8) & 0xFF);
  }
  return size;
}

void tree_sitter_pinescript_external_scanner_deserialize(void *payload,
                                                         const char *buffer,
                                                         unsigned length) {
  Scanner *scanner = (Scanner *)payload;
  scanner->stack_depth = 1;
  scanner->stack[0] = 0;
  if (length > 0) {
    scanner->stack_depth = (uint8_t)buffer[0];
    if (scanner->stack_depth > STACK_SIZE)
      scanner->stack_depth = STACK_SIZE;
    unsigned size = 1;
    for (uint8_t i = 0; i < scanner->stack_depth && size + 1 < length; i++) {
      scanner->stack[i] = (uint16_t)((uint8_t)buffer[size] |
                                     (((uint8_t)buffer[size + 1]) << 8));
      size += 2;
    }
  }
}

static void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

bool tree_sitter_pinescript_external_scanner_scan(void *payload, TSLexer *lexer,
                                                  const bool *valid_symbols) {
  Scanner *scanner = (Scanner *)payload;

  // 1. Check for EOF and Dedent everything
  if (lexer->eof(lexer)) {
    if (scanner->stack_depth > 1 && valid_symbols[DEDENT]) {
      scanner->stack_depth--;
      lexer->result_symbol = DEDENT;
      return true;
    }
    return false;
  }

  // 2. Scan leading whitespace/newlines
  bool has_newline = false;
  uint16_t indent_column = 0;

  while (lexer->lookahead == ' ' || lexer->lookahead == '\t' ||
         lexer->lookahead == '\r' || lexer->lookahead == '\n') {
    if (lexer->lookahead == '\n') {
      has_newline = true;
      indent_column = 0;
    } else if (lexer->lookahead == ' ') {
      indent_column++;
    } else if (lexer->lookahead == '\t') {
      indent_column += 4;
    }
    skip(lexer);
  }

  // 3. Emit tokens based on indentation change
  if (has_newline) {
    uint16_t current_indent = scanner->stack[scanner->stack_depth - 1];

    if (indent_column > current_indent && valid_symbols[INDENT]) {
      if (scanner->stack_depth < STACK_SIZE) {
        scanner->stack[scanner->stack_depth++] = indent_column;
        lexer->result_symbol = INDENT;
        return true;
      }
    } else if (indent_column < current_indent && valid_symbols[DEDENT]) {
      scanner->stack_depth--;
      lexer->result_symbol = DEDENT;
      return true;
    } else if (valid_symbols[NEWLINE]) {
      lexer->result_symbol = NEWLINE;
      return true;
    }
  }

  return false;
}
