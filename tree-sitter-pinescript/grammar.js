module.exports = grammar({
  name: 'pinescript',

  // Extras are tokens that can appear anywhere (whitespace, comments)
  extras: $ => [
    $.comment,
    /[ \t\uFEFF\u2060\u200B\u00A0]/
  ],

  // External tokens handled by scanner.c (for indentation)
  // Must match enum in scanner.c: NEWLINE, INDENT, DEDENT
  externals: $ => [
    $._newline,
    $._indent,
    $._dedent
  ],

  conflicts: $ => [
    [$.conditional_expression, $._expression],
    [$.binary_expression, $.conditional_expression],
    [$.parameter_list, $._expression],
    [$.parameter, $._expression],
    [$.history_reference, $._expression]
  ],

  rules: {
    source_file: $ => repeat($._statement),

    _statement: $ => choice(
      $.version_directive,
      $.variable_declaration,
      $.function_definition,
      $.assignment,
      $.function_call,
      $.if_statement,
      $.for_statement,
      $._newline
    ),

    comment: $ => token(seq('//', /.*/)),

    version_directive: $ => seq('//@version=', /\d+/),

    // Example: "var int x = 10" or "x = 10" or "[x, y] = request.security(...)"
    variable_declaration: $ => seq(
      optional(choice('var', 'varip')),
      optional($.type),
      field('name', choice(
        $.identifier,
        $.tuple_declaration
      )),
      '=',
      field('value', $._expression)
    ),

    // Example: "myFunc(float x, y) => x + y"
    function_definition: $ => seq(
      field('name', $.identifier),
      '(',
      optional(field('parameters', $.parameter_list)),
      ')',
      '=>',
      field('body', choice($._expression, $.block))
    ),

    parameter_list: $ => seq(
      $.parameter,
      repeat(seq(',', $.parameter))
    ),

    parameter: $ => seq(
      optional($.type),
      $.identifier
    ),

    tuple_declaration: $ => seq(
      '[',
      sep1($.identifier, ','),
      ']'
    ),

    assignment: $ => seq(
      field('name', choice($.identifier, $.tuple_declaration)),
      ':=',
      field('value', $._expression)
    ),

    function_call: $ => seq(
      field('function', $.identifier),
      '(',
      optional($.argument_list),
      ')'
    ),

    argument_list: $ => seq(
      $.argument,
      repeat(seq(',', $.argument))
    ),

    argument: $ => choice(
      $._expression,
      seq(field('name', $.identifier), '=', field('value', $._expression))
    ),

    // Control Structures rely on Indent/Dedent from scanner.c
    if_statement: $ => seq(
      'if',
      field('condition', $._expression),
      optional(':'), // Make colon optional
      $.block
    ),

    for_statement: $ => seq(
      'for',
      field('variable', $.identifier),
      'in',
      $._expression,
      $.block
    ),

    block: $ => seq(
      $._indent,
      repeat1($._statement),
      $._dedent
    ),

    _expression: $ => choice(
      $.identifier,
      $.number,
      $.string,
      $.bool_literal,
      $.function_call,
      $.binary_expression,
      $.conditional_expression,
      $.history_reference,
      $.unary_expression,
      seq('(', $._expression, ')')
    ),

    bool_literal: $ => choice('true', 'false'),

    unary_expression: $ => prec(3, seq(
      choice('not', '-', '+'),
      $._expression
    )),

    history_reference: $ => prec(4, seq(
      $._expression,
      '[',
      $._expression,
      ']'
    )),

    conditional_expression: $ => prec.right(0, seq(
      field('condition', $._expression),
      '?',
      field('consequence', $._expression),
      ':',
      field('alternative', $._expression)
    )),

    binary_expression: $ => choice(
      prec.left(2, seq($._expression, choice('*', '/', '%'), $._expression)),
      prec.left(1, seq($._expression, choice('+', '-'), $._expression)),
      prec.left(0, seq($._expression, choice('>', '<', '>=', '<=', '==', '!='), $._expression)),
      prec.left(-1, seq($._expression, choice('and', 'or'), $._expression))
    ),

    type: $ => seq(
      choice(
        'int', 'float', 'bool', 'string', 'color', 'label', 'line', 'linefill', 'table', 'box', 'polyline', 'chart.point'
      ),
      optional('[]')
    ),

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_.]*/,

    number: $ => /\d+(\.\d+)?/,

    string: $ => choice(
      seq("'", /[^']*/, "'"),
      seq('"', /[^"]*/, '"')
    )
  }
});

function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}
