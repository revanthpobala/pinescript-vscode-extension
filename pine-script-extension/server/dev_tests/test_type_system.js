const { Analyzer } = require('../out/analyzer');
const { Parser, Language } = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');

async function testTypeSystem() {
    console.log('--- Testing Type System Correctness ---');
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../wasm/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const analyzer = new Analyzer(JSON.parse(fs.readFileSync(path.join(__dirname, '../out/data/definitions.json'), 'utf8')));

    const scripts = [
        {
            name: 'Assignment Type Mismatch',
            code: 'float x = "string"'
        },
        {
            name: 'Arithmetic Inference',
            code: 'x = 1.0 + 2\ny = x'
        },
        {
            name: 'Function Argument Type Mismatch',
            code: 'ta.sma("not a series", 10)'
        }
    ];

    for (const test of scripts) {
        console.log(`\nTest: ${test.name}`);
        const tree = parser.parse(test.code);
        const diagnostics = [];
        analyzer.analyze(tree.rootNode, diagnostics);
        diagnostics.forEach(d => {
            console.log(`[${d.severity === 1 ? 'ERROR' : 'WARNING'}] ${d.message}`);
        });
    }
}

testTypeSystem().catch(err => { console.error(err); process.exit(1); });
