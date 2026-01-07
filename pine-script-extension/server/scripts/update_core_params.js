const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/data/definitions.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const updates = {
    'indicator': [
        { "name": "title", "type": "string", "required": true },
        { "name": "shorttitle", "type": "string", "required": false },
        { "name": "overlay", "type": "bool", "required": false },
        { "name": "max_lines_count", "type": "int", "required": false },
        { "name": "max_labels_count", "type": "int", "required": false }
    ],
    'plot': [
        { "name": "series", "type": "series float", "required": true },
        { "name": "title", "type": "string", "required": false },
        { "name": "color", "type": "color", "required": false }
    ],
    'alert': [
        { "name": "message", "type": "series string", "required": true },
        { "name": "freq", "type": "string", "required": false }
    ],
    'ta.sma': [
        { "name": "source", "type": "series float", "required": true },
        { "name": "length", "type": "int", "required": true }
    ],
    'ta.ema': [
        { "name": "source", "type": "series float", "required": true },
        { "name": "length", "type": "int", "required": true }
    ],
    'ta.rsi': [
        { "name": "source", "type": "series float", "required": true },
        { "name": "length", "type": "int", "required": true }
    ],
    'ta.atr': [
        { "name": "length", "type": "int", "required": true }
    ],
    'array.new_float': [
        { "name": "size", "type": "int", "required": true },
        { "name": "initial_value", "type": "float", "required": false }
    ],
    'array.new_int': [
        { "name": "size", "type": "int", "required": true },
        { "name": "initial_value", "type": "int", "required": false }
    ],
    'array.push': [
        { "name": "id", "type": "array", "required": true },
        { "name": "value", "type": "any", "required": true }
    ],
    'array.set': [
        { "name": "id", "type": "array", "required": true },
        { "name": "index", "type": "int", "required": true },
        { "name": "value", "type": "any", "required": true }
    ],
    'array.get': [
        { "name": "id", "type": "array", "required": true },
        { "name": "index", "type": "int", "required": true }
    ],
    'array.size': [
        { "name": "id", "type": "array", "required": true }
    ],
    'math.min': [
        { "name": "v1", "type": "series float", "required": true },
        { "name": "v2", "type": "series float", "required": false },
        { "name": "v3", "type": "series float", "required": false },
        { "name": "v4", "type": "series float", "required": false },
        { "name": "v5", "type": "series float", "required": false }
    ],
    'math.max': [
        { "name": "v1", "type": "series float", "required": true },
        { "name": "v2", "type": "series float", "required": false },
        { "name": "v3", "type": "series float", "required": false },
        { "name": "v4", "type": "series float", "required": false },
        { "name": "v5", "type": "series float", "required": false }
    ],
    'table.new': [
        { "name": "position", "type": "string", "required": true },
        { "name": "columns", "type": "int", "required": true },
        { "name": "rows", "type": "int", "required": true }
    ],
    'table.cell': [
        { "name": "table_id", "type": "table", "required": true },
        { "name": "column", "type": "int", "required": true },
        { "name": "row", "type": "int", "required": true },
        { "name": "text", "type": "string", "required": false }
    ]
};

data.functions.forEach(f => {
    if (updates[f.name]) {
        f.params = updates[f.name];

        // Return type logic
        if (f.name.startsWith('array.new_')) {
            f.returnType = 'array';
        } else if (f.name.startsWith('ta.') || f.name.startsWith('math.')) {
            f.returnType = 'series float';
        } else if (['array.push', 'array.set', 'array.clear', 'table.cell', 'alert', 'indicator', 'strategy'].includes(f.name)) {
            f.returnType = 'void';
        } else if (f.name === 'array.get') {
            f.returnType = 'any';
        } else if (f.name === 'array.size') {
            f.returnType = 'int';
        } else if (f.name === 'table.new') {
            f.returnType = 'table';
        }

        console.log(`Updated ${f.name} (Return: ${f.returnType})`);
    }
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('Done!');
