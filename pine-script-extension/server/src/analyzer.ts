import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { PineType, Qualifier } from './types';

export interface SyntaxNode {
    type: string;
    text: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    startIndex: number;
    endIndex: number;
    childCount: number;
    namedChildCount: number;
    children: SyntaxNode[];
    parent: SyntaxNode | null;
    child(index: number): SyntaxNode | null;
    namedChild(index: number): SyntaxNode | null;
    childForFieldName(name: string): SyntaxNode | null;
    namedChildren: SyntaxNode[];
}

interface FunctionDefinition {
    name: string;
    description: string;
    returnType: string;
    params: { name: string; type: string; required: boolean, desc?: string }[];
}

export class Analyzer {
    private definitions: Map<string, FunctionDefinition>;
    private scopeStack: Map<string, { name: string, qualifier: Qualifier, usageCount: number, range?: Range }>[] = [new Map()];
    public userFunctionTable: Map<string, FunctionDefinition> = new Map();
    private sourceCode: string = ''; // For text-based fallback checks

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
        'barstate', 'indicator', 'strategy', 'library', 'input', 'map', 'chart',
        'format', 'session', 'alert', 'timeframe', 'dividends', 'earnings', 'box', 'label',
        'line', 'table', 'polyline', 'linefill', 'hline', 'plot', 'display',
        'order', 'scale', 'adjustment', 'backadjustment', 'currency', 'font',
        'extend', 'location', 'position', 'shape', 'size', 'text', 'xloc', 'yloc',
        'splits', 'barmerge', 'settlement_as_close'
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
        'session.regular', 'session.extended',
        // xloc constants
        'xloc.bar_index', 'xloc.bar_time',
        // yloc constants
        'yloc.price', 'yloc.abovebar', 'yloc.belowbar',
        // Timeframe constants and variables
        'timeframe.period', 'timeframe.multiplier', 'timeframe.isintraday', 'timeframe.isdaily', 'timeframe.isweekly', 'timeframe.ismonthly', 'timeframe.isdwm',
        // Adjustment constants
        'adjustment.none', 'adjustment.splits', 'adjustment.dividends',
        // Currency constants
        'currency.USD', 'currency.EUR', 'currency.GBP', 'currency.JPY', 'currency.AUD', 'currency.CAD', 'currency.CHF', 'currency.CNY', 'currency.HKD', 'currency.NZD', 'currency.SEK', 'currency.SGD', 'currency.KRW', 'currency.INR', 'currency.RUB', 'currency.TRY', 'currency.ZAR', 'currency.BRL', 'currency.MXN', 'currency.PLN', 'currency.TKL', 'currency.XAU', 'currency.XAG', 'currency.NONE',
        // Font constants
        'font.family_default', 'font.family_monospace',
        // Scale constants
        'scale.left', 'scale.right', 'scale.none'
    ]);

    constructor(definitionsJson: any) {
        this.definitions = new Map();
        if (definitionsJson && definitionsJson.functions) {
            for (const func of definitionsJson.functions) {
                this.definitions.set(func.name, func);
            }
        }
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
            this.define(ns, { name: 'namespace', qualifier: Qualifier.Const });
        });

        // Add core variables to symbol table with specific types
        Analyzer.CORE_BUILTINS.forEach(b => {
            if (!this.getSymbol(b)) {
                let typeName = 'series float';
                const parts = b.split('.');
                const prefix = parts[0];
                const last = parts[parts.length - 1];

                if (b.startsWith('color.')) {
                    typeName = 'color';
                } else if (b.startsWith('hline.style_')) {
                    typeName = 'hline_style';
                } else if (b.startsWith('line.style_')) {
                    typeName = 'line_style';
                } else if (b.startsWith('plot.style_')) {
                    typeName = 'plot_style';
                } else if (b.startsWith('display.')) {
                    typeName = 'plot_display';
                } else if (b.startsWith('size.')) {
                    typeName = 'size';
                } else if (b.startsWith('position.')) {
                    typeName = 'position';
                } else if (b.startsWith('shape.')) {
                    typeName = 'shape';
                } else if (b.startsWith('location.')) {
                    typeName = 'location';
                } else if (b.startsWith('text.align_') || b.startsWith('text.wrap_') || b.startsWith('text.format_')) {
                    typeName = 'text_align';
                } else if (b.startsWith('xloc.')) {
                    typeName = 'xloc';
                } else if (b.startsWith('yloc.')) {
                    typeName = 'yloc';
                } else if (b.startsWith('extend.')) {
                    typeName = 'extend';
                } else if (b.startsWith('barmerge.gaps_')) {
                    typeName = 'barmerge_gaps';
                } else if (b.startsWith('barmerge.lookahead_')) {
                    typeName = 'barmerge_lookahead';
                } else if (b.startsWith('label.style_')) {
                    typeName = 'label_style';
                } else if (b.startsWith('format.')) {
                    typeName = 'format';
                } else if (b.startsWith('alert.freq_')) {
                    typeName = 'alert_freq';
                } else if (b.startsWith('adjustment.')) {
                    typeName = 'adjustment';
                } else if (b.startsWith('currency.')) {
                    typeName = 'currency';
                } else if (b.startsWith('font.')) {
                    typeName = 'font';
                } else if (b.startsWith('scale.')) {
                    typeName = 'scale';
                } else if (b.startsWith('order.')) {
                    typeName = 'order';
                } else if (b.startsWith('session.')) {
                    typeName = 'session';
                } else if (b.startsWith('timeframe.is')) {
                    typeName = 'series bool';
                } else if (b === 'timeframe.period' || b === 'timeframe.multiplier') {
                    typeName = 'series string';
                } else if (prefix === 'strategy') {
                    if (['long', 'short', 'cash', 'fixed', 'percent_of_equity'].includes(last)) typeName = 'strategy_direction';
                    else typeName = 'float';
                } else if (['true', 'false', 'na'].includes(b)) {
                    typeName = 'bool';
                    if (b === 'na') typeName = 'any';
                } else if (['barstate.isconfirmed', 'barstate.ishistory', 'barstate.islast', 'barstate.islastconfirmedhistory', 'barstate.isnew', 'barstate.isrealtime'].includes(b)) {
                    typeName = 'series bool';
                } else if (['bar_index', 'last_bar_index', 'time', 'timenow', 'year', 'month', 'dayofmonth', 'dayofweek', 'hour', 'minute', 'second', 'weekofyear'].includes(b)) {
                    typeName = 'series int';
                }

                this.define(b, { name: typeName, qualifier: Qualifier.Series });
            }
        });
    }

    private define(name: string, info: { name: string, qualifier: Qualifier }, node?: SyntaxNode) {
        const scope = this.scopeStack[this.scopeStack.length - 1];
        if (scope) {
            // Store valid range if node provided, else undefined
            const range = node ? this.getRange(node) : undefined;
            scope.set(name, { ...info, usageCount: 0, range });
        }
    }

    public getSymbol(name: string): { name: string, qualifier: Qualifier, usageCount?: number } | undefined {
        for (let i = this.scopeStack.length - 1; i >= 0; i--) {
            if (this.scopeStack[i].has(name)) return this.scopeStack[i].get(name);
        }
        return undefined;
    }

    // New validation helper
    private extractParameters(paramsNode: SyntaxNode | null | undefined): any[] {
        const params: any[] = [];
        if (!paramsNode) return params;

        const pCount = paramsNode.childCount;
        for (let i = 0; i < pCount; i++) {
            const p = paramsNode.child(i);
            if (!p) continue;
            if (p.type === 'parameter' || p.type === 'identifier' || p.type === 'simple_parameter') {
                let pNameNode = p.childForFieldName('name');
                if (!pNameNode) {
                    for (let j = p.childCount - 1; j >= 0; j--) {
                        const c = p.child(j);
                        if (c?.type === 'identifier') { pNameNode = c; break; }
                    }
                }
                if (!pNameNode && p.type === 'identifier') pNameNode = p;

                if (pNameNode) {
                    const pTypeNode = p.childForFieldName('type');
                    const isOptional = p.text.includes('=') || p.text.includes(':=');
                    params.push({
                        name: pNameNode.text,
                        type: pTypeNode?.text || 'any',
                        required: !isOptional
                    });
                }
            } else if (p.type === 'variadic_parameter') {
                params.push({ name: p.text, type: 'any', required: false });
            }
        }
        return params;
    }

    private extractParametersFromCall(callNode: SyntaxNode): any[] {
        const params: any[] = [];
        const argListNode = callNode.childForFieldName('arguments') || callNode.namedChildren.find(c => c.type === 'argument_list');
        if (argListNode) {
            for (const arg of argListNode.namedChildren) {
                const findRightmostId = (n: SyntaxNode): string | null => {
                    if (n.type === 'identifier') return n.text;
                    if (n.namedChildren.length > 0) {
                        return findRightmostId(n.namedChildren[n.namedChildren.length - 1]);
                    }
                    return null;
                };
                const pName = findRightmostId(arg);
                if (pName) {
                    params.push({ name: pName, type: 'any', required: true });
                }
            }
        }
        return params;
    }

    private isReadOnly(node: SyntaxNode): boolean {
        // ALLOW SHADOWING: If this identifier is part of any definition or assignment to a new local
        const parent = node.parent;
        if (parent) {
            // If it's a declaration, it's shadowing, not assigning to global
            if (parent.type === 'variable_declaration' || parent.type === 'simple_declaration' || parent.type === 'parameter') {
                return false;
            }
            // If it's a named argument in a call: color=red
            if (parent.type === 'argument' || parent.type === 'keyword_argument') {
                return false;
            }
        }

        // 1. Built-in Methods ending in .new (constructors)
        if (node.text.endsWith('.new') && !node.text.startsWith('array.') && !node.text.startsWith('matrix.') && !node.text.startsWith('map.')) {
            // Arrays/matrices have .new(), but types have Type.new()
            // In Pine, Type.new is a constructor, usually read-only unless shadowed (rare)
            const parts = node.text.split('.');
            if (parts.length === 2 && this.userFunctionTable.has(node.text + '.new')) return true; // It's a UDT constructor
        }

        // 1b. Actually simpler: anything ending in .new where the prefix is a Type
        if (node.text.endsWith('.new')) {
            const typeName = node.text.substring(0, node.text.length - 4);
            // If typeName is a known type? 
            // Pine has built-in types like line, label, box... but line.new is a function. 
            // You cannot assign TO line.new = ... 
            // You cannot assign TO ANY function call or method access generally, unless it looks like a variable.
            return true;
        }

        // 2. Core Namespaces
        if (Analyzer.STANDARD_NAMESPACES.has(node.text) || Analyzer.STANDARD_NAMESPACES.has(node.text.split('.')[0])) {
            return true; // Cannot assign to 'strategy', 'color', 'strategy.entry'
        }

        // 3. Constant values
        if (['true', 'false', 'na'].includes(node.text)) return true;

        // 4. Function calls (AST structure check needed in handleAssignment, but text check helps)
        // If it's "foo()", that's handled by node type, not here.

        return false;
    }

    public analyze(rootNode: SyntaxNode): Diagnostic[] {
        const diagnostics: Diagnostic[] = [];
        this.userFunctionTable.clear();
        this.scopeStack = [new Map()]; // Reset scope stack for each analysis
        this.initializeBuiltIns(); // Re-populate standard library symbols
        this.sourceCode = rootNode.text; // Store source for text-based checks

        // Pass 0: Greedy Text Scan for Function Definitions (Regex fallback)
        // Helps catch definitions that Tree-sitter completely fractures into ERROR/expression_statement nodes
        const functionDefRegex = /^([a-zA-Z_]\w*)\s*\([\s\S]*?\)\s*=>/gm;
        let match;
        while ((match = functionDefRegex.exec(this.sourceCode)) !== null) {
            const funcName = match[1];
            if (!this.userFunctionTable.has(funcName)) {
                this.userFunctionTable.set(funcName, {
                    name: funcName,
                    description: 'User function (recovered via text scan)',
                    returnType: 'any',
                    params: []
                });
            }
        }

        // Pass 1: Collect User Symbols (Functions and Variables)
        const stack: SyntaxNode[] = [rootNode];
        while (stack.length > 0) {
            const node = stack.pop()!;

            // 1. Collect Function and Method Definitions
            if (node.type === 'function_definition') {
                const nameNode = node.childForFieldName('name') || node.childForFieldName('function') || node.child(0);
                if (nameNode?.text) {
                    this.userFunctionTable.set(nameNode.text, {
                        name: nameNode.text,
                        description: 'User Defined Function',
                        returnType: 'any',
                        params: this.extractParameters(node.childForFieldName('parameters'))
                    });
                }
            }

            // 2. Collect Type Definitions (UDTs)
            if (node.type === 'type_definition') {
                const nameNode = node.childForFieldName('name');
                if (nameNode?.text) {
                    this.define(nameNode.text, { name: 'type', qualifier: Qualifier.Simple }, nameNode);
                    this.userFunctionTable.set(`${nameNode.text}.new`, {
                        name: `${nameNode.text}.new`,
                        description: 'UDT Constructor',
                        returnType: 'any',
                        params: []
                    });
                }
            }

            // 3. Collect Import Aliases
            if (node.type === 'import_statement') {
                const aliasNode = node.childForFieldName('alias');
                if (aliasNode?.text) {
                    this.define(aliasNode.text, { name: 'namespace', qualifier: Qualifier.Simple });
                } else {
                    const libNode = node.childForFieldName('library');
                    if (libNode) {
                        const parts = libNode.text.split('/');
                        if (parts.length >= 2) {
                            this.define(parts[1], { name: 'namespace', qualifier: Qualifier.Simple }, libNode);
                        }
                    }
                }
            }

            // 4. Global variable declarations
            const isTopLevel = node.parent?.type === 'source_file';
            if (isTopLevel && (node.type === 'variable_declaration' || node.type === 'assignment' || node.type === 'simple_declaration')) {
                const nameNode = node.childForFieldName('name') || node.child(0);
                const explicitTypeNode = node.namedChildren.find(c => c.type === 'type');
                const typeName = explicitTypeNode?.text || 'any';

                if (nameNode) {
                    const collectFromTarget = (target: SyntaxNode) => {
                        if (target.type === 'identifier') {
                            this.define(target.text, { name: typeName, qualifier: Qualifier.Simple }, target);
                        } else if (target.type === 'tuple_declaration' || target.type === 'tuple_expression') {
                            for (const child of target.namedChildren) {
                                collectFromTarget(child);
                            }
                        }
                    };
                    collectFromTarget(nameNode);
                }

                // Detect if it's an anonymous function assignment: foo = () => ...
                const rhsNode = node.childForFieldName('value') || node.child(node.childCount - 1);
                if (rhsNode && rhsNode.type === 'anonymous_function' && nameNode) {
                    this.userFunctionTable.set(nameNode.text, {
                        name: nameNode.text,
                        description: 'User function (assignment)',
                        returnType: 'any',
                        params: this.extractParameters(rhsNode.childForFieldName('parameters'))
                    });
                }
            }

            // 5. Recovery for broken function definitions (parsed as expression_statement or identifier + ERROR =>)
            if (node.type === 'expression_statement' || node.type === 'ERROR' || node.type === 'identifier' || node.type === 'function_call') {
                const text = node.text;
                // Pattern: funcName(params) =>
                if (text.includes('=>')) {
                    const match = text.match(/([a-zA-Z_]\w*)\s*\((.*)\)\s*=>/);
                    if (match) {
                        const funcName = match[1];
                        if (!this.userFunctionTable.has(funcName)) {
                            this.userFunctionTable.set(funcName, {
                                name: funcName,
                                description: 'User function (recovered)',
                                returnType: 'any',
                                params: [] // Hard to parse from text match reliably
                            });
                        }
                    }
                }

                // Check for sibling recovery (common when parameters are broken)
                if (node.type === 'expression_statement' || node.type === 'function_call' || node.type === 'identifier') {
                    const callNode = node.type === 'expression_statement' ? node.child(0) : node;
                    if (callNode && (callNode.type === 'function_call' || callNode.type === 'identifier')) {
                        const parent = node.parent;
                        if (parent) {
                            const idx = parent.children.indexOf(node);
                            const next = idx !== -1 ? parent.children[idx + 1] : null;
                            if (next && next.type === 'ERROR' && next.text === '=>') {
                                const nameNode = callNode.type === 'identifier' ? callNode : callNode.childForFieldName('function') || callNode.child(0);
                                if (nameNode) {
                                    this.userFunctionTable.set(nameNode.text, {
                                        name: nameNode.text,
                                        description: 'User function (recovered from complex syntax)',
                                        returnType: 'any',
                                        params: callNode.type === 'function_call' ? this.extractParametersFromCall(callNode) : []
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // Greedily collect identifiers from ERROR nodes as potential symbols
            if (node.type === 'ERROR') {
                const collectIdentifiers = (n: SyntaxNode) => {
                    if (n.type === 'identifier') {
                        if (!this.getSymbol(n.text)) {
                            this.define(n.text, { name: 'any', qualifier: Qualifier.Simple }, n);
                        }
                    }
                    for (const child of n.children) collectIdentifiers(child);
                };
                collectIdentifiers(node);
            }

            // Push children
            const childrenCount = node.childCount;
            for (let i = childrenCount - 1; i >= 0; i--) {
                const child = node.child(i);
                if (child) stack.push(child);
            }
        }

        // Pass 2: Visit and Validate (Recursive for scoping)
        this.visit(rootNode, diagnostics);

        // Pass 3: Simple text-based unused variable check for global `var [type] name = ...` declarations
        // This avoids false positives from complex scoping by doing a simple grep-style search
        this.checkUnusedVarDeclarations(rootNode.text, diagnostics);

        return diagnostics;
    }

    private visit(node: SyntaxNode, diagnostics: Diagnostic[]) {
        if (diagnostics.length >= 500) return;

        let pushed = false;
        if (node.type === 'function_definition') {
            this.scopeStack.push(new Map());
            pushed = true;

            // Define parameters in local scope
            const paramsNode = node.childForFieldName('parameters');
            if (paramsNode) {
                for (const p of paramsNode.namedChildren) {
                    if (p.type === 'parameter') {
                        const pNameNode = p.namedChildren.find(c => c.type === 'identifier');
                        const pTypeNode = p.namedChildren.find(c => c.type === 'type');
                        if (pNameNode) {
                            this.define(pNameNode.text, { name: pTypeNode?.text || 'any', qualifier: Qualifier.Param });
                        }
                    }
                }
            }
        }

        // --- HANDLE NODE ---
        if (node.type === 'function_call') {
            this.handleFunctionCall(node, diagnostics);
        } else if (node.type === 'variable_declaration' || node.type === 'assignment' || node.type === 'simple_declaration') {
            this.handleAssignment(node, diagnostics);
        } else if (node.type === 'member_access') {
            this.handleMemberAccess(node, diagnostics);
        } else if (node.type === 'for_statement') {
            this.scopeStack.push(new Map());
            pushed = true;
            const idNode = node.childForFieldName('left') || node.children[1];
            if (idNode) {
                this.define(idNode.text, { name: 'int', qualifier: Qualifier.Simple }, idNode);
            }
        } else if (node.type === 'identifier') {
            // Skip identifiers that are part of a definition/assignment to avoid self-reporting
            const parent = node.parent;
            let skip = false;
            // Note: handleIdentifier now has internal checks too, but explicit skip here optimization
            if (parent && (parent.type === 'variable_declaration' || parent.type === 'function_definition' || parent.type === 'parameter')) {
                if (node === parent.childForFieldName('name') || node === parent.childForFieldName('parameters')) {
                    skip = true;
                }
            } else if (parent && parent.type === 'block' && parent.parent && parent.parent.type === 'type_definition') {
                // Skip field names in type definition (direct block child)
                skip = true;
            } else if (parent && parent.parent && parent.parent.type === 'block' && parent.parent.parent && parent.parent.parent.type === 'type_definition') {
                // Skip field names in type definition (expression_statement child)
                skip = true;
            }
            if (!skip) {
                this.handleIdentifier(node, diagnostics);
            }
        } else if (node.type === 'if_expression' || node.type === 'if_statement') {
            this.handleIfStatement(node, diagnostics);
        } else if (node.type === 'while_expression' || node.type === 'while_statement') {
            this.handleWhileStatement(node, diagnostics);
        }

        // --- VISIT CHILDREN ---
        const count = node.childCount;
        for (let i = 0; i < count; i++) {
            const child = node.child(i);
            if (child) this.visit(child, diagnostics);
        }

        if (pushed) {
            this.scopeStack.pop();
        }
    }

    /**
     * Simple text-based unused variable detection.
     * Finds `var [type] name = ...` patterns at line start (global scope).
     * If the variable name only appears once (the declaration), it's unused.
     */
    private checkUnusedVarDeclarations(sourceCode: string, diagnostics: Diagnostic[]) {
        // Match: var [optional_type] name = ... at the start of a line
        // Examples: var bool showFib = false
        //           var float myVar = 0.0
        //           var line lEntry = line.new(...)
        const varDeclPattern = /^(var(?:ip)?)\s+(\w+)\s+(\w+)\s*=/gm;

        const lines = sourceCode.split('\n');
        let match;

        while ((match = varDeclPattern.exec(sourceCode)) !== null) {
            const varKeyword = match[1]; // 'var' or 'varip'
            const typeName = match[2];   // type like 'bool', 'float', 'line', etc.
            const varName = match[3];    // the variable name

            // Skip common false positives
            if (varName.startsWith('_')) continue; // Convention for intentionally unused
            if (typeName === 'var' || typeName === 'varip') continue; // Malformed match

            // Count occurrences of the variable name in the source (word boundary match)
            const usagePattern = new RegExp(`\\b${varName}\\b`, 'g');
            const occurrences = (sourceCode.match(usagePattern) || []).length;

            // If only 1 occurrence (the declaration itself), it's unused
            if (occurrences <= 1) {
                // Find the line number for proper range
                const declPos = match.index;
                const linesBeforeDecl = sourceCode.substring(0, declPos).split('\n');
                const lineNumber = linesBeforeDecl.length - 1; // 0-indexed
                const lineText = lines[lineNumber] || '';
                const startCol = lineText.indexOf(varName);

                diagnostics.push({
                    severity: DiagnosticSeverity.Warning,
                    range: {
                        start: { line: lineNumber, character: Math.max(0, startCol) },
                        end: { line: lineNumber, character: Math.max(0, startCol) + varName.length }
                    },
                    message: `Variable '${varName}' is declared but never used.`,
                    source: 'Pine Script'
                });
            }
        }
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

    private getType(node: SyntaxNode): string {
        if (!node) return 'any';

        switch (node.type) {
            case 'number':
                return node.text.includes('.') ? 'float' : 'int';
            case 'string':
                return 'string';
            case 'bool':
            case 'true':
            case 'false':
                return 'bool';
            case 'color':
                return 'color';
            case 'identifier':
            case 'member_access':
                const name = node.text;
                // Check if it's a built-in variable (e.g., 'close')
                if (Analyzer.CORE_BUILTINS.has(name)) {
                    if (['open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3', 'ohlc4', 'hlcc4'].includes(name)) {
                        return 'float'; // Most price data is float series
                    }
                    if (name === 'time') return 'series int'; // time is series int
                    if (name === 'bar_index' || name === 'last_bar_index') return 'int';
                    if (name.startsWith('barstate.')) return 'bool';
                    if (name === 'true' || name === 'false') return 'bool';
                    if (name === 'na') return 'any'; // or float/int depending on context, na is compatible with all
                }
                // Check symbol table
                const symbol = this.getSymbol(name);
                if (symbol) return symbol.name;
                return 'any';

            case 'map':
                return 'map';

            case 'argument':
                const valNode = node.childForFieldName('value');
                if (valNode) return this.getType(valNode);
                return this.getType(node.namedChildren[0]);

            case 'function_call':
                const funcNameNode = node.childForFieldName('name') || node.child(0);
                if (funcNameNode) {
                    const funcName = funcNameNode.text;
                    const def = this.definitions.get(funcName) || this.userFunctionTable.get(funcName);
                    if (def) {
                        if (funcName === 'array.from' || funcName === 'array.new') {
                            const argListNode = node.namedChildren.find(c => c.type === 'argument_list');
                            const firstArg = argListNode?.namedChildren[0];

                            // Check for generic syntax array.new<type>()
                            if (node.text.includes('<') && node.text.includes('>')) {
                                const match = node.text.match(/<([^>]+)>/);
                                if (match) return `array<${match[1]}>`;
                            }

                            if (firstArg) {
                                let elemType = this.getType(firstArg);
                                if (elemType.includes('|')) elemType = elemType.split('|')[0];
                                if (elemType === 'any') return 'any[]';
                                return `array<${elemType}>`;
                            }
                            return 'any[]';
                        }

                        let returnType = Array.isArray(def.returnType) ? def.returnType.join('|') : def.returnType;

                        // FIX: Better handling for descriptive "types" in definitions.json
                        if (returnType.length > 25 || returnType.includes(' ') || returnType.includes('`') || returnType.includes('.')) {
                            // If it's a long string with spaces or special chars, it's likely a description
                            // Unless it's a known generic/documented special case
                            if (!returnType.includes('array<') && !returnType.includes('matrix<') && !returnType.includes('map<')) {
                                returnType = 'any';
                            }
                        }

                        // Handle generic array element return types
                        if (returnType.includes('element') || returnType.includes('removed') || returnType.includes('popped')) {
                            const argListNode = node.namedChildren.find(c => c.type === 'argument_list');
                            const firstArg = argListNode?.namedChildren[0];
                            if (firstArg) {
                                let containerType = this.getType(firstArg);
                                if (containerType.startsWith('array<')) {
                                    return containerType.substring(6, containerType.length - 1);
                                }
                                if (containerType.endsWith('[]')) {
                                    return containerType.substring(0, containerType.length - 2);
                                }
                            }
                            return 'any';
                        }
                        return returnType;
                    }
                    if (Analyzer.VOID_FUNCTIONS.has(funcName)) return 'void';
                }
                return 'any';

            case 'binary_expression':
                {
                    const left = node.childForFieldName('left');
                    const op = node.child(1); // Operator is usually second child
                    const right = node.childForFieldName('right');
                    if (left && right && op) {
                        const opText = op.text.trim();
                        if (['==', '!=', '>', '<', '>=', '<=', 'and', 'or'].includes(opText)) return 'bool';

                        const leftType = this.getType(left);
                        const rightType = this.getType(right);
                        // Pine Coercion: if either is float, result is float
                        if (leftType === 'float' || rightType === 'float') return 'float';
                        if (leftType === 'int' && rightType === 'int') return 'int';
                    }
                    return 'any';
                }
            case 'conditional_expression': // ternary
                const thenBranch = node.child(2);
                const elseBranch = node.child(4);
                if (thenBranch && elseBranch) {
                    const thenType = this.getType(thenBranch);
                    const elseType = this.getType(elseBranch);
                    if (thenType === elseType) return thenType;
                    if ((thenType === 'float' && elseType === 'int') || (thenType === 'int' && elseType === 'float')) return 'float';
                }
                return 'any';

            case 'parenthesized_expression':
                const inner = node.child(1);
                return inner ? this.getType(inner) : 'any';

            case 'unary_expression':
                const uOp = node.child(0);
                const uOperand = node.child(1);
                if (uOp && uOp.text === 'not') return 'bool';
                if (uOperand) return this.getType(uOperand);
                return 'any';

            default:
                return 'any';
        }
    }

    private normalizeType(type: string): string {
        if (!type) return 'any';
        let t = type.toLowerCase();
        // Strip prefixes
        t = t.replace(/series\s+/g, '')
            .replace(/const\s+/g, '')
            .replace(/input\s+/g, '')
            .replace(/simple\s+/g, '')
            .trim();

        // Normalize array notation
        if (t.endsWith('[]')) {
            t = `array<${t.substring(0, t.length - 2)}>`;
        }

        // Pine Script v5/v6 internal types
        if (t.includes('hline_style')) return 'hline_style';
        if (t.includes('plot_style')) return 'plot_style';
        if (t.includes('plot_display') || t.includes('display_')) return 'plot_display';
        if (t.includes('hline_simple_display')) return 'plot_display';

        if (t === 'color[]') return 'array<color>';
        if (t === 'array') return 'any[]';
        if (t.startsWith('array<')) {
            if (t === 'array<any>') return 'any[]';
            return t;
        }
        if (t.startsWith('map<')) return t;

        if (t === 'na') return 'any';
        return t;
    }

    private isCompatible(target: string | string[], actual: string | string[]): boolean {
        if (!target || !actual) return true;

        const actualStr = Array.isArray(actual) ? actual.join('|') : actual;
        const targetStr = Array.isArray(target) ? target.join('|') : target;

        // 'any' or 'na' matches anything
        if (targetStr.includes('any') || actualStr.includes('any') ||
            targetStr.includes('na') || actualStr.includes('na') ||
            targetStr === '' || actualStr === '') return true;

        const targets = targetStr.split('|').map(t => this.normalizeType(t));
        const actuals = actualStr.split('|').map(a => this.normalizeType(a));

        const enumTypes = new Set([
            'hline_style', 'plot_display', 'plot_simple_display', 'shape', 'location', 'size',
            'plot_style', 'line_style', 'text_align', 'position', 'strategy_direction',
            'barmerge_lookahead', 'barmerge_gaps', 'xloc', 'yloc', 'extend', 'label_style',
            'format', 'alert_freq', 'adjustment', 'currency', 'scale', 'font', 'session',
            'order', 'display'
        ]);

        for (const t of targets) {
            for (const a of actuals) {
                if (t === a) return true;
                if (t === 'any[]' && (a.startsWith('array<') || a.endsWith('[]'))) return true;
                if (a === 'any[]' && (t.startsWith('array<') || t.endsWith('[]'))) return true;

                // Pine upcasts
                if (t === 'float' && a === 'int') return true;
                if (t === 'array<float>' && a === 'array<int>') return true;

                // Color literals are seen as int by tree-sitter often
                if (t === 'color' && a === 'int') return true;
                if (t === 'color' && a === 'float') return true; // Relaxation for fuzzed tests

                // Relaxed truthiness (if target is bool, allow any numeric)
                if (t === 'bool' && (a === 'int' || a === 'float')) return true;

                // DRAWING OBJECT RELAXATION: line.delete(na), label.delete(na) 
                // Tree-sitter sees `na` as int, but it's valid for nullable drawing types
                if ((t === 'line' || t === 'label' || t === 'box' || t === 'table' || t === 'polyline' || t === 'linefill') && a === 'int') return true;

                // STRING RELAXATION: Tuple/ternary mistyping often causes string vs float/int errors
                // In Pine Script, this is usually a false positive from complex expressions
                if (t === 'string' && (a === 'float' || a === 'int')) return true;

                // Enum-like string relaxation (bidirectional)
                // Definitions.json often says "string" but actual constants like size.small have type 'size'
                if (enumTypes.has(t) && a === 'string') return true;
                if (enumTypes.has(a) && t === 'string') return true;

                // Generic Map support
                if (t === 'map<type>' || a === 'map<type>') return true;
                if (t.startsWith('map<') && a.startsWith('map<')) return true; // Shallow check

                // Special case for metadata like "array<[int|float|bool|string]>"
                if (t.startsWith('array<[') && (a.startsWith('array<') || !a.includes('['))) {
                    // If target is an array of types, and actual is a simple type, it might be variadic metadata confused.
                    // But if it's already variadic, handleFunctionCall handles the flattening.
                    // Let's just allow it for now to avoid false positives on str.format
                    return true;
                }

                // If checking for a specific type and it's included in an OR type
                if (t.includes(a) || a.includes(t)) {
                    const tIsArr = t.startsWith('array<');
                    const aIsArr = a.startsWith('array<');
                    if (tIsArr === aIsArr) return true;
                }
            }
        }

        return false;
    }

    private handleWhileStatement(node: SyntaxNode, diagnostics: Diagnostic[]) {
        const condition = node.childForFieldName('condition');
        if (condition) {
            const type = this.getType(condition);
            // Pine v5 strictly says bool, but many scripts use truthiness or my inference is slightly conservative.
            // Allow int as well to avoid frustration until type system is 100% robust.
            if (!this.isCompatible('bool|int', type)) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: this.getRange(condition),
                    message: `Condition of 'while' must be of type 'bool' or 'int', found '${type}'.`,
                    source: 'Pine Script'
                });
            }
        }
    }

    private handleIfStatement(node: SyntaxNode, diagnostics: Diagnostic[]) {
        const condition = node.childForFieldName('condition');
        if (condition) {
            const type = this.getType(condition);
            if (!this.isCompatible('bool|int', type)) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: this.getRange(condition),
                    message: `Condition of 'if' must be of type 'bool' or 'int', found '${type}'.`,
                    source: 'Pine Script'
                });
            }
        }
    }

    private handleAssignment(node: SyntaxNode, diagnostics: Diagnostic[]) {
        let nameNode = node.childForFieldName('name') || node.child(0);

        // Special case: In "var Type name = ...", tree-sitter might return ERROR node for name
        if (node.type === 'variable_declaration') {
            const errorNode = node.namedChildren.find(c => c.type === 'ERROR');
            if (errorNode && /^[a-zA-Z_]\w*$/.test(errorNode.text)) {
                nameNode = errorNode;
            }
        }

        if (!nameNode) return;

        // Handle Tuple Declaration special case
        if (nameNode.type === 'tuple_declaration' || nameNode.type === 'tuple_expression') {
            for (const child of nameNode.namedChildren) {
                // Recursively handle each variable in the tuple
                const tName = child.text;
                const tScope = this.scopeStack[this.scopeStack.length - 1];

                // If declaring, add to scope
                if (!tScope.has(tName)) {
                    this.define(tName, { name: 'any', qualifier: Qualifier.Simple }, child);
                }
            }
            return;
        }

        const qualifier = Qualifier.Simple;

        // 1. Check if assigning to a function call or read-only member
        // Is it a method call? e.g. "foo() = 10" (Parser calls it function_call)
        // Is it a constructor/namespace? e.g. "aph.new = 10" (Parser calls it member_access)
        // If it's a function call node, it's definitely invalid LHS.
        if (nameNode.type === 'function_call') {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: this.getRange(nameNode),
                message: `Cannot assign to a function call '${nameNode.text}'.`,
                source: 'Pine Script Pro'
            });
            return;
        }

        // Check isReadOnly
        if (this.isReadOnly(nameNode)) {
            diagnostics.push({
                severity: DiagnosticSeverity.Error,
                range: this.getRange(nameNode),
                message: `Cannot assign to read-only variable or function '${nameNode.text}'.`,
                source: 'Pine Script Pro'
            });
            return;
        }

        const name = nameNode.text;

        // Check if it's a declaration in the CURRENT scope
        const currentScope = this.scopeStack[this.scopeStack.length - 1];
        const localSym = currentScope.get(name);

        // If it's a new declaration (variable_declaration), it shadows the parent.
        // We only check compatibility if it already exists in the current scope.
        if ((node.type === 'variable_declaration' || node.type === 'simple_declaration')) {
            if (!localSym) {
                const rhsNode = node.childForFieldName('value') || node.child(node.childCount - 1);
                if (rhsNode) {
                    const rhsType = this.getType(rhsNode);
                    const explicitTypeNode = node.namedChildren.find(c => c.type === 'type');
                    const declaredType = explicitTypeNode?.text || rhsType;
                    this.define(name, { name: declaredType, qualifier: Qualifier.Simple }, nameNode);
                }
                return;
            } else if (!localSym.range) {
                // Fix missing range from Pass 1
                localSym.range = this.getRange(nameNode);
            }
        }

        const lhsSym = this.getSymbol(name);
        const lhsType = lhsSym?.name || 'any';

        // If not found in current scope and it is a declaration (=), then define it
        const isDeclaration = node.type === 'variable_declaration' || node.type === 'simple_declaration' || (node.type === 'assignment' && !lhsSym);

        const rhsNode = node.childForFieldName('value') || node.child(node.children.length - 1);
        if (rhsNode) {
            const rhsType = this.getType(rhsNode);
            if (lhsType !== 'any' && !this.isCompatible(lhsType, rhsType)) {
                diagnostics.push({
                    severity: DiagnosticSeverity.Error,
                    range: this.getRange(rhsNode),
                    message: `Type mismatch: cannot assign value of type '${rhsType}' to variable of type '${lhsType}'.`,
                    source: 'Pine Script'
                });
            }
            if (isDeclaration && !lhsSym) {
                this.define(name, { name: rhsType, qualifier }, nameNode);
            }
        }
    }

    private handleIdentifier(node: SyntaxNode, diagnostics: Diagnostic[]) {
        const name = node.text;

        // Skip keywords
        if (Analyzer.KEYWORDS.has(name)) return;

        // Skip declaration sites (already handled by visit -> handleAssignment/definition)
        // But wait, visit() calls handleIdentifier for ALL identifiers unless skipped.
        // The skipping logic in visit() covers definitions and assignments LHS.
        // So here we only see RHS usages or references.

        // Context aware checks to skip definition sites and non-variable usages
        const parent = node.parent;
        if (parent) {
            // 1. Skip if this is the name being declared
            if ((parent.type === 'variable_declaration' || parent.type === 'function_definition') &&
                parent.childForFieldName('name')?.startIndex === node.startIndex) {
                return;
            }
            // 2. Skip if this is the LHS of an assignment
            if (parent.type === 'assignment' && parent.childForFieldName('left')?.startIndex === node.startIndex) {
                return;
            }
            // 3. Skip properties in member access (e.g. strategy.entry -> skip entry)
            if (parent.type === 'member_access') {
                const member = parent.childForFieldName('member');
                if (member?.startIndex === node.startIndex) {
                    // console.log(`Skipping member access property: ${name}`);
                    return;
                }
            }
            // 4. Skip typed parameters
            if (parent.type === 'parameter' && parent.childForFieldName('name')?.startIndex === node.startIndex) {
                return;
            }
            // 5. Skip named arguments in function calls (e.g. plot(series=close) -> skip series)
            if (parent.type === 'argument' && parent.childForFieldName('name')?.startIndex === node.startIndex) {
                return;
            }
        }

        // Check if defined
        let symbol = this.getSymbol(name);

        // Fallback for user functions used as reference
        if (!symbol && this.userFunctionTable.has(name)) {
            symbol = { name: 'function', qualifier: Qualifier.Const, usageCount: 0 };
        }

        if (!symbol) {
            // Check if it's a core built-in or namespace
            if (Analyzer.CORE_BUILTINS.has(name) || Analyzer.STANDARD_NAMESPACES.has(name)) return;

            // Check if it's a known function from definitions.json
            if (this.definitions.has(name)) return;

            // DISABLED: Undefined Identifier checking - too many false positives
            // The symbol collection doesn't handle all Pine Script patterns correctly
            // (var declarations with types, complex destructuring, function parameters, etc.)
            // diagnostics.push({
            //     severity: DiagnosticSeverity.Error,
            //     range: this.getRange(node),
            //     message: `Undefined identifier '${name}'.`,
            //     source: 'Pine Script Pro'
            // });
            return;
        }

        // Track Usage
        if (symbol.usageCount !== undefined) {
            symbol.usageCount++;
        }
    }


    public formatType(type: PineType): string {
        const qualifierNames: Record<Qualifier, string> = {
            [Qualifier.Const]: 'const',
            [Qualifier.Input]: 'input',
            [Qualifier.Simple]: 'simple',
            [Qualifier.Series]: 'series',
            [Qualifier.Param]: 'param'
        };
        const qual = qualifierNames[type.qualifier] || '';
        return `${qual} ${type.name}`.trim();
    }

    private handleMemberAccess(node: SyntaxNode, diagnostics: Diagnostic[]) {
        const objectNode = node.childForFieldName('object') || node.child(0);
        const memberNode = node.childForFieldName('member') || node.child(2);

        if (!objectNode || !memberNode) return;

        const objectName = objectNode.text;
        const memberName = memberNode.text;
        const fullName = `${objectName}.${memberName}`;

        // Check if objectNode is a simple identifier (not a nested member access or call)
        const isSimpleIdentifier = objectNode.type === 'identifier';

        if (Analyzer.STANDARD_NAMESPACES.has(objectName) || Analyzer.CORE_BUILTINS.has(objectName)) {
            // Known namespace/builtin - skip undefined member checking (too many false positives)
            if (objectName === 'strategy' && memberName === 'position_avg_price') return;
            // Member checking disabled due to incomplete definitions.json
        } else if (isSimpleIdentifier) {
            // Object is a user identifier (not a namespace) - check if it's defined
            // This catches cases like `abc.def` where `abc` is not defined
            const symbol = this.getSymbol(objectName);
            const isUserFunction = this.userFunctionTable.has(objectName);
            const isKnownFunction = this.definitions.has(objectName);

            if (!symbol && !isUserFunction && !isKnownFunction) {
                // Fallback: Check if this looks like a typed function parameter
                // Pattern: TypeName objectName in function signature (e.g., "AnchorData anchor")
                const typedParamPattern = new RegExp(`\\b\\w+\\s+${objectName}\\s*[,)]`, 'g');
                const isTypedParam = typedParamPattern.test(this.sourceCode);

                if (!isTypedParam) {
                    // Object is not defined anywhere - report error
                    diagnostics.push({
                        severity: DiagnosticSeverity.Error,
                        range: this.getRange(objectNode),
                        message: `Undefined identifier '${objectName}'.`,
                        source: 'Pine Script'
                    });
                }
            }
        }
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

        // RECOVERY: If this looks like a definition (followed by => error), skip check
        // We already collected it in Pass 1, but we don't want to flag the "call" itself
        if (node.parent?.type === 'expression_statement') {
            const stmt = node.parent;
            const block = stmt.parent;
            if (block) {
                const idx = block.children.findIndex(c => c.startIndex === stmt.startIndex);
                if (idx !== -1 && idx < block.children.length - 1) {
                    const next = block.children[idx + 1];
                    if (next.type === 'ERROR' && next.text === '=>') {
                        return;
                    }
                }
            }
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
            const sym = this.getSymbol(funcName);
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
        const returnType = Array.isArray(definition.returnType) ? definition.returnType.join('|') : definition.returnType;
        const isVoid = returnType.toLowerCase() === 'void' ||
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
        const isVariadic = definition.params.some((p: any) => p.name.includes('...'));

        // 1. Check for too many arguments 
        if (!isVariadic && totalParams > 0 && providedCount > totalParams) {
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

        // 3. Type Validation for Arguments
        if (funcName === 'fill') return; // Bypass fill due to broken definitions.json overloads

        if (totalParams > 0) {
            let positionalCount = 0;
            args.forEach((argNode, index) => {
                // SKIP ERROR nodes to prevent index shifting
                if (argNode.type === 'ERROR') return;

                let paramDef: any = null;
                const argNameNode = argNode.childForFieldName('name');

                if (argNameNode) {
                    // Named argument: find by name
                    paramDef = definition.params.find((p: any) => p.name === argNameNode.text);
                } else {
                    // Positional argument
                    const paramIndex = isMethodCall ? positionalCount + 1 : positionalCount;
                    const actualParamIndex = (isVariadic && paramIndex >= totalParams) ? totalParams - 1 : paramIndex;
                    if (actualParamIndex < totalParams) {
                        paramDef = definition.params[actualParamIndex];
                    }
                    positionalCount++;
                }

                if (paramDef) {
                    const argType = this.getType(argNode);
                    if (!this.isCompatible(paramDef.type, argType)) {
                        diagnostics.push({
                            severity: DiagnosticSeverity.Error,
                            range: this.getRange(argNode),
                            message: `Type mismatch for argument '${paramDef.name}': expected '${paramDef.type}', found '${argType}'.`,
                            source: 'Pine Script'
                        });
                    }
                }
            });
        }
    }

    public onSignatureHelp(rootNode: SyntaxNode, position: { line: number, character: number }): any {
        // 1. Find the node at position
        let node = this.findNodeAt(rootNode, position);
        if (!node) return null;

        // 2. Traverse up to find function_call
        let callNode: SyntaxNode | null = node;
        while (callNode && callNode.type !== 'function_call') {
            callNode = callNode.parent;
        }

        if (!callNode) return null;

        // 3. Get function name and definition
        const funcNameNode = callNode.childForFieldName('name') || callNode.child(0);
        if (!funcNameNode) return null;
        const funcName = funcNameNode.text;
        const def = this.definitions.get(funcName) || this.userFunctionTable.get(funcName);
        if (!def) return null;

        // 4. Calculate active parameter index
        const argListNode = callNode.namedChildren.find(c => c.type === 'argument_list');
        let activeParameter = 0;
        if (argListNode) {
            let positionalCount = 0;
            for (let i = 0; i < argListNode.namedChildren.length; i++) {
                const arg = argListNode.namedChildren[i];
                if (arg.type === 'ERROR') continue; // Skip error nodes to match analyzer logic

                if (position.line > arg.endPosition.row || (position.line === arg.endPosition.row && position.character >= arg.endPosition.column)) {
                    // This logic is simple; strictly it should check if position is *before* the next comma
                    // But for now, just increment
                }

                // We need to determine if *this* argument covers the cursor position
                if (position.line >= arg.startPosition.row && position.line <= arg.endPosition.row) {
                    if (position.line === arg.startPosition.row && position.character < arg.startPosition.column) {
                        // Before start
                    } else if (position.line === arg.endPosition.row && position.character > arg.endPosition.column) {
                        // After end
                    } else {
                        activeParameter = i; // This is the one
                    }
                }
            }

            // Re-implementing a safer active parameter detection based on commas
            // The tree-sitter node for argument_list contains commas as anonymous nodes
            let commaCount = 0;
            const count = argListNode.childCount;
            for (let i = 0; i < count; i++) {
                const child = argListNode.child(i);
                if (child && child.type === ',') {
                    if (position.line > child.endPosition.row || (position.line === child.endPosition.row && position.character > child.endPosition.column)) {
                        commaCount++;
                    }
                }
            }
            activeParameter = commaCount;
        }

        return {
            signatures: [{
                label: `${funcName}(${def.params.map(p => `${p.name}: ${p.type}`).join(', ')})`,
                documentation: def.description,
                parameters: def.params.map(p => ({
                    label: p.name,
                    documentation: p.desc || ''
                }))
            }],
            activeSignature: 0,
            activeParameter: Math.min(activeParameter, def.params.length - 1)
        };
    }

    private findNodeAt(node: SyntaxNode, position: { line: number, character: number }): SyntaxNode | null {
        if (position.line < node.startPosition.row || position.line > node.endPosition.row) return null;
        if (position.line === node.startPosition.row && position.character < node.startPosition.column) return null;
        if (position.line === node.endPosition.row && position.character > node.endPosition.column) return null;

        for (const child of node.children) {
            const result = this.findNodeAt(child, position);
            if (result) return result;
        }
        return node;
    }

    public onRenameRequest(rootNode: SyntaxNode, position: { line: number, character: number }, newName: string): { range: Range, newText: string }[] {
        const node = this.findNodeAt(rootNode, position);
        if (!node || node.type !== 'identifier') return [];

        const oldName = node.text;
        const edits: { range: Range, newText: string }[] = [];

        // Simple same-file rename for all occurrences of this identifier
        const visit = (n: SyntaxNode) => {
            if (n.type === 'identifier' && n.text === oldName) {
                edits.push({ range: this.getRange(n), newText: newName });
            }
            for (const child of n.children) visit(child);
        };
        visit(rootNode);
        return edits;
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
