const { Analyzer } = require('../out/analyzer');
const { Parser, Language } = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');

async function testInvalidAssignment() {
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../wasm/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const definitions = JSON.parse(fs.readFileSync(path.join(__dirname, '../out/data/definitions.json'), 'utf8'));
    const analyzer = new Analyzer(definitions);

    // Reproduce the problematic code
    const code = `
//@version=5
type aph
    int x

aph.new = na // Invalid assignment to constructor
aph.new = 10 
`;

    const tree = parser.parse(code);
    const diagnostics = analyzer.analyze(tree.rootNode);

    console.log(`Diagnostics: ${diagnostics.length}`);
    diagnostics.forEach(d => console.log(d.message));
}

testInvalidAssignment().catch(err => { console.error(err); process.exit(1); });
