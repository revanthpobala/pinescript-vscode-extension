const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'pineDocs.json');
const outputPath = path.join(__dirname, 'definitions.json');

const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const current = JSON.parse(fs.readFileSync(path.join(__dirname, '../../out/data/definitions.json'), 'utf8'));

const newFunctions = [];
const seen = new Set();

// Helper to convert their param format to ours
function convertParams(syntaxSnippet) {
    if (!syntaxSnippet) return [];
    const params = [];
    // Simple regex to extract params from syntax: funcName(param1, param2=val)
    const match = syntaxSnippet.match(/\((.*)\)/);
    if (match) {
        const parts = match[1].split(',').map(p => p.trim()).filter(p => p);
        for (const part of parts) {
            const [name, def] = part.split('=').map(p => p.trim());
            params.push({
                name: name.replace(/[\[\]]/g, ''), // remove brackets from [param] optional notation
                desc: '',
                type: 'any',
                optional: part.includes('[') || !!def
            });
        }
    }
    return params;
}

// 1. Process Functions
for (const group of raw.functions) {
    for (const doc of group.docs) {
        if (seen.has(doc.name)) continue;
        seen.add(doc.name);

        const description = doc.desc || doc.description || '';
        newFunctions.push({
            name: doc.name,
            description: Array.isArray(description) ? description.join('\n') : description,
            params: doc.args ? doc.args.map(a => ({
                name: a.name,
                desc: a.desc || '',
                type: a.type || 'any',
                optional: a.required === false || !!a.default
            })) : convertParams(doc.syntax),
            returnType: doc.returns || 'any'
        });
    }
}

// 2. Process Variables (add to symbols/definitions if needed, but analyzer handles variables differently)
// For now, let's just merge all functions.

console.log(`Merged ${newFunctions.length} functions.`);

fs.writeFileSync(outputPath, JSON.stringify({ functions: newFunctions }, null, 2));
