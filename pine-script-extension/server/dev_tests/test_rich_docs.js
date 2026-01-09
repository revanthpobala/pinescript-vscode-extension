const { Analyzer } = require('../out/analyzer');
const { Parser, Language } = require('web-tree-sitter');
const path = require('path');
const fs = require('fs');

async function testHover() {
    console.log('--- Testing Rich Hover Info ---');
    await Parser.init();
    const parser = new Parser();
    const wasmPath = path.join(__dirname, '../wasm/tree-sitter-pinescript.wasm');
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);

    const definitions = JSON.parse(fs.readFileSync(path.join(__dirname, '../out/data/definitions.json'), 'utf8'));

    // Check some well-known function
    const sma = definitions.functions.find(f => f.name === 'ta.sma');
    console.log(`\nta.sma documentation check:`);
    console.log(`Description: ${sma?.description?.substring(0, 100)}...`);
    console.log(`Params: ${sma?.params.length}`);
    sma?.params.forEach(p => console.log(`  - ${p.name}: ${p.desc}`));

    const security = definitions.functions.find(f => f.name === 'request.security');
    console.log(`\nrequest.security documentation check:`);
    console.log(`Description: ${security?.description?.substring(0, 100)}...`);
}

testHover().catch(err => { console.error(err); process.exit(1); });
