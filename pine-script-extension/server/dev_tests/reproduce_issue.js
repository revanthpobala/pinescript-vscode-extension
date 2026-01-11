const { Analyzer } = require('../out/analyzer');
const { Parser, Language } = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');

async function testIssue() {
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
ntxiprg(matrix<box> lfqz, matrix<box> vvadxc, array<label> enible, array<string> zcx, array<table> keo) => array<linefill>
    matrix<box> ibe = na
    array.new_linefill()

// Call it to ensure it's defined
ntxiprg(na, na, na, na, na)
`;

    const tree = parser.parse(code);
    const diagnostics = analyzer.analyze(tree.rootNode);

    console.log(`Diagnostics: ${diagnostics.length}`);
    diagnostics.forEach(d => console.log(d.message));

    if (diagnostics.length === 0) {
        console.log('SUCCESS: No errors found!');
    } else {
        console.log('FAILURE: Errors remain.');
        process.exit(1);
    }
}

testIssue().catch(err => { console.error(err); process.exit(1); });
