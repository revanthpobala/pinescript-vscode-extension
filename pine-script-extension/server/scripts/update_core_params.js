const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/data/definitions.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const updates = {
    'indicator': [
        { "name": "title", "type": "string", "required": true },
        { "name": "shorttitle", "type": "string", "required": false },
        { "name": "overlay", "type": "bool", "required": false },
        { "name": "format", "type": "string", "required": false },
        { "name": "precision", "type": "int", "required": false },
        { "name": "scale", "type": "string", "required": false },
        { "name": "max_bars_back", "type": "int", "required": false },
        { "name": "max_lines_count", "type": "int", "required": false },
        { "name": "max_labels_count", "type": "int", "required": false },
        { "name": "max_boxes_count", "type": "int", "required": false },
        { "name": "max_polylines_count", "type": "int", "required": false },
        { "name": "explicit_plot_zorder", "type": "bool", "required": false },
        { "name": "timeframe", "type": "string", "required": false },
        { "name": "timeframe_gaps", "type": "bool", "required": false }
    ],
    'strategy': [
        { "name": "title", "type": "string", "required": true },
        { "name": "shorttitle", "type": "string", "required": false },
        { "name": "overlay", "type": "bool", "required": false },
        { "name": "format", "type": "string", "required": false },
        { "name": "precision", "type": "int", "required": false },
        { "name": "scale", "type": "string", "required": false },
        { "name": "pyramiding", "type": "int", "required": false },
        { "name": "calc_on_order_fills", "type": "bool", "required": false },
        { "name": "calc_on_every_tick", "type": "bool", "required": false },
        { "name": "max_bars_back", "type": "int", "required": false },
        { "name": "backtest_fill_limits_assumption", "type": "int", "required": false },
        { "name": "default_qty_type", "type": "string", "required": false },
        { "name": "default_qty_value", "type": "float", "required": false },
        { "name": "initial_capital", "type": "float", "required": false },
        { "name": "currency", "type": "string", "required": false },
        { "name": "slippage", "type": "int", "required": false },
        { "name": "commission_type", "type": "string", "required": false },
        { "name": "commission_value", "type": "float", "required": false },
        { "name": "process_orders_on_close", "type": "bool", "required": false },
        { "name": "close_entries_rule", "type": "string", "required": false },
        { "name": "margin_long", "type": "float", "required": false },
        { "name": "margin_short", "type": "float", "required": false },
        { "name": "explicit_plot_zorder", "type": "bool", "required": false },
        { "name": "max_lines_count", "type": "int", "required": false },
        { "name": "max_labels_count", "type": "int", "required": false },
        { "name": "max_boxes_count", "type": "int", "required": false },
        { "name": "timeframe", "type": "string", "required": false },
        { "name": "timeframe_gaps", "type": "bool", "required": false },
        { "name": "risk_free_rate", "type": "float", "required": false }
    ],
    'plot': [
        { "name": "series", "type": "series float", "required": true },
        { "name": "title", "type": "string", "required": false },
        { "name": "color", "type": "color", "required": false },
        { "name": "linewidth", "type": "int", "required": false },
        { "name": "style", "type": "string", "required": false },
        { "name": "trackprice", "type": "bool", "required": false },
        { "name": "histbase", "type": "float", "required": false },
        { "name": "offset", "type": "int", "required": false },
        { "name": "join", "type": "bool", "required": false },
        { "name": "editable", "type": "bool", "required": false },
        { "name": "show_last", "type": "int", "required": false },
        { "name": "display", "type": "string", "required": false }
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
        { "name": "rows", "type": "int", "required": true },
        { "name": "bgcolor", "type": "color", "required": false },
        { "name": "frame_color", "type": "color", "required": false },
        { "name": "frame_width", "type": "int", "required": false },
        { "name": "border_color", "type": "color", "required": false },
        { "name": "border_width", "type": "int", "required": false }
    ],
    'table.cell': [
        { "name": "table_id", "type": "table", "required": true },
        { "name": "column", "type": "int", "required": true },
        { "name": "row", "type": "int", "required": true },
        { "name": "text", "type": "string", "required": false },
        { "name": "width", "type": "float", "required": false },
        { "name": "height", "type": "float", "required": false },
        { "name": "text_color", "type": "color", "required": false },
        { "name": "text_halign", "type": "string", "required": false },
        { "name": "text_valign", "type": "string", "required": false },
        { "name": "text_size", "type": "string", "required": false },
        { "name": "bgcolor", "type": "color", "required": false },
        { "name": "tooltip", "type": "string", "required": false },
        { "name": "text_font_family", "type": "string", "required": false }
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
        } else if (['array.push', 'array.set', 'array.clear', 'table.cell', 'alert', 'indicator', 'strategy', 'library'].includes(f.name)) {
            f.returnType = 'void';
        } else if (f.name === 'array.get') {
            f.returnType = 'any';
        } else if (f.name === 'array.size') {
            f.returnType = 'int';
        } else if (f.name === 'table.new') {
            f.returnType = 'table';
        } else if (f.name === 'plot') {
            f.returnType = 'plot';
        }

        console.log(`Updated ${f.name} (Return: ${f.returnType})`);
    }
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('Done!');
