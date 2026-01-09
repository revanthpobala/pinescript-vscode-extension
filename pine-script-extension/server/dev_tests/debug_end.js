const { Parser, Language } = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');

async function debug() {
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../wasm/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const scriptPath = '/Users/revanth/My-Code/Trading/pine-scripts/revanth-enhanced-indicator.pine';
    const code = fs.readFileSync(scriptPath, 'utf8');
    const tree = parser.parse(code);

    const errors = [];
    const findErrors = (node) => {
        if (node.type === 'ERROR') {
            errors.push({
                line: node.startPosition.row + 1,
                text: node.text.substring(0, 100).replace(/\n/g, '\\n')
            });
        }
        for (let i = 0; i < node.children.length; i++) findErrors(node.children[i]);
    };
    findErrors(tree.rootNode);

    console.log(`--- Errors near the end (Last 20) ---`);
    const uniqueLines = [...new Set(errors.map(e => e.line))].sort((a, b) => a - b);
    uniqueLines.slice(-20).forEach(line => {
        const lineErrors = errors.filter(e => e.line === line);
        console.log(`Line ${String(line).padStart(4)}: ${lineErrors.length} errors. Sample: "${lineErrors[0].text}"`);
    });
}
debug().catch(err => { console.error(err); process.exit(1); });
