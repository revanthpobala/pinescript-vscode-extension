const { Parser, Language } = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');
const { Analyzer } = require('../out/src/analyzer');

async function main() {
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../out/src/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const scriptPath = process.argv[2];
    if (!scriptPath) {
        console.error("Usage: node debug_diagnostics.js <path_to_pine_script>");
        process.exit(1);
    }

    console.log(`Analyzing: ${scriptPath}`);
    const code = fs.readFileSync(scriptPath, 'utf8');
    const tree = parser.parse(code);

    const definitionsPath = path.join(__dirname, '../src/data/definitions.json');
    const definitions = JSON.parse(fs.readFileSync(definitionsPath, 'utf8'));

    // Create analyzer instance
    const analyzer = new Analyzer(definitions);
    const diagnostics = analyzer.analyze(tree.rootNode);

    console.log(`\n--- Diagnostics Found: ${diagnostics.length} ---`);
    if (diagnostics.length === 0) {
        console.log("No issues found.");
    } else {
        // Group by message to identify patterns
        const grouped = {};
        diagnostics.forEach(d => {
            const msg = d.message;
            if (!grouped[msg]) grouped[msg] = [];
            grouped[msg].push(d.range.start.line + 1);
        });

        for (const [msg, lines] of Object.entries(grouped)) {
            console.log(`\n[${lines.length}] ${msg}`);
            // Show first 5 lines
            const snippet = lines.slice(0, 5).join(', ');
            console.log(`    Lines: ${snippet}${lines.length > 5 ? '...' : ''}`);
        }
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
