import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { PineType, Qualifier } from './types';

export interface SyntaxNode {
    type: string;
    text: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    startIndex: number;
    endIndex: number;
    children: SyntaxNode[];
    parent: SyntaxNode | null;
    child(index: number): SyntaxNode | null;
    childForFieldName(name: string): SyntaxNode | null;
    namedChildren: SyntaxNode[];
}

interface FunctionDefinition {
    name: string;
    description: string;
    returnType: string;
    params: { name: string; type: string; required: boolean }[];
}

export class Analyzer {
    private definitions: Map<string, FunctionDefinition>;
    public symbolTable: Map<string, PineType>;
    public usedSymbols: Set<string>;
    public userFunctionTable: Map<string, FunctionDefinition>;

    // Functions that return void - cannot be assigned to variables
    private static readonly VOID_FUNCTIONS = new Set([
        // Alert functions
        'alert', 'alertcondition',
        // Plotting/drawing functions with no return value
        'bgcolor', 'fill', 'plotshape', 'plotchar', 'plotarrow',
        // Object deletion functions
        'line.delete', 'label.delete', 'box.delete', 'table.delete', 'polyline.delete', 'linefill.delete',
        // Object setter functions
        'line.set_x1', 'line.set_x2', 'line.set_y1', 'line.set_y2', 'line.set_xy1', 'line.set_xy2',
        'line.set_color', 'line.set_width', 'line.set_style', 'line.set_extend', 'line.set_xloc',
        'line.set_first_point', 'line.set_second_point',
        'label.set_x', 'label.set_y', 'label.set_xy', 'label.set_text', 'label.set_color',
        'label.set_textcolor', 'label.set_style', 'label.set_size', 'label.set_textalign',
        'label.set_tooltip', 'label.set_xloc', 'label.set_yloc', 'label.set_point',
        'box.set_top', 'box.set_bottom', 'box.set_left', 'box.set_right',
        'box.set_lefttop', 'box.set_rightbottom', 'box.set_bgcolor', 'box.set_border_color',
        'box.set_border_width', 'box.set_border_style', 'box.set_extend', 'box.set_text',
        'box.set_text_color', 'box.set_text_size', 'box.set_text_halign', 'box.set_text_valign',
        'table.delete', 'table.clear', 'table.set_frame_color', 'table.set_frame_width',
        'table.set_border_color', 'table.set_border_width', 'table.set_bgcolor', 'table.set_position',
        'table.cell', 'table.cell_set_text', 'table.cell_set_bgcolor', 'table.cell_set_text_color',
        'table.cell_set_width', 'table.cell_set_height', 'table.cell_set_text_halign',
        'table.cell_set_text_valign', 'table.cell_set_text_size', 'table.cell_set_tooltip',
        'table.cell_set_text_font_family', 'table.merge_cells',
        // Array mutation functions
        'array.clear', 'array.fill', 'array.insert', 'array.push', 'array.remove', 'array.set',
        'array.unshift', 'array.sort', 'array.reverse',
        // Matrix mutation functions
        'matrix.add_row', 'matrix.add_col', 'matrix.remove_row', 'matrix.remove_col',
        'matrix.set', 'matrix.fill', 'matrix.swap_rows', 'matrix.swap_columns', 'matrix.sort',
        // Map mutation functions
        'map.clear', 'map.put', 'map.remove',
        // Strategy functions that return void
        'strategy.entry', 'strategy.exit', 'strategy.order', 'strategy.close', 'strategy.close_all',
        'strategy.cancel', 'strategy.cancel_all',
        // Other void functions
        'runtime.error', 'log.info', 'log.warning', 'log.error',
        'max_bars_back'
    ]);


    // Pine Script keywords that should never be flagged as undefined functions
    private static readonly KEYWORDS = new Set([
        'if', 'else', 'switch', 'for', 'while', 'break', 'continue', 'return',
        'var', 'varip', 'type', 'method', 'export', 'import', 'library', 'true', 'false', 'na'
    ]);

    private static readonly STANDARD_NAMESPACES = new Set([
        'ta', 'math', 'request', 'array', 'matrix', 'table', 'line', 'label', 'box',
        'linefill', 'polyline', 'str', 'time', 'color', 'runtime', 'syminfo', 'ticker',
        'barstate', 'indicator', 'strategy', 'library', 'input'
    ]);

    // Fundamental types, constants, and dual-use terms that are BOTH functions AND variables.
    // These should never be flagged as "using function as variable".
    private static readonly CORE_BUILTINS = new Set([
        // Types
        'int', 'float', 'bool', 'string', 'color', 'label', 'line', 'linefill', 'table', 'box', 'polyline', 'chart.point',
        // Constants (also in keywords but added here for safety)
        'na', 'true', 'false',
        // Built-in variables (series)
        'open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3', 'ohlc4', 'hlcc4', 'time', 'timenow', 'bar_index', 'last_bar_index',
        'high_yesterday', 'low_yesterday', 'close_yesterday', 'open_yesterday',
        // Barstate
        'barstate.isconfirmed', 'barstate.ishistory', 'barstate.islast', 'barstate.islastconfirmedhistory', 'barstate.isnew', 'barstate.isrealtime',
        // Chart
        'chart.bg_color', 'chart.fg_color', 'chart.is_heikinashi', 'chart.is_kagi', 'chart.is_linebreak', 'chart.is_pnf', 'chart.is_range', 'chart.is_renko', 'chart.is_standard',
        'chart.left_visible_bar_index', 'chart.right_visible_bar_index',
        // Syminfo
        'syminfo.basecurrency', 'syminfo.currency', 'syminfo.description', 'syminfo.mintick', 'syminfo.pointvalue', 'syminfo.prefix', 'syminfo.root', 'syminfo.session', 'syminfo.ticker', 'syminfo.tickerid', 'syminfo.timezone', 'syminfo.type',
        // Date/time dual-use (both variable and function in v6) - confirmed in official docs
        'dayofmonth', 'dayofweek', 'month', 'year', 'hour', 'minute', 'second', 'weekofyear',
        // Technical analysis: ONLY ta.tr is dual-use (variable + function). Others like ta.atr, ta.obv are function-only.
        'ta.tr',
        // Strategy variables
        'strategy.account_currency', 'strategy.equity', 'strategy.grossloss', 'strategy.grossprofit', 'strategy.initial_capital', 'strategy.netprofit', 'strategy.openprofit', 'strategy.position_avg_price', 'strategy.position_size',
        // Format constants (NOT functions)
        'format.mintick', 'format.percent', 'format.price', 'format.volume', 'format.inherit',
        // Alert constants
        'alert.freq_once_per_bar', 'alert.freq_once_per_bar_close', 'alert.freq_all',
        // Extend constants
        'extend.none', 'extend.left', 'extend.right', 'extend.both',
        // Line style constants
        'line.style_solid', 'line.style_dashed', 'line.style_dotted', 'line.style_arrow_left', 'line.style_arrow_right', 'line.style_arrow_both',
        // Label style/size/pos constants
        'label.style_none', 'label.style_xcross', 'label.style_cross', 'label.style_triangleup', 'label.style_triangledown',
        'label.style_flag', 'label.style_circle', 'label.style_arrowup', 'label.style_arrowdown', 'label.style_label_up',
        'label.style_label_down', 'label.style_label_left', 'label.style_label_right', 'label.style_label_center',
        'label.style_label_lower_left', 'label.style_label_lower_right', 'label.style_label_upper_left', 'label.style_label_upper_right',
        'label.style_square', 'label.style_diamond', 'label.style_text_outline',
        'size.auto', 'size.tiny', 'size.small', 'size.normal', 'size.large', 'size.huge',
        'position.top_left', 'position.top_center', 'position.top_right', 'position.middle_left', 'position.middle_center',
        'position.middle_right', 'position.bottom_left', 'position.bottom_center', 'position.bottom_right',
        // Shape/Location constants
        'shape.xcross', 'shape.cross', 'shape.triangleup', 'shape.triangledown', 'shape.flag', 'shape.circle',
        'shape.arrowup', 'shape.arrowdown', 'shape.labelup', 'shape.labeldown', 'shape.square', 'shape.diamond',
        'location.abovebar', 'location.belowbar', 'location.top', 'location.bottom', 'location.absolute',
        // Text align/formatting constants
        'text.align_left', 'text.align_center', 'text.align_right', 'text.wrap_auto', 'text.wrap_none', 'text.format_bold', 'text.format_italic', 'text.format_none',
        'text.align_top', 'text.align_bottom',
        // Color constants
        'color.aqua', 'color.black', 'color.blue', 'color.fuchsia', 'color.gray', 'color.green',
        'color.lime', 'color.maroon', 'color.navy', 'color.olive', 'color.orange', 'color.purple',
        'color.red', 'color.silver', 'color.teal', 'color.white', 'color.yellow',
        // Math constants
        'math.e', 'math.phi', 'math.pi', 'math.rphi',
        // Dayofweek constants
        'dayofweek.sunday', 'dayofweek.monday', 'dayofweek.tuesday', 'dayofweek.wednesday',
        'dayofweek.thursday', 'dayofweek.friday', 'dayofweek.saturday',
        // Strategy direction constants
        'strategy.long', 'strategy.short', 'strategy.cash', 'strategy.fixed', 'strategy.percent_of_equity',
        // Barmerge constants
        'barmerge.gaps_off', 'barmerge.gaps_on', 'barmerge.lookahead_off', 'barmerge.lookahead_on',
        // Hline style constants
        'hline.style_solid', 'hline.style_dashed', 'hline.style_dotted',
        // Plot style constants
        'plot.style_line', 'plot.style_linebr', 'plot.style_stepline', 'plot.style_stepline_diamond',
        'plot.style_steplinebr', 'plot.style_area', 'plot.style_areabr', 'plot.style_columns',
        'plot.style_histogram', 'plot.style_circles', 'plot.style_cross',
        // Display constants
        'display.all', 'display.none', 'display.pane', 'display.data_window', 'display.price_scale', 'display.status_line',
        // Order constants
        'order.ascending', 'order.descending',
        // Session constants
        'session.regular', 'session.extended'
    ]);

    constructor(definitionsJson: any) {
        this.definitions = new Map();
        if (definitionsJson && definitionsJson.functions) {
            for (const func of definitionsJson.functions) {
                this.definitions.set(func.name, func);
            }
        }
        this.symbolTable = new Map();
        this.usedSymbols = new Set();
        this.userFunctionTable = new Map();
        this.initializeBuiltIns();
    }

    private initializeBuiltIns() {
        // Namespaces that should be colored but not used as variables
        // These namespaces contain variables/constants accessed via dot notation (e.g., syminfo.ticker)
        [
            'ta', 'math', 'str', 'request', 'strategy', 'array', 'matrix', 'map',
            'chart', 'color', 'input', 'format', 'syminfo', 'barstate', 'ticker',
            'session', 'alert', 'timeframe', 'dividends', 'earnings', 'box', 'label',
            'line', 'table', 'polyline', 'linefill', 'hline', 'plot', 'display',
            'order', 'scale', 'adjustment', 'backadjustment', 'currency', 'font',
            'extend', 'location', 'position', 'shape', 'size', 'text', 'xloc', 'yloc',
            'splits', 'barmerge', 'settlement_as_close'
        ].forEach(ns => {
            this.symbolTable.set(ns, { name: 'namespace', qualifier: Qualifier.Const });
        });

        // Add core variables to symbol table for reference
        Analyzer.CORE_BUILTINS.forEach(b => {
            if (!this.symbolTable.has(b)) {
                this.symbolTable.set(b, { name: 'series float', qualifier: Qualifier.Series });
            }
        });
    }

    public analyze(rootNode: SyntaxNode): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        this.userFunctionTable.clear();
        this.symbolTable.clear();

        // Pre-populate namespaces
        const namespaces = ['ta', 'math', 'strategy', 'syminfo', 'array', 'matrix', 'map', 'line', 'label', 'box', 'table', 'log', 'runtime', 'request', 'ticker', 'time', 'timenow'];
        for (const ns of namespaces) {
            this.symbolTable.set(ns, { name: 'namespace', qualifier: Qualifier.Simple });
        }

        // Pass 1: Collect User Symbols (Functions and Variables)
        const stack: SyntaxNode[] = [rootNode];
        while (stack.length > 0) {
            const node = stack.pop()!;

            // 1. Collect Function and Method Definitions
            if (node.type === 'function_definition' || node.type === 'method_definition') {
                const nameNode = node.childForFieldName('name');
                if (nameNode?.text) {
                    const params: any[] = [];
                    const paramListNode = node.childForFieldName('parameters');
                    if (paramListNode) {
                        for (const p of paramListNode.namedChildren) {
                            if (p.type === 'parameter') {
                                const pNameNode = p.childForFieldName('name') || p.namedChildren.find(c => c.type === 'identifier');
                                if (pNameNode) {
                                    params.push({ name: pNameNode.text, type: 'any', required: true });
                                }
                            }
                        }
                    }
                    this.userFunctionTable.set(nameNode.text, {
                        name: nameNode.text,
                        description: 'User function',
                        returnType: 'any',
                        params: params
                    });
                }
            }

            // 1b. Collect Type Definitions (UDTs)
            if (node.type === 'type_definition') {
                const nameNode = node.childForFieldName('name');
                if (nameNode?.text) {
                    this.symbolTable.set(nameNode.text, { name: 'type', qualifier: Qualifier.Simple });
                    // Also allow Name.new()
                    this.userFunctionTable.set(`${nameNode.text}.new`, {
                        name: `${nameNode.text}.new`,
                        description: 'UDT Constructor',
                        returnType: 'any',
                        params: []
                    });
                }
            }

            // 1c. Collect Import Aliases
            if (node.type === 'import_statement') {
                const aliasNode = node.childForFieldName('alias');
                if (aliasNode?.text) {
                    this.symbolTable.set(aliasNode.text, { name: 'namespace', qualifier: Qualifier.Simple });
                }
            }

            // 2. Collect Variable Declarations (x = 1, x := 2, var x = 3)
            if (node.type === 'variable_declaration' || node.type === 'assignment' || node.type === 'simple_declaration') {
                const nameNode = node.childForFieldName('name') || node.child(0);
                if (nameNode && (nameNode.type === 'identifier' || nameNode.type === 'variable_declaration_left')) {
                    const name = nameNode.type === 'identifier' ? nameNode.text : nameNode.child(0)?.text;
                    if (name) {
                        this.symbolTable.set(name, { name: 'any', qualifier: Qualifier.Simple });
                    }
                }
            }

            // 3. Collect from method/parameter lists even if parent is ERROR
            if (node.type === 'parameter') {
                const nameNode = node.namedChildren.find(c => c.type === 'identifier');
                if (nameNode) {
                    this.symbolTable.set(nameNode.text, { name: 'any', qualifier: Qualifier.Simple });
                }
            }

            // 4. GREEDY: Collect potential definitions inside ERROR nodes
            if (node.type === 'ERROR') {
                const collectIdentifiers = (n: SyntaxNode) => {
                    if (n.type === 'identifier') {
                        // Safe default: assume any identifier in an error zone is a valid symbol/parameter
                        this.symbolTable.set(n.text, { name: 'any', qualifier: Qualifier.Simple });
                    }
                    for (const child of n.children) {
                        collectIdentifiers(child);
                    }
                };
                collectIdentifiers(node);

                // Heuristic for functions defined inside errors
                for (let i = 0; i < node.children.length; i++) {
                    const child = node.children[i];
                    if (child.type === 'identifier') {
                        const next = node.children[i + 1];
                        if (next && next.text === '=>') {
                            this.userFunctionTable.set(child.text, {
                                name: child.text,
                                description: 'User function (recovered)',
                                returnType: 'any',
                                params: []
                            });
                        }
                    }
                }
            }

            for (let i = node.children.length - 1; i >= 0; i--) {
                stack.push(node.children[i]);
            }
        }

        // Pass 2: Visit and Validate
        const visitStack: SyntaxNode[] = [rootNode];
        while (visitStack.length > 0) {
            const node = visitStack.pop()!;

            if (node.type === 'function_call') {
                this.handleFunctionCall(node, diagnostics);
            } else if (node.type === 'variable_declaration' || node.type === 'assignment' || node.type === 'simple_declaration') {
                this.handleAssignment(node, diagnostics);
            } else if (node.type === 'identifier') {
                // Skip identifiers that are part of a definition/assignment to avoid self-reporting
                const parent = node.parent;
                if (parent && (parent.type === 'variable_declaration' || parent.type === 'function_definition' || parent.type === 'parameter')) {
                    if (node === parent.childForFieldName('name') || node === parent.childForFieldName('parameters')) {
                        // Continue to children
                    } else {
                        this.handleIdentifier(node, diagnostics);
                    }
                } else {
                    this.handleIdentifier(node, diagnostics);
                }
            } else if (node.type === 'member_access') {
                this.handleIdentifier(node, diagnostics);
            }

            if (diagnostics.length < 500) {
                for (let i = node.children.length - 1; i >= 0; i--) {
                    visitStack.push(node.children[i]);
                }
            }
        }

        return diagnostics;
    }

    private isInsideError(node: SyntaxNode): boolean {
        let n: SyntaxNode | null = node.parent;
        while (n) {
            if (n.type === 'ERROR') return true;
            n = n.parent;
        }
        // Siblings: If a sibling is an error, the statement is broken
        if (node.parent) {
            for (const child of node.parent.children) {
                if (child.type === 'ERROR') return true;
            }
        }
        return false;
    }

    private handleAssignment(node: SyntaxNode, diagnostics: Diagnostic[]) {
        const nameNode = node.childForFieldName('name') || node.child(0);
        if (!nameNode) return;

        // 1. Check if assigning to a function call (invalid)
        if (nameNode.type === 'function_call') {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: this.getRange(nameNode),
                message: `Cannot assign a value to a function call '${nameNode.text}'.`,
                source: 'Pine Script'
            });
            return;
        }

        // 2. Check if assigning to a built-in namespace or function
        const name = nameNode.text;
        if (this.definitions.has(name) || Analyzer.STANDARD_NAMESPACES.has(name)) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: this.getRange(nameNode),
                message: `Cannot reassign built-in function or namespace '${name}'.`,
                source: 'Pine Script'
            });
            return;
        }

        // 3. Check for member access assignment (usually invalid unless it's a UDT field which we don't fully support yet)
        if (nameNode.type === 'member_access') {
            // For now, most member accesses on built-ins are read-only
            const parts = name.split('.');
            if (Analyzer.STANDARD_NAMESPACES.has(parts[0])) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: this.getRange(nameNode),
                    message: `Cannot assign to built-in property '${name}'.`,
                    source: 'Pine Script'
                });
            }
        }
    }

    private handleIdentifier(node: SyntaxNode, diagnostics: Diagnostic[]) {
        const name = node.text;

        // Skip keywords and core built-ins
        if (Analyzer.KEYWORDS.has(name) || Analyzer.CORE_BUILTINS.has(name)) {
            return;
        }

        // Check user defined functions (when used as variables)
        if (this.userFunctionTable.has(name)) {
            return;
        }

        // Check user defined symbols
        if (this.symbolTable.has(name)) {
            return;
        }

        // Special handling for member access (e.g., syminfo.prefix, session.ismarket)
        // If it starts with a known namespace variable/property block, ignore it as it's a variable access.
        if (node.type === 'member_access') {
            const objectName = name.split('.')[0];
            if (['syminfo', 'session', 'ticker', 'barstate', 'chart', 'indicator', 'strategy'].includes(objectName)) {
                // These are almost always variable/property accesses when used as members
                // UNLESS they are in definitions and have params (like ta.sma which we handle below)
            }
        }

        // Error: Using a function name as a variable
        const definition = this.definitions.get(name);
        const isBuiltIn = definition !== undefined;
        const isUserFunc = this.userFunctionTable.has(name);

        if (isBuiltIn || isUserFunc) {
            // NO NOISE Safely: If the function name is immediately followed by '(',
            // then it's clearly a call, even if the parser failed to group it.
            let next: SyntaxNode | null = null;
            if (node.parent) {
                const children = node.parent.children;
                const idx = children.indexOf(node);
                if (idx !== -1 && idx < children.length - 1) {
                    next = children[idx + 1];
                }
            }

            while (next && (next.type === 'comment')) {
                const children = node.parent!.children;
                const idx = children.indexOf(next);
                next = (idx !== -1 && idx < children.length - 1) ? children[idx + 1] : null;
            }

            if (next && next.text === '(') {
                return;
            }

            // Suppress if inside or sibling to a structural error.
            if (this.isInsideError(node)) {
                return;
            }

            const parent = node.parent;
            if (parent) {
                // Ignore if it's the function being called
                const funcNode = parent.childForFieldName('function');
                const isFuncName = parent.type === 'function_call' && funcNode?.startIndex === node.startIndex;
                if (isFuncName) return;

                // Ignore if it's a named argument (e.g., bgcolor=color.red)
                if (parent.type === 'argument' && parent.childForFieldName('name')?.startIndex === node.startIndex) {
                    return;
                }

                // Ignore if it's a type position in a declaration (variable or parameter)
                if (parent.type === 'variable_declaration' || parent.type === 'parameter') {
                    return;
                }

                // Ignore if this identifier is the NAME of a function definition (arrow function syntax)
                // Check all ancestors, not just immediate parent, because tree-sitter may wrap nodes
                let ancestor: SyntaxNode | null = parent;
                while (ancestor) {
                    if (ancestor.type === 'function_definition') {
                        const nameField = ancestor.childForFieldName('name');
                        if (nameField && nameField.text === name) {
                            return; // This identifier is the function name in its definition
                        }
                    }
                    ancestor = ancestor.parent;
                }

                // Ignore built-ins that are actually variables or namespaces (present in symbolTable)
                if (this.symbolTable.has(name)) {
                    return;
                }

                // New logic: If it's a member access on a known variable namespace, ignore it
                if (node.type === 'member_access') {
                    const objectName = name.split('.')[0];
                    if (['syminfo', 'session', 'ticker', 'barstate'].includes(objectName)) {
                        return;
                    }
                }

                const message = isBuiltIn
                    ? `Cannot use built-in function '${name}' as a variable. Use '${name}()' to call it.`
                    : `Cannot use function '${name}' as a variable. Use '${name}()' to call it.`;

                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: this.getRange(node),
                    message: message
                });
            }
        }
    }

    public formatType(type: PineType): string {
        const qualifierNames = {
            [Qualifier.Const]: 'const',
            [Qualifier.Input]: 'input',
            [Qualifier.Simple]: 'simple',
            [Qualifier.Series]: 'series'
        };
        const qual = qualifierNames[type.qualifier] || '';
        return `${qual} ${type.name}`.trim();
    }

    private handleFunctionCall(node: SyntaxNode, diagnostics: Diagnostic[]) {
        const funcNameNode = node.childForFieldName('function') || node.child(0);
        if (!funcNameNode) return;

        const funcName = funcNameNode.text;
        const isMemberAccess = funcNameNode.type === 'member_access';

        // Skip if it's a keyword (e.g., mis-parsed 'if' statement)
        if (Analyzer.KEYWORDS.has(funcName)) {
            return;
        }

        // 1. Definition Lookup
        let definition = this.definitions.get(funcName) || this.userFunctionTable.get(funcName);
        let isMethodCall = false;

        if (!definition && isMemberAccess) {
            const memberNode = funcNameNode.childForFieldName('member');
            if (memberNode) {
                const memberName = memberNode.text;
                definition = this.definitions.get(memberName) || this.userFunctionTable.get(memberName);
                if (definition) {
                    isMethodCall = true;
                }
            }
        }

        if (!definition) {
            // Phase 15: Strict Built-in matching
            if (isMemberAccess) {
                const parts = funcName.split('.');
                const prefix = parts[0];
                if (Analyzer.STANDARD_NAMESPACES.has(prefix)) {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: this.getRange(funcNameNode),
                        message: `Undefined function '${funcName}' in standard library '${prefix}'.`
                    });
                    return;
                }
            }

            // FALLBACK: If it's not a known function, check if it's a known variable (Symbol).
            const sym = this.symbolTable.get(funcName);
            if (sym) {
                if (sym.name === 'namespace') {
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: this.getRange(funcNameNode),
                        message: `Cannot use namespace '${funcName}' as a function.`
                    });
                    return;
                }
                return;
            }

            // NO NOISE POLICY: If it contains a dot and we're not sure, don't report.
            if (funcName.includes('.')) {
                return;
            }

            // Report as undefined.
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: this.getRange(funcNameNode),
                message: `Undefined function '${funcName}'.`
            });
            return;
        }

        // VOID RETURN CHECK
        // Only consider it void if explicitly marked as 'void' or in our known list.
        // If it's empty string, we treat it as unknown/value-returning to avoid false positives.
        const isVoid = definition.returnType.toLowerCase() === 'void' ||
            Analyzer.VOID_FUNCTIONS.has(funcName);

        if (isVoid) {
            const parent = node.parent;
            if (parent) {
                // EXPLICIT EXPRESSION NODES: These nodes require a value.
                // If a void function is a child of one of these, it's an error.
                const valueExpectedParents = [
                    'argument',
                    'assignment',
                    'variable_declaration',
                    'binary_expression',
                    'unary_expression',
                    'conditional_expression',
                    'history_reference',
                    'return_statement',
                    'math_expression', // In case it's lumped
                ];

                let usedAsValue = valueExpectedParents.includes(parent.type);

                // Special cases for control structures
                if (parent.type === 'if_statement' && node.startIndex === parent.childForFieldName('condition')?.startIndex) {
                    usedAsValue = true;
                }
                if (parent.type === 'for_statement' && node.startIndex === parent.childForFieldName('collection')?.startIndex) {
                    usedAsValue = true;
                }
                if (parent.type === 'if_expression' && node.startIndex === parent.childForFieldName('condition')?.startIndex) {
                    usedAsValue = true;
                }
                if (parent.type === 'for_expression' && node.startIndex === parent.childForFieldName('collection')?.startIndex) {
                    usedAsValue = true;
                }

                if (usedAsValue) {
                    const isAssignment = parent.type === 'variable_declaration' || parent.type === 'assignment';
                    const message = isAssignment
                        ? `Cannot assign result of '${funcName}()' to a variable - this function returns void.`
                        : `Function '${funcName}()' returns void and cannot be used as an expression.`;

                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: this.getRange(node),
                        message: message
                    });
                }
            }
        }

        // PARAMETER COUNT AND REQUIREMENT CHECK
        const argListNode = node.namedChildren.find(c => c.type === 'argument_list');
        const args = argListNode ? argListNode.namedChildren : [];

        // Count provided arguments
        const providedCount = isMethodCall ? args.length + 1 : args.length;
        const requiredParams = definition.params.filter((p: any) => p.required);
        const totalParams = definition.params.length;

        // 1. Check for too many arguments 
        // Only check if we have an explicit parameter list (totalParams > 0)
        // This avoids false positives for functions where we haven't populated the metadata yet.
        if (totalParams > 0 && providedCount > totalParams) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: this.getRange(argListNode || node),
                message: `Too many arguments for '${funcName}()'. Expected at most ${totalParams}, found ${providedCount}.`
            });
        }

        // 2. Check for missing required parameters
        if (totalParams > 0 && providedCount < requiredParams.length) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: this.getRange(funcNameNode),
                message: `Missing required arguments for '${funcName}()'. Expected ${requiredParams.length}, found ${providedCount}.`
            });
        }
    }

    private getRange(node: SyntaxNode): Range {
        return Range.create(
            node.startPosition.row,
            node.startPosition.column,
            node.endPosition.row,
            node.endPosition.column
        );
    }
}
