import * as path from 'path';
import {
    workspace,
    ExtensionContext,
    window,
    WebviewView,
    WebviewViewProvider,
    WebviewViewResolveContext,
    CancellationToken,
    commands,
    TextDocument,
    Uri
} from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface InputItem {
    type: string;
    title: string;
    defval: string;
    options: string[];
    group: string;
    tooltip: string;
    minval: string;
    maxval: string;
    step: string;
    inline: string;
    confirm: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser — single-pass regex over raw text
// ─────────────────────────────────────────────────────────────────────────────

function parseInputCalls(text: string): InputItem[] {
    const results: InputItem[] = [];
    const lines = text.split('\n');

    // Match input.type( or input( at the start (not in a comment)
    const callRe = /^(?!\s*\/\/).*\binput(?:\.(int|float|bool|string|color|source|timeframe|session|symbol|price|time))?\s*\(/;

    for (const raw of lines) {
        const line = raw.trim();
        if (!callRe.test(line)) continue;

        // Extract the type
        const typeMatch = line.match(/\binput\.(\w+)\s*\(/);
        const legacyMatch = line.match(/\binput\s*\(/);
        let inputType = typeMatch ? typeMatch[1] : (legacyMatch ? 'legacy' : null);
        if (!inputType) continue;

        // Grab everything between the outermost ( … ) for this call
        const openIdx = line.indexOf('(');
        // Handle calls that span within a single line (balanced parens)
        let depth = 0;
        let argStr = '';
        for (let i = openIdx; i < line.length; i++) {
            if (line[i] === '(') depth++;
            else if (line[i] === ')') { depth--; if (depth === 0) { argStr = line.substring(openIdx + 1, i); break; } }
        }
        if (!argStr && depth > 0) {
            // Multi-line call — skip in v1 (documented limitation)
            continue;
        }

        const item: InputItem = {
            type: inputType,
            title: '',
            defval: '',
            options: [],
            group: '',
            tooltip: '',
            minval: '',
            maxval: '',
            step: '',
            inline: '',
            confirm: false
        };

        // --- Extract named args ---
        item.title   = extractStringArg(argStr, 'title')   ?? '';
        item.defval  = extractAnyArg(argStr, 'defval')     ?? '';
        item.group   = extractStringArg(argStr, 'group')   ?? '';
        item.tooltip = extractStringArg(argStr, 'tooltip') ?? '';
        item.minval  = extractAnyArg(argStr, 'minval')     ?? '';
        item.maxval  = extractAnyArg(argStr, 'maxval')     ?? '';
        item.step    = extractAnyArg(argStr, 'step')       ?? '';
        item.inline  = extractStringArg(argStr, 'inline')  ?? '';
        item.confirm = /\bconfirm\s*=\s*true\b/.test(argStr);

        // --- options=[...] ---
        const optMatch = argStr.match(/options\s*=\s*\[([^\]]*)\]/);
        if (optMatch) {
            item.options = optMatch[1]
                .split(',')
                .map(o => o.trim().replace(/^["']|["']$/g, ''))
                .filter(Boolean);
        }

        // --- Positional defval fallback (first arg if no named defval) ---
        if (!item.defval) {
            const pos = firstPositionalArg(argStr);
            if (pos !== null) item.defval = pos;
        }

        // --- Title fallback: use variable name on the left of = ---
        if (!item.title) {
            const varMatch = raw.match(/\b([a-zA-Z_]\w*)\s*(?::=|=)\s*input/);
            if (varMatch) {
                item.title = varName(varMatch[1]);
            } else {
                item.title = `${inputType.charAt(0).toUpperCase() + inputType.slice(1)} Input`;
            }
        }

        // --- Legacy type inference ---
        if (inputType === 'legacy') {
            if (/^(true|false)$/i.test(item.defval)) {
                item.type = 'bool';
            } else if (/^["']/.test(item.defval)) {
                item.type = 'string';
            } else if (!isNaN(Number(item.defval))) {
                item.type = 'float';
            } else {
                item.type = 'int';
            }
        }

        results.push(item);
    }

    return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractStringArg(argStr: string, key: string): string | null {
    const re = new RegExp(`\\b${key}\\s*=\\s*["']([^"']*)["']`);
    const m = argStr.match(re);
    return m ? m[1] : null;
}

function extractAnyArg(argStr: string, key: string): string | null {
    const re = new RegExp(`\\b${key}\\s*=\\s*([^,)\\]]+)`);
    const m = argStr.match(re);
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

function firstPositionalArg(argStr: string): string | null {
    // Skip over any leading whitespace; take up to first comma not inside brackets
    const trimmed = argStr.trim();
    if (!trimmed || trimmed.startsWith(')')) return null;
    // If first char is a named arg (word=), return null
    if (/^\w+\s*=/.test(trimmed)) return null;
    const end = findArgEnd(trimmed, 0);
    return trimmed.substring(0, end).trim().replace(/^["']|["']$/g, '');
}

function findArgEnd(s: string, start: number): number {
    let depth = 0;
    for (let i = start; i < s.length; i++) {
        if (s[i] === '(' || s[i] === '[') depth++;
        else if (s[i] === ')' || s[i] === ']') { if (depth === 0) return i; depth--; }
        else if (s[i] === ',' && depth === 0) return i;
    }
    return s.length;
}

function varName(raw: string): string {
    // Convert snake_case / camelCase to Title Case words
    return raw
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, c => c.toUpperCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// WebviewViewProvider
// ─────────────────────────────────────────────────────────────────────────────

class InputPreviewProvider implements WebviewViewProvider {
    public static readonly viewId = 'pinescript.inputPreview';
    private _view?: WebviewView;
    private _currentItems: InputItem[] = [];

    constructor(private readonly _extensionUri: Uri) {}

    resolveWebviewView(
        webviewView: WebviewView,
        _context: WebviewViewResolveContext,
        _token: CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._buildHtml(this._currentItems);
    }

    update(items: InputItem[]) {
        this._currentItems = items;
        if (this._view) {
            this._view.webview.html = this._buildHtml(items);
        }
    }

    // ── HTML generation ──────────────────────────────────────────────────────

    private _buildHtml(items: InputItem[]): string {
        if (items.length === 0) {
            return this._emptyState();
        }

        // Group items
        const groups = new Map<string, InputItem[]>();
        for (const item of items) {
            const g = item.group || '__default__';
            if (!groups.has(g)) groups.set(g, []);
            groups.get(g)!.push(item);
        }

        const hasGroups = groups.size > 1 || !groups.has('__default__');
        const groupNames = [...groups.keys()];

        // Build tab strip
        let tabStrip = '';
        let tabPanels = '';

        if (hasGroups) {
            tabStrip = `<div class="tab-strip">` +
                groupNames.map((g, i) =>
                    `<button class="tab${i === 0 ? ' active' : ''}" data-tab="${i}">${g === '__default__' ? 'General' : g}</button>`
                ).join('') +
                `</div>`;

            tabPanels = groupNames.map((g, i) =>
                `<div class="tab-panel${i === 0 ? ' active' : ''}" data-panel="${i}">
                    ${this._renderRows(groups.get(g)!)}
                </div>`
            ).join('');
        } else {
            tabPanels = `<div class="tab-panel active">${this._renderRows(items)}</div>`;
        }

        return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline';">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<title>Settings Preview</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:          #131722;
    --surface:     #1E222D;
    --surface2:    #2A2E39;
    --border:      #363A45;
    --border-lite: #2A2E39;
    --accent:      #2196F3;
    --accent-glow: rgba(33,150,243,0.15);
    --text:        #D1D4DC;
    --text-dim:    #787B86;
    --text-label:  #9598A1;
    --toggle-off:  #434651;
    --toggle-on:   #2196F3;
    --green:       #26A69A;
    --radius:      4px;
    --radius-lg:   8px;
    --font:        'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    font-size: 12px;
    line-height: 1.5;
    min-height: 100vh;
  }

  /* ── Dialog shell ── */
  .dialog {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .dialog-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px 0;
    border-bottom: 1px solid var(--border);
    padding-bottom: 0;
  }

  .dialog-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    opacity: 0.9;
    padding-bottom: 10px;
    flex: 1;
  }

  .badge {
    background: var(--accent-glow);
    border: 1px solid var(--accent);
    color: var(--accent);
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 10px;
    letter-spacing: 0.4px;
    margin-bottom: 10px;
  }

  /* ── Tab strip ── */
  .tab-strip {
    display: flex;
    gap: 0;
    padding: 0 14px;
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tab-strip::-webkit-scrollbar { display: none; }

  .tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-dim);
    cursor: pointer;
    font-family: var(--font);
    font-size: 12px;
    font-weight: 500;
    padding: 8px 12px;
    transition: color 0.15s, border-color 0.15s;
    white-space: nowrap;
    margin-bottom: -1px;
  }
  .tab:hover  { color: var(--text); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }

  /* ── Panels ── */
  .tab-panel { display: none; padding: 6px 0; overflow-y: auto; flex: 1; }
  .tab-panel.active { display: block; }

  .dialog-body { flex: 1; overflow-y: auto; padding: 6px 0; }

  /* ── Rows ── */
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 9px 14px;
    border-bottom: 1px solid var(--border-lite);
    transition: background 0.1s;
  }
  .row:last-child { border-bottom: none; }
  .row:hover { background: rgba(255,255,255,0.02); }

  .row-label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }
  .row-label .label-text {
    font-size: 12px;
    color: var(--text-label);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .row-label .label-tooltip {
    font-size: 10px;
    color: var(--text-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .row-control { flex-shrink: 0; display: flex; align-items: center; gap: 6px; }

  .type-badge {
    font-size: 9px;
    font-weight: 600;
    color: var(--text-dim);
    background: var(--surface2);
    padding: 1px 5px;
    border-radius: 3px;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    border: 1px solid var(--border);
  }

  /* ── Number input ── */
  .ctrl-number {
    display: flex;
    align-items: center;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    height: 26px;
  }
  .ctrl-number input {
    background: none;
    border: none;
    color: var(--text);
    font-family: var(--font);
    font-size: 12px;
    width: 68px;
    text-align: center;
    outline: none;
    padding: 0 4px;
  }
  .ctrl-number .stepper {
    display: flex;
    flex-direction: column;
    border-left: 1px solid var(--border);
  }
  .ctrl-number .stepper button {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 9px;
    height: 13px;
    line-height: 1;
    padding: 0 5px;
    transition: background 0.1s, color 0.1s;
  }
  .ctrl-number .stepper button:hover { background: var(--accent-glow); color: var(--accent); }

  /* ── Text input ── */
  .ctrl-text input, .ctrl-text select {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: var(--font);
    font-size: 12px;
    height: 26px;
    min-width: 120px;
    max-width: 160px;
    outline: none;
    padding: 0 8px;
    transition: border-color 0.15s;
  }
  .ctrl-text input:focus, .ctrl-text select:focus {
    border-color: var(--accent);
  }
  .ctrl-text select { padding-right: 4px; cursor: pointer; }
  .ctrl-text select option { background: var(--surface2); }

  /* ── Toggle (bool) ── */
  .ctrl-toggle { position: relative; }
  .ctrl-toggle input[type="checkbox"] { display: none; }
  .ctrl-toggle label {
    display: flex;
    align-items: center;
    cursor: pointer;
    width: 36px;
    height: 20px;
  }
  .ctrl-toggle .track {
    position: relative;
    width: 36px;
    height: 20px;
    background: var(--toggle-off);
    border-radius: 10px;
    transition: background 0.2s;
  }
  .ctrl-toggle .thumb {
    position: absolute;
    left: 2px;
    top: 2px;
    width: 16px;
    height: 16px;
    background: #fff;
    border-radius: 50%;
    transition: left 0.2s, box-shadow 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
  }
  .ctrl-toggle input:checked + label .track { background: var(--toggle-on); }
  .ctrl-toggle input:checked + label .thumb { left: 18px; box-shadow: 0 1px 3px rgba(33,150,243,0.4); }

  /* ── Color swatch ── */
  .ctrl-color {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 3px 8px 3px 4px;
    cursor: pointer;
    height: 26px;
    transition: border-color 0.15s;
  }
  .ctrl-color:hover { border-color: var(--accent); }
  .ctrl-color .swatch {
    width: 18px;
    height: 18px;
    border-radius: 3px;
    border: 1px solid rgba(255,255,255,0.1);
  }
  .ctrl-color .hex {
    font-size: 11px;
    color: var(--text);
    font-family: 'Courier New', monospace;
    letter-spacing: 0.5px;
  }

  /* ── Source / TF / dropdown ── */
  .ctrl-select select {
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-family: var(--font);
    font-size: 12px;
    height: 26px;
    min-width: 100px;
    outline: none;
    padding: 0 6px;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .ctrl-select select:focus { border-color: var(--accent); }
  .ctrl-select select option { background: var(--surface2); }

  /* ── Confirm badge ── */
  .confirm-badge {
    font-size: 9px;
    color: #FF9800;
    background: rgba(255,152,0,0.1);
    border: 1px solid rgba(255,152,0,0.3);
    border-radius: 3px;
    padding: 1px 4px;
    font-weight: 600;
  }

  /* ── Empty state ── */
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    gap: 14px;
    padding: 24px;
    text-align: center;
  }
  .empty-icon {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--surface2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    border: 1px solid var(--border);
  }
  .empty h3 {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }
  .empty p {
    font-size: 11px;
    color: var(--text-dim);
    line-height: 1.6;
    max-width: 200px;
  }
  .empty code {
    font-family: 'Courier New', monospace;
    color: var(--accent);
    font-size: 11px;
    background: var(--accent-glow);
    padding: 0 4px;
    border-radius: 3px;
  }

  /* scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
</style>
</head>
<body>
<div class="dialog">
  <div class="dialog-header">
    <span class="dialog-title">⚙ Settings</span>
    <span class="badge">PREVIEW</span>
  </div>

  ${hasGroups ? tabStrip : ''}

  <div class="dialog-body">
    ${tabPanels}
  </div>
</div>

<script>
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const idx = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector('[data-panel="' + idx + '"]').classList.add('active');
    });
  });

  // Number stepper buttons
  document.querySelectorAll('.ctrl-number').forEach(ctrl => {
    const input = ctrl.querySelector('input');
    ctrl.querySelector('.up')?.addEventListener('click', () => {
      const step = parseFloat(input.getAttribute('data-step') || '1');
      const max  = input.getAttribute('data-max');
      let v = parseFloat(input.value || '0') + step;
      if (max !== null && v > parseFloat(max)) v = parseFloat(max);
      input.value = Number.isInteger(step) ? String(Math.round(v)) : v.toFixed(2);
    });
    ctrl.querySelector('.down')?.addEventListener('click', () => {
      const step = parseFloat(input.getAttribute('data-step') || '1');
      const min  = input.getAttribute('data-min');
      let v = parseFloat(input.value || '0') - step;
      if (min !== null && v < parseFloat(min)) v = parseFloat(min);
      input.value = Number.isInteger(step) ? String(Math.round(v)) : v.toFixed(2);
    });
  });
</script>
</body>
</html>`;
    }

    // ── Row renderer ─────────────────────────────────────────────────────────

    private _renderRows(items: InputItem[]): string {
        // Handle inline grouping (items with same inline= value go side-by-side)
        // For simplicity in v1 render them individually — inline is noted visually
        return items.map(item => this._renderRow(item)).join('');
    }

    private _renderRow(item: InputItem): string {
        const control = this._renderControl(item);
        const tooltip = item.tooltip
            ? `<span class="label-tooltip" title="${escHtml(item.tooltip)}">ⓘ ${escHtml(item.tooltip)}</span>`
            : '';
        const confirmBadge = item.confirm ? `<span class="confirm-badge">CONFIRM</span>` : '';
        const typeLabel = `<span class="type-badge">${escHtml(item.type)}</span>`;

        return /* html */`
<div class="row">
  <div class="row-label">
    <span class="label-text">${escHtml(item.title)}</span>
    ${tooltip}
  </div>
  <div class="row-control">
    ${confirmBadge}
    ${typeLabel}
    ${control}
  </div>
</div>`;
    }

    private _renderControl(item: InputItem): string {
        const t = item.type;

        // ── Bool → toggle ──
        if (t === 'bool') {
            const checked = /^true$/i.test(item.defval) ? 'checked' : '';
            const uid = `tog_${Math.random().toString(36).slice(2)}`;
            return /* html */`
<div class="ctrl-toggle">
  <input type="checkbox" id="${uid}" ${checked}>
  <label for="${uid}">
    <span class="track"><span class="thumb"></span></span>
  </label>
</div>`;
        }

        // ── Color → swatch ──
        if (t === 'color') {
            const hex = normalizeColor(item.defval) || '#2196F3';
            return /* html */`
<div class="ctrl-color" title="Color picker (read-only preview)">
  <span class="swatch" style="background:${hex}"></span>
  <span class="hex">${hex.toUpperCase()}</span>
</div>`;
        }

        // ── String with options → select ──
        if ((t === 'string' || t === 'legacy') && item.options.length > 0) {
            const opts = item.options
                .map(o => `<option${o === item.defval ? ' selected' : ''}>${escHtml(o)}</option>`)
                .join('');
            return `<div class="ctrl-text"><select>${opts}</select></div>`;
        }

        // ── Source → predefined select ──
        if (t === 'source') {
            const sourceOpts = ['close','open','high','low','hl2','hlc3','ohlc4','volume'];
            const defv = item.defval || 'close';
            const opts = sourceOpts.map(o => `<option${o === defv ? ' selected' : ''}>${o}</option>`).join('');
            return `<div class="ctrl-select"><select>${opts}</select></div>`;
        }

        // ── Timeframe → predefined select ──
        if (t === 'timeframe') {
            const tfs = ['1','3','5','15','30','60','120','240','D','W','M'];
            const defv = item.defval || 'D';
            const opts = tfs.map(o => `<option${o === defv ? ' selected' : ''}>${o}</option>`).join('');
            return `<div class="ctrl-select"><select>${opts}</select></div>`;
        }

        // ── Session → text ──
        if (t === 'session') {
            return `<div class="ctrl-text"><input type="text" value="${escHtml(item.defval || '0930-1600')}" placeholder="HHmm-HHmm"></div>`;
        }

        // ── Symbol → text ──
        if (t === 'symbol') {
            return `<div class="ctrl-text"><input type="text" value="${escHtml(item.defval || 'NASDAQ:AAPL')}" placeholder="Exchange:Symbol"></div>`;
        }

        // ── Int / Float / Price → number stepper ──
        if (t === 'int' || t === 'float' || t === 'price' || t === 'legacy') {
            const val   = item.defval || '0';
            const step  = item.step   || (t === 'float' || t === 'price' ? '0.01' : '1');
            const minA  = item.minval ? `data-min="${item.minval}"` : '';
            const maxA  = item.maxval ? `data-max="${item.maxval}"` : '';
            return /* html */`
<div class="ctrl-number">
  <input type="text" value="${escHtml(val)}" data-step="${step}" ${minA} ${maxA} readonly>
  <div class="stepper">
    <button class="up" title="Increment">▲</button>
    <button class="down" title="Decrement">▼</button>
  </div>
</div>`;
        }

        // ── Time → datetime-local ──
        if (t === 'time') {
            return `<div class="ctrl-text"><input type="datetime-local" style="font-size:11px;height:26px;padding:0 4px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:var(--font);outline:none;"></div>`;
        }

        // ── Fallback → text ──
        return `<div class="ctrl-text"><input type="text" value="${escHtml(item.defval)}"></div>`;
    }

    // ── Empty state ──────────────────────────────────────────────────────────

    private _emptyState(): string {
        return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; font-src https://fonts.gstatic.com;">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #131722; --surface2: #2A2E39; --border: #363A45;
    --text: #D1D4DC; --text-dim: #787B86; --accent: #2196F3;
    --accent-glow: rgba(33,150,243,0.12);
  }
  body {
    font-family: 'Inter', -apple-system, sans-serif;
    background: var(--bg);
    color: var(--text);
    display: flex; align-items: center; justify-content: center;
    height: 100vh; padding: 24px; text-align: center;
  }
  .wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .icon {
    width: 56px; height: 56px; border-radius: 50%;
    background: var(--surface2); border: 1px solid var(--border);
    display: flex; align-items: center; justify-content: center;
    font-size: 26px;
    animation: pulse 2.5s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 var(--accent-glow); }
    50%       { box-shadow: 0 0 0 10px transparent; }
  }
  h3 { font-size: 13px; font-weight: 600; }
  p  { font-size: 11px; color: var(--text-dim); line-height: 1.7; max-width: 200px; }
  code { color: var(--accent); background: var(--accent-glow); padding: 1px 5px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 10.5px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="icon">⚙</div>
  <h3>No inputs detected</h3>
  <p>Open a <code>.pine</code> file and add<br><code>input.int()</code>, <code>input.bool()</code>,<br>or any <code>input.*</code> call to see<br>a live settings preview here.</p>
</div>
</body>
</html>`;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function normalizeColor(raw: string): string {
    if (!raw) return '';
    raw = raw.trim().replace(/^["']|["']$/g, '');
    // Already hex
    if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw;
    // color.* Pine constants
    const colorMap: Record<string, string> = {
        'color.red': '#F44336', 'color.green': '#4CAF50', 'color.blue': '#2196F3',
        'color.white': '#FFFFFF', 'color.black': '#000000', 'color.yellow': '#FFEB3B',
        'color.orange': '#FF9800', 'color.purple': '#9C27B0', 'color.gray': '#9E9E9E',
        'color.lime': '#8BC34A', 'color.aqua': '#00BCD4', 'color.fuchsia': '#E91E63',
        'color.navy': '#1A237E', 'color.maroon': '#880E4F', 'color.teal': '#009688',
        'color.silver': '#BDBDBD', 'color.olive': '#827717'
    };
    if (colorMap[raw]) return colorMap[raw];
    // rgb()/rgba() → attempt hex
    const rgbM = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbM) {
        return '#' + [rgbM[1], rgbM[2], rgbM[3]]
            .map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
    }
    return '#2196F3'; // fallback accent
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export function activate(context: ExtensionContext) {

    // ── LSP client (unchanged) ───────────────────────────────────────────────
    const serverModule = context.asAbsolutePath(
        path.join('server', 'out', 'server.js')
    );
    const serverOptions: ServerOptions = {
        run:   { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc }
    };
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'pinescript' }],
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
        }
    };
    client = new LanguageClient('pinescript', 'Pine Script Language Server', serverOptions, clientOptions);
    client.start();

    // ── Input Preview WebviewView ─────────────────────────────────────────────
    const provider = new InputPreviewProvider(context.extensionUri);
    context.subscriptions.push(
        window.registerWebviewViewProvider(InputPreviewProvider.viewId, provider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    // ── Helper: refresh panel for given document ──────────────────────────────
    function refreshPreview(doc: TextDocument | undefined) {
        if (!doc || doc.languageId !== 'pinescript') {
            provider.update([]);
            return;
        }
        const items = parseInputCalls(doc.getText());
        provider.update(items);
    }

    // ── Trigger on active editor change ──────────────────────────────────────
    context.subscriptions.push(
        window.onDidChangeActiveTextEditor(editor => {
            refreshPreview(editor?.document);
        })
    );

    // ── Trigger on document text change ──────────────────────────────────────
    context.subscriptions.push(
        workspace.onDidChangeTextDocument(e => {
            if (window.activeTextEditor?.document === e.document) {
                refreshPreview(e.document);
            }
        })
    );

    // ── Command: open/focus the panel ────────────────────────────────────────
    context.subscriptions.push(
        commands.registerCommand('pinescript.showInputPreview', () => {
            commands.executeCommand('pinescript.inputPreview.focus');
        })
    );

    // ── Seed with current active doc on startup ───────────────────────────────
    refreshPreview(window.activeTextEditor?.document);
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) return undefined;
    return client.stop();
}
