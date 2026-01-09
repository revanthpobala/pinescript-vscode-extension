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

  word: $ => $._identifier,

  conflicts: $ => [
    [$.conditional_expression, $._expression],
    [$.binary_expression, $.conditional_expression],
    [$.parameter_list, $._expression],
    [$.parameter, $._expression],
    [$.parameter, $.argument],
    [$.return_statement, $._expression],
    [$.function_definition, $.function_call, $._expression],
    [$.type, $.identifier],
    [$.type, $._expression],
    [$.simple_declaration, $.binary_expression],
    [$.tuple_declaration, $._expression],
    [$.history_reference, $._expression],
    [$.if_expression, $.binary_expression],
    [$.if_expression],
    [$._statement, $._statement]
  ],

  rules: {
    source_file: $ => repeat($._statement),

    _statement: $ => choice(
      $.version_directive,
      $.import_statement,
      $.variable_declaration,
      $.simple_declaration,
      $.function_definition,
      $.method_definition,
      $.type_definition,
      $.assignment,
      $.compound_assignment,
      $.if_statement,
      $.for_statement,
      $.continue_statement,
      $.break_statement,
      $.return_statement,
      $.expression_statement,
      $._newline,
      prec.left(1, seq($._statement, ',', $._statement)) // Support multiple statements on one line (commas)
    ),

    comment: $ => token(seq('//', /.*/)),

    version_directive: $ => seq('//@version=', /\d+/),

    import_statement: $ => seq(
      'import',
      field('library', $.library_path),
      optional(seq('as', field('alias', $.identifier)))
    ),

    library_path: $ => /[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+\/\d+/,

    // Example: "var int x = 10" or "x = 10" or "[x, y] = request.security(...)"
    // Example: "var int x = 10" or "int x = 10"
    variable_declaration: $ => prec.dynamic(5, seq(
      choice(
        seq(choice('var', 'varip'), optional($.type)),
        $.type
      ),
      field('name', choice(
        $.identifier,
        $.tuple_declaration,
        $.member_access,
        $.function_call
      )),
      '=',
      field('value', $._expression)
    )),

    // Example: "x = 10"
    simple_declaration: $ => prec(1, seq(
      field('name', choice(
        $.identifier,
        $.tuple_declaration,
        $.member_access,
        $.function_call
      )),
      '=',
      field('value', $._expression)
    )),

    // Example: "myFunc(float x, y) => x + y"
    function_definition: $ => seq(
      optional('export'),
      field('name', $.identifier),
      '(',
      optional(field('parameters', $.parameter_list)),
      ')',
      '=>',
      field('body', choice($._expression, $.block))
    ),

    method_definition: $ => seq(
      optional('export'),
      'method',
      field('name', $.identifier),
      '(',
      optional(field('parameters', $.parameter_list)),
      ')',
      '=>',
      field('body', choice($._expression, $.block))
    ),

    type_definition: $ => seq(
      'type',
      field('name', $.identifier),
      $.block
    ),

    parameter_list: $ => seq(
      $.parameter,
      repeat(seq(',', $.parameter))
    ),

    parameter: $ => seq(
      optional($.qualifier),
      optional($.type),
      $.identifier,
      optional(seq('=', $._expression))
    ),

    qualifier: $ => choice(
      'series', 'simple', 'const', 'input'
    ),

    tuple_declaration: $ => seq(
      '[',
      seq(optional($.type), $.identifier),
      repeat(seq(',', seq(optional($.type), $.identifier))),
      ']'
    ),

    assignment: $ => seq(
      field('name', choice($.identifier, $.tuple_declaration, $.member_access, $.function_call)),
      ':=',
      field('value', $._expression)
    ),

    compound_assignment: $ => seq(
      field('name', $.identifier),
      choice('+=', '-=', '*=', '/=', '%='),
      field('value', $._expression)
    ),

    function_call: $ => prec(2, seq(
      field('function', choice($.identifier, $.member_access)),
      '(',
      optional($.argument_list),
      ')'
    )),

    member_access: $ => prec(5, seq(
      field('object', $._expression),
      '.',
      field('member', $.identifier)
    )),

    argument_list: $ => seq(
      $.argument,
      repeat(seq(',', $.argument))
    ),

    argument: $ => choice(
      $._expression,
      prec(3, seq(field('name', $.identifier), '=', field('value', $._expression)))
    ),

    // Control Structures rely on Indent/Dedent from scanner.c
    if_statement: $ => seq(
      'if',
      field('condition', $._expression),
      optional(':'), // Make colon optional
      $.block
    ),

    for_statement: $ => choice(
      // for i in array
      seq(
        'for',
        field('variable', $.identifier),
        'in',
        $._expression,
        $.block
      ),
      // for i = 0 to 10
      seq(
        'for',
        field('variable', $.identifier),
        '=',
        field('start', $._expression),
        'to',
        field('end', $._expression),
        optional(seq('by', field('step', $._expression))),
        $.block
      )
    ),

    continue_statement: $ => 'continue',
    break_statement: $ => 'break',

    return_statement: $ => choice(
      prec(2, seq('return', $._expression)),
      prec(1, 'return')
    ),

    expression_statement: $ => prec(10, $._expression),

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
      $.member_access,
      $.tuple_expression,
      prec(1, $.function_call),
      $.binary_expression,
      $.conditional_expression,
      $.unary_expression,
      $.history_reference,
      $.if_expression,
      seq('(', $._expression, ')')
    ),

    tuple_expression: $ => seq(
      '[',
      $._expression,
      repeat(seq(',', $._expression)),
      ']'
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

    if_expression: $ => prec.right(1, seq(
      'if',
      field('condition', $._expression),
      field('then', choice($._expression, $.block)),
      optional(seq('else', field('else', choice($._expression, $.block))))
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

    identifier: $ => choice(
      choice('int', 'float', 'bool', 'string', 'color', 'label', 'line', 'table', 'box'),
      $._identifier
    ),

    _identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,

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
