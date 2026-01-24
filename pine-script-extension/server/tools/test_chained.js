
const { Analyzer } = require('./src/analyzer');
const { Parser, Language } = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');

async function test() {
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, 'out/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const definitions = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/data/definitions.json'), 'utf8'));
    const analyzer = new Analyzer(definitions);

    const code = `
//@version=5
indicator("Test")
anchorName = "A|B"
string confPart = str.contains(anchorName, "|") ? str.split(anchorName, "|").get(1) : anchorName
bool isTit = true
if isTit
    plot(1)
plot(0)
`;
    const tree = parser.parse(code);
    const diagnostics = analyzer.analyze(tree.rootNode);
    console.log(JSON.stringify(diagnostics, null, 2));
}

test();
