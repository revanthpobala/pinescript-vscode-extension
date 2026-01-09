import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    InitializeParams,
    TextDocumentSyncKind,
    InitializeResult,
    CompletionItem,
    CompletionItemKind,
    MarkupKind,
    DocumentSymbol,
    SymbolKind,
    SignatureInformation,
    FoldingRange,
    SemanticTokensBuilder,
    SemanticTokensLegend,
    SemanticTokenTypes,
    SemanticTokenModifiers
} from 'vscode-languageserver/node';

import {
    TextDocument
} from 'vscode-languageserver-textdocument';

import * as path from 'path';
import { Parser, Language } from 'web-tree-sitter';

import { Analyzer } from './analyzer';

declare global {
    interface EmscriptenModule { }
}

// @ts-ignore
import definitions from './data/definitions.json';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let parser: Parser | null = null;
let PineScriptLang: Language | null = null;

// Keep track of analyzers per document to reuse symbol tables
const analyzers = new Map<string, Analyzer>();

async function initParser() {
    try {
        connection.console.log('Initializing Parser...');
        await Parser.init();

        parser = new Parser();

        const langPath = path.join(__dirname, 'tree-sitter-pinescript.wasm');
        connection.console.log(`Loading Pine Script Language from: ${langPath}`);

        PineScriptLang = await Language.load(langPath);
        parser.setLanguage(PineScriptLang);
        connection.console.log('Pine Script Server initialized successfully!');
    } catch (err) {
        connection.console.error(`Failed to initialize parser: ${err}`);
        if (err instanceof Error && err.stack) {
            connection.console.error(err.stack);
        }
    }
}

const legend: SemanticTokensLegend = {
    tokenTypes: [
        SemanticTokenTypes.variable,
        SemanticTokenTypes.function,
        SemanticTokenTypes.parameter,
        SemanticTokenTypes.namespace,
        SemanticTokenTypes.keyword
    ],
    tokenModifiers: [
        SemanticTokenModifiers.declaration,
        SemanticTokenModifiers.readonly,
        SemanticTokenModifiers.defaultLibrary
    ]
};

connection.onInitialize(async (params: InitializeParams) => {
    await initParser();

    if (!definitions) {
        connection.console.error('Failed to load definitions.');
    }

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            hoverProvider: true,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.']
            },
            documentSymbolProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['(', ',']
            },
            foldingRangeProvider: true,
            semanticTokensProvider: {
                legend: legend,
                full: true
            }
        }
    };
    return result;
});

connection.onInitialized(() => {
});

documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

// Memory cleanup
documents.onDidClose(e => {
    analyzers.delete(e.document.uri);
});

connection.onHover((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc || !parser) return null;

    const text = doc.getText();
    const tree = parser.parse(text);
    if (!tree) return null;
    const root = tree.rootNode;

    const { line, character } = params.position;
    const node = root.descendantForPosition({ row: line, column: character });

    if (node) {
        let word = node.text;

        if (node.parent?.type === 'member_access') {
            word = node.parent.text;
        }

        // 1. Check built-ins
        const def = definitions?.functions?.find((f: any) => f.name === word);
        if (def) {
            const lines: string[] = [`**${def.name}**`];
            const returnType = def.returnType;
            if (returnType && !returnType.startsWith('UNKNOWN') && returnType !== '') {
                lines.push(`*${returnType}*`);
            }
            lines.push('');
            if (def.description) {
                lines.push(def.description);
                lines.push('');
            }
            if (def.params && def.params.length > 0) {
                lines.push('**Params:**');
                for (const p of def.params) {
                    lines.push(`- \`${p.name}\`: ${p.type}`);
                }
            }
            return { contents: { kind: MarkupKind.Markdown, value: lines.join('\n') } };
        }

        // 2. Check user-defined functions
        const analyzer = analyzers.get(params.textDocument.uri);
        if (analyzer) {
            const udf = analyzer.userFunctionTable.get(word);
            if (udf) {
                const paramStr = udf.params.map(p => p.name).join(', ');
                const lines: string[] = [
                    `**(function) ${word}(${paramStr})**`,
                    `*User-defined function*`
                ];
                return { contents: { kind: MarkupKind.Markdown, value: lines.join('\n') } };
            }

            const type = analyzer.symbolTable.get(word);
            if (type) {
                const lines: string[] = [
                    `**(variable) ${word}**`,
                    `*${analyzer.formatType(type)}*`
                ];
                return { contents: { kind: MarkupKind.Markdown, value: lines.join('\n') } };
            }
        }
    }
    return null;
});

connection.languages.semanticTokens.on((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc || !parser) return { data: [] };

    const builder = new SemanticTokensBuilder();
    const text = doc.getText();
    const tree = parser.parse(text);
    const analyzer = analyzers.get(params.textDocument.uri);

    const traverse = (node: any) => {
        if (node.type === 'identifier') {
            const name = node.text;
            let typeIdx = -1;
            let modIdx = 0;

            if (definitions.functions.some((f: any) => f.name === name)) {
                typeIdx = legend.tokenTypes.indexOf(SemanticTokenTypes.function);
                modIdx = 1 << legend.tokenModifiers.indexOf(SemanticTokenModifiers.defaultLibrary);
            } else if (analyzer?.userFunctionTable.has(name)) {
                typeIdx = legend.tokenTypes.indexOf(SemanticTokenTypes.function);
                modIdx = 1 << legend.tokenModifiers.indexOf(SemanticTokenModifiers.declaration);
            } else if (analyzer?.symbolTable.has(name)) {
                const type = analyzer.symbolTable.get(name);
                if (type?.name === 'namespace') {
                    typeIdx = legend.tokenTypes.indexOf(SemanticTokenTypes.namespace);
                } else {
                    typeIdx = legend.tokenTypes.indexOf(SemanticTokenTypes.variable);
                    if (type?.qualifier === 0) { // Qualifier.Const
                        modIdx = 1 << legend.tokenModifiers.indexOf(SemanticTokenModifiers.readonly);
                    }
                }
            }

            if (typeIdx !== -1) {
                builder.push(
                    node.startPosition.row,
                    node.startPosition.column,
                    node.text.length,
                    typeIdx,
                    modIdx
                );
            }
        }

        for (const child of node.children) {
            traverse(child);
        }
    };

    if (tree) traverse(tree.rootNode);
    return builder.build();
});


connection.onSignatureHelp((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc || !parser) return null;

    const text = doc.getText();
    const offset = doc.offsetAt(params.position);

    let parenDepth = 0;
    let funcStart = -1;
    let activeParam = 0;

    for (let i = offset - 1; i >= 0; i--) {
        const char = text[i];
        if (char === ')') parenDepth++;
        else if (char === '(') {
            if (parenDepth === 0) {
                funcStart = i;
                break;
            }
            parenDepth--;
        } else if (char === ',' && parenDepth === 0) {
            activeParam++;
        } else if (char === '\n' && parenDepth === 0) {
            break;
        }
    }

    if (funcStart === -1) return null;

    let funcEnd = funcStart - 1;
    while (funcEnd >= 0 && /\s/.test(text[funcEnd])) funcEnd--;

    let funcNameStart = funcEnd;
    while (funcNameStart >= 0 && /[a-zA-Z0-9_.]/.test(text[funcNameStart])) funcNameStart--;
    funcNameStart++;

    const funcName = text.substring(funcNameStart, funcEnd + 1);

    const analyzer = analyzers.get(params.textDocument.uri);
    const def = definitions?.functions?.find((f: any) => f.name === funcName) || analyzer?.userFunctionTable.get(funcName);

    if (!def || !def.params || def.params.length === 0) return null;

    const paramLabels = def.params.map((p: any) => `${p.name}: ${p.type}`);
    const signature: SignatureInformation = {
        label: `${def.name}(${paramLabels.join(', ')})`,
        parameters: def.params.map((p: any) => ({
            label: `${p.name}: ${p.type}`,
            documentation: p.description || undefined
        }))
    };

    return {
        signatures: [signature],
        activeSignature: 0,
        activeParameter: Math.min(activeParam, def.params.length - 1)
    };
});

connection.onCompletion((params) => {
    if (!definitions || !definitions.functions) return [];

    const doc = documents.get(params.textDocument.uri);
    if (!doc) return [];

    const text = doc.getText();
    const offset = doc.offsetAt(params.position);

    let i = offset - 1;
    while (i >= 0 && /[a-zA-Z0-9_.]/.test(text[i])) i--;
    const fullPrefix = text.substring(i + 1, offset);

    if (fullPrefix.includes('.')) {
        const dotIndex = fullPrefix.lastIndexOf('.');
        const namespace = fullPrefix.substring(0, dotIndex);

        return definitions.functions
            .filter((f: any) => f.name.startsWith(namespace + '.'))
            .map((f: any) => {
                const nameWithoutNamespace = f.name.substring(namespace.length + 1);
                return {
                    label: nameWithoutNamespace,
                    kind: CompletionItemKind.Function,
                    detail: f.returnType && !f.returnType.startsWith('UNKNOWN') ? f.returnType : undefined,
                    documentation: f.description || undefined,
                    insertText: nameWithoutNamespace,
                    data: f.name
                };
            });
    }

    const items: CompletionItem[] = [];
    const analyzer = analyzers.get(params.textDocument.uri);

    // 1. User Defined Functions
    if (analyzer) {
        analyzer.userFunctionTable.forEach((udf, name) => {
            const paramStr = udf.params.map(p => p.name).join(', ');
            items.push({
                label: name,
                kind: CompletionItemKind.Function,
                detail: `User Function (${paramStr})`,
                sortText: '0_' + name
            });
        });
    }

    // 2. Local Symbols
    if (parser) {
        try {
            const tree = parser.parse(text);
            const localSymbols = new Set<string>();
            const traverse = (node: any) => {
                if (node.type === 'variable_declaration' || node.type === 'assignment') {
                    const nameNode = node.childForFieldName('name');
                    if (nameNode) {
                        if (nameNode.type === 'tuple_declaration') {
                            for (const child of nameNode.namedChildren) {
                                if (child.type === 'identifier') localSymbols.add(child.text);
                            }
                        } else if (nameNode.text) {
                            localSymbols.add(nameNode.text);
                        }
                    }
                }
                for (const child of node.children) {
                    traverse(child);
                }
            };
            if (tree) {
                traverse(tree.rootNode);
            }

            localSymbols.forEach(sym => {
                if (analyzer?.userFunctionTable.has(sym)) return; // Skip if it's already a function
                items.push({
                    label: sym,
                    kind: CompletionItemKind.Variable,
                    detail: 'Local Variable',
                    sortText: '1_' + sym
                });
            });
        } catch (e) { }
    }

    const namespaces = new Set<string>();
    definitions.functions.forEach((f: any) => {
        if (f.name.includes('.')) namespaces.add(f.name.split('.')[0]);
    });

    namespaces.forEach(ns => {
        items.push({ label: ns, kind: CompletionItemKind.Module, detail: 'Namespace', sortText: '2_' + ns });
    });

    definitions.functions
        .filter((f: any) => !f.name.includes('.'))
        .forEach((f: any) => {
            items.push({
                label: f.name,
                kind: CompletionItemKind.Function,
                detail: `Built-in Function (${f.returnType && !f.returnType.startsWith('UNKNOWN') ? f.returnType : 'series float'})`,
                documentation: f.description || undefined,
                data: f.name,
                sortText: '3_' + f.name
            });
        });

    ['close', 'open', 'high', 'low', 'volume', 'hl2', 'hlc3', 'ohlc4', 'bar_index', 'timenow', 'last_bar_index', 'time'].forEach(v => {
        items.push({
            label: v,
            kind: CompletionItemKind.Variable,
            detail: 'Built-in Variable (series float)',
            sortText: '4_' + v
        });
    });

    return items;
});

connection.onCompletionResolve((item: CompletionItem) => {
    return item;
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    if (!parser) return;

    try {
        const text = textDocument.getText();
        const tree = parser.parse(text);

        if (tree) {
            let analyzer = analyzers.get(textDocument.uri);
            if (!analyzer) {
                analyzer = new Analyzer(definitions);
                analyzers.set(textDocument.uri, analyzer);
            }
            const diagnostics = analyzer.analyze(tree.rootNode as any);
            connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
        }
    } catch (err) {
        connection.console.error(`Error validating document ${textDocument.uri}: ${err}`);
    }
}

connection.languages.semanticTokens.on((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc || !parser) return { data: [] };

    const builder = new SemanticTokensBuilder();
    const text = doc.getText();
    const tree = parser.parse(text);
    const analyzer = analyzers.get(params.textDocument.uri);

    if (!tree) return { data: [] };
    const stack: any[] = [tree.rootNode];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;

        if (node.type === 'identifier' || node.type === 'member_access') {
            const name = node.text;
            let typeIdx = -1;
            let modIdx = 0;

            if (definitions.functions.some((f: any) => f.name === name)) {
                typeIdx = legend.tokenTypes.indexOf(SemanticTokenTypes.function);
                modIdx = 1 << legend.tokenModifiers.indexOf(SemanticTokenModifiers.defaultLibrary);
            } else if (analyzer?.userFunctionTable.has(name)) {
                typeIdx = legend.tokenTypes.indexOf(SemanticTokenTypes.function);
                modIdx = 1 << legend.tokenModifiers.indexOf(SemanticTokenModifiers.declaration);
            } else if (analyzer?.symbolTable.has(name)) {
                const type = analyzer.symbolTable.get(name);
                if (type?.name === 'namespace') {
                    typeIdx = legend.tokenTypes.indexOf(SemanticTokenTypes.namespace);
                } else {
                    typeIdx = legend.tokenTypes.indexOf(SemanticTokenTypes.variable);
                    if (type?.qualifier === 0) { // Qualifier.Const
                        modIdx = 1 << legend.tokenModifiers.indexOf(SemanticTokenModifiers.readonly);
                    }
                }
            }

            if (typeIdx !== -1) {
                builder.push(
                    node.startPosition.row,
                    node.startPosition.column,
                    node.text.length,
                    typeIdx,
                    modIdx
                );
            }
        }

        // Push children in reverse for correct DFS order
        for (let i = node.children.length - 1; i >= 0; i--) {
            stack.push(node.children[i]);
        }
    }

    return builder.build();
});

connection.onDocumentSymbol((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc || !parser) return [];

    const text = doc.getText();
    const tree = parser.parse(text);
    const symbols: DocumentSymbol[] = [];

    if (!tree) return null;
    const stack: any[] = [tree.rootNode];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;

        if (node.type === 'function_definition') {
            const nameNode = node.childForFieldName('name');
            if (nameNode) {
                symbols.push({
                    name: nameNode.text,
                    kind: SymbolKind.Function,
                    range: {
                        start: { line: node.startPosition.row, character: node.startPosition.column },
                        end: { line: node.endPosition.row, character: node.endPosition.column }
                    },
                    selectionRange: {
                        start: { line: nameNode.startPosition.row, character: nameNode.startPosition.column },
                        end: { line: nameNode.endPosition.row, character: nameNode.endPosition.column }
                    }
                });
            }
        } else if (node.type === 'variable_declaration') {
            const nameNode = node.childForFieldName('name');
            if (nameNode) {
                if (nameNode.type === 'tuple_declaration') {
                    for (const child of nameNode.namedChildren) {
                        if (child.type === 'identifier') {
                            symbols.push({
                                name: child.text,
                                kind: SymbolKind.Variable,
                                range: {
                                    start: { line: child.startPosition.row, character: child.startPosition.column },
                                    end: { line: child.endPosition.row, character: child.endPosition.column }
                                },
                                selectionRange: {
                                    start: { line: child.startPosition.row, character: child.startPosition.column },
                                    end: { line: child.endPosition.row, character: child.endPosition.column }
                                }
                            });
                        }
                    }
                } else {
                    symbols.push({
                        name: nameNode.text,
                        kind: SymbolKind.Variable,
                        range: {
                            start: { line: node.startPosition.row, character: node.startPosition.column },
                            end: { line: node.endPosition.row, character: node.endPosition.column }
                        },
                        selectionRange: {
                            start: { line: nameNode.startPosition.row, character: nameNode.startPosition.column },
                            end: { line: nameNode.endPosition.row, character: nameNode.endPosition.column }
                        }
                    });
                }
            }
        } else if (node.type === 'if_statement' || node.type === 'for_statement') {
            symbols.push({
                name: node.type === 'if_statement' ? 'if' : 'for',
                kind: SymbolKind.Module,
                range: {
                    start: { line: node.startPosition.row, character: node.startPosition.column },
                    end: { line: node.endPosition.row, character: node.endPosition.column }
                },
                selectionRange: {
                    start: { line: node.startPosition.row, character: node.startPosition.column },
                    end: { line: node.startPosition.row, character: node.startPosition.column + (node.type === 'if_statement' ? 2 : 3) }
                }
            });
        }

        for (let i = node.children.length - 1; i >= 0; i--) {
            stack.push(node.children[i]);
        }
    }

    return symbols;
});

connection.onFoldingRanges((params) => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc || !parser) return [];

    const text = doc.getText();
    const tree = parser.parse(text);
    const ranges: FoldingRange[] = [];

    if (!tree) return [];
    const stack: any[] = [tree.rootNode];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;

        if (node.type === 'if_statement' || node.type === 'for_statement' || node.type === 'block' || node.type === 'function_definition') {
            if (node.startPosition.row < node.endPosition.row) {
                ranges.push({
                    startLine: node.startPosition.row,
                    endLine: node.endPosition.row
                });
            }
        }
        for (let i = node.children.length - 1; i >= 0; i--) {
            stack.push(node.children[i]);
        }
    }

    return ranges;
});

documents.listen(connection);
connection.listen();
