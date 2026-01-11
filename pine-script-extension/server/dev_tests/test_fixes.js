const { Analyzer } = require('../out/analyzer');
const { Parser, Language } = require('web-tree-sitter');
const fs = require('fs');
const path = require('path');

async function testFullScript() {
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../wasm/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const definitions = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/definitions.json'), 'utf8'));
    const analyzer = new Analyzer(definitions);

    const scriptPath = 'dev_tests/test_fixes.pine';
    if (!fs.existsSync(scriptPath)) {
        console.error(`Script not found: ${scriptPath}`);
        return;
    }

    const code = fs.readFileSync(scriptPath, 'utf8');
    const tree = parser.parse(code);
    const diagnostics = analyzer.analyze(tree.rootNode);

    console.log(`--- Diagnostics for ${path.basename(scriptPath)} ---`);
    if (diagnostics.length === 0) {
        console.log("SUCCESS: No diagnostics found!");
    } else {
        console.log(`Found ${diagnostics.length} diagnostics:\n`);
        diagnostics.forEach((d, i) => {
            const level = d.severity === 1 ? 'ERROR' : 'WARN';
            console.log(`${i + 1}. [${level}] L${d.range.start.line + 1}:${d.range.start.character} - ${d.message}`);
        });
    }
}

testFullScript().catch(console.error);
