const { Analyzer } = require('../out/analyzer');
const { Parser, Language } = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');

async function test() {
    console.log('--- Testing Invalid Assignment: request.currency_rate() = abc ---');
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../wasm/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const definitions = JSON.parse(fs.readFileSync(path.join(__dirname, '../out/data/definitions.json'), 'utf8'));
    const analyzer = new Analyzer(definitions);

    const code = `
//@version=6
request := float array
request.currency_rate() = abc
`;

    const tree = parser.parse(code);
    const diagnostics = analyzer.analyze(tree.rootNode);

    console.log(`\nDiagnostics Found: ${diagnostics.length}`);
    diagnostics.forEach(d => {
        const severity = d.severity === 1 ? 'ERROR' : 'WARN';
        console.log(`[${severity}] Line ${d.range.start.line + 1}: ${d.message}`);
    });

    console.log('\n--- Tree Structure (debug) ---');
    const printNode = (node, indent = 0) => {
        console.log(`${'  '.repeat(indent)}${node.type}: ${node.text}`);
        for (const child of node.children) printNode(child, indent + 1);
    };
    printNode(tree.rootNode);
}

test().catch(err => { console.error(err); process.exit(1); });
