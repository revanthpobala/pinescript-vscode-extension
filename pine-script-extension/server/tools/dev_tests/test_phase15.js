const { Analyzer } = require('../out/analyzer');
const { Parser, Language } = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');

async function testPhase15() {
    console.log('--- Testing Phase 15: Strict Built-in Matching ---');
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../wasm/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const definitions = JSON.parse(fs.readFileSync(path.join(__dirname, '../out/data/definitions.json'), 'utf8'));

    // PASS RAW JSON TO CONSTRUCTOR
    const analyzer = new Analyzer(definitions);

    const code = `
//@version=5
adx = ta.adx() // Should be ERROR
abs_val = math.abs(-1) // Should be OK
myFunc() => 1.0
val = myFunc() // Should be OK
custom = mylib.func() // Should be SILENT (non-standard prefix)
`;

    const tree = parser.parse(code);
    const diagnostics = analyzer.analyze(tree.rootNode);

    console.log(`\nDiagnostics Found: ${diagnostics.length}`);
    diagnostics.forEach(d => {
        const severity = d.severity === 1 ? 'ERROR' : 'WARN';
        console.log(`[${severity}] Line ${d.range.start.line + 1}: ${d.message}`);
    });

    const hasAdxError = diagnostics.some(d => d.message.includes("ta.adx"));
    const hasMathError = diagnostics.some(d => d.message.includes("math.abs"));

    console.log(`\nResults:`);
    console.log(`  ta.adx error correctly found: ${hasAdxError}`);
    console.log(`  math.abs correctly found (no error): ${!hasMathError}`);
}

testPhase15().catch(err => { console.error(err); process.exit(1); });
