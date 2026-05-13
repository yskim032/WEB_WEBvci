/**
 * Paste List Tab
 * Reads Excel data from clipboard and distributes container numbers
 * by L_TS code (XX=LOCAL/DIS, TI=TS, TX=TRUCK) and TPF flag.
 *
 * DIS columns  (from full sheet): A=CNTR, B=L_TS, C=TPF_CHK  (cols 0,1,2)
 * LOAD columns (from full sheet): D=CNTR, E=L_TS, F=TPF_CHK  (cols 3,4,5)
 *
 * When the user pastes only the DIS portion (3 cols) or the LOAD portion
 * (3 cols) separately, columns are 0,1,2 regardless.  We detect which zone
 * was clicked and use 0-based column offsets accordingly.
 *
 * L_TS mapping:
 *   XX       → LOCAL  (DIS→DIS textarea, LOAD→LOD textarea)
 *   TI       → TS     (DIS→TSD textarea, LOAD→TSL textarea)
 *   TX       → TRUCK  (DIS→disc-truck-text, LOAD→load-truck-text) AND TS (TSD/TSL)
 *   TPF_CHK = 'TPF' → separate TPF list (DIS→disc-tpf-text, LOAD→load-tpf-text)
 */

// ──────────────────────────────────────────────
// State
// ──────────────────────────────────────────────
const pasteListState = {
    dis: { local: [], ts: [], truck: [], tpf: [] },
    load: { local: [], ts: [], truck: [], tpf: [] }
};

// ──────────────────────────────────────────────
// Parse clipboard rows
// ──────────────────────────────────────────────

/**
 * Parse tab-delimited clipboard text into rows of columns.
 * Skips header lines (rows that don't have a valid container number in col 0).
 *
 * @param {string} text       Raw clipboard text
 * @param {number} cntrCol    Column index of container number
 * @param {number} tsCol      Column index of L_TS code
 * @param {number} tpfCol     Column index of TPF_CHK
 * @returns {{ local, ts, truck, tpf }} four arrays of container strings
 */
function parsePasteData(text, cntrCol, tsCol, tpfCol) {
    const result = { local: [], ts: [], truck: [], tpf: [] };
    if (!text || !text.trim()) return result;

    const rows = text.split(/\r?\n/);
    for (const row of rows) {
        const cells = row.split('\t');
        if (cells.length <= cntrCol) continue;

        const cntr = (cells[cntrCol] || '').trim().toUpperCase();
        if (!cntr || !/^[A-Z]{4}\d{7}$/.test(cntr)) continue; // must be a valid container number

        const tsCode = ((cells[tsCol] || '')).trim().toUpperCase();
        const tpfFlag = ((cells[tpfCol] || '')).trim().toUpperCase();

        // 1. If it has TPF flag, add to TPF list
        if (tpfFlag === 'TPF') {
            result.tpf.push(cntr);
        }

        // 2. Also distribute to type buckets based on tsCode (Parallel processing)
        switch (tsCode) {
            case 'XX':
                result.local.push(cntr);
                break;
            case 'TI':
                result.ts.push(cntr);
                break;
            case 'TX':
                result.truck.push(cntr);
                result.ts.push(cntr);     // TX is also included in TS
                break;
            default:
                result.local.push(cntr);
                break; // unknown → default to local
        }
    }

    // Deduplicate
    result.local = [...new Set(result.local)];
    result.ts = [...new Set(result.ts)];
    result.truck = [...new Set(result.truck)];
    result.tpf = [...new Set(result.tpf)];

    return result;
}

// ──────────────────────────────────────────────
// UI helpers
// ──────────────────────────────────────────────
function plSetTextarea(id, list) {
    const el = document.getElementById(id);
    if (el) el.value = list.join('\n');
}

function plSetCount(id, n) {
    const el = document.getElementById(id);
    if (el) el.textContent = n;
}

function plRenderSide(side, data) {
    pasteListState[side] = data;

    const p = side === 'dis' ? 'pl-dis-' : 'pl-load-';

    plSetTextarea(p + 'local', data.local);
    plSetTextarea(p + 'ts', data.ts);
    plSetTextarea(p + 'truck', data.truck);
    plSetTextarea(p + 'tpf', data.tpf);

    plSetCount(p + 'local-cnt', data.local.length);
    plSetCount(p + 'ts-cnt', data.ts.length);
    plSetCount(p + 'truck-cnt', data.truck.length);
    plSetCount(p + 'tpf-cnt', data.tpf.length);
    plSetCount(p + 'local-cnt2', data.local.length);
    plSetCount(p + 'ts-cnt2', data.ts.length);
    plSetCount(p + 'truck-cnt2', data.truck.length);
    plSetCount(p + 'tpf-cnt2', data.tpf.length);
}

function plSetStatus(msg, isError) {
    const el = document.getElementById('pl-status');
    if (!el) return;
    el.textContent = msg;
    el.className = isError ? 'status-error' : 'status-success';
}

// ──────────────────────────────────────────────
// Paste handlers
// ──────────────────────────────────────────────
async function plPasteDis() {
    try {
        const text = await navigator.clipboard.readText();
        if (!text.trim()) { plSetStatus('클립보드가 비어 있습니다.', true); return; }

        // Auto-detect: if first valid row has >= 4 cols, assume full sheet (use cols 0,1,2)
        // If < 4 cols, also use 0,1,2 (user pasted just DIS portion)
        const data = parsePasteData(text, 0, 1, 2);
        plRenderSide('dis', data);

        const total = data.local.length + data.ts.length + data.truck.length + data.tpf.length;
        plSetStatus(`DIS: ${total}건 파싱 완료 (LOCAL ${data.local.length} / TS(TI+TX) ${data.ts.length} / TRUCK(TX) ${data.truck.length} / TPF ${data.tpf.length})`, false);
    } catch (e) {
        console.error('Clipboard read failed:', e);
        plSetStatus('클립보드 접근 실패. 브라우저 권한을 확인하세요.', true);
    }
}

async function plPasteLoad() {
    try {
        const text = await navigator.clipboard.readText();
        if (!text.trim()) { plSetStatus('클립보드가 비어 있습니다.', true); return; }

        // Auto-detect column offsets
        // Try to determine if this is full sheet or just the load portion
        // by checking if row 0 has enough columns for D(3),E(4),F(5)
        let cntrCol = 0, tsCol = 1, tpfCol = 2;
        const firstRow = text.split(/\r?\n/)[0];
        if (firstRow) {
            const cols = firstRow.split('\t');
            if (cols.length >= 6) {
                // Full sheet pasted → use D,E,F = indices 3,4,5
                cntrCol = 3; tsCol = 4; tpfCol = 5;
            }
        }

        const data = parsePasteData(text, cntrCol, tsCol, tpfCol);
        plRenderSide('load', data);

        const total = data.local.length + data.ts.length + data.truck.length + data.tpf.length;
        plSetStatus(`LOAD: ${total}건 파싱 완료 (LOCAL ${data.local.length} / TS(TI+TX) ${data.ts.length} / TRUCK(TX) ${data.truck.length} / TPF ${data.tpf.length})`, false);
    } catch (e) {
        console.error('Clipboard read failed:', e);
        plSetStatus('클립보드 접근 실패. 브라우저 권한을 확인하세요.', true);
    }
}

// ──────────────────────────────────────────────
// Apply to Main textareas
// ──────────────────────────────────────────────

/**
 * Merge paste-list data into the Main tab textareas and dispatch input events
 * so existing count/validation logic picks them up.
 */
function plApplyToMain() {
    const dis = pasteListState.dis;
    const load = pasteListState.load;

    // Helper: append to a textarea and fire input event
    function applyTo(textareaId, list) {
        if (!list || list.length === 0) return;
        const el = document.getElementById(textareaId);
        if (!el) return;

        // Merge with any existing content (avoid duplicates)
        const existing = el.value.trim()
            ? el.value.trim().split(/\s+/).map(s => s.toUpperCase())
            : [];
        const merged = [...new Set([...existing, ...list])];
        el.value = merged.join('\n');
        el.dispatchEvent(new Event('input'));
    }

    // DIS side
    applyTo('dis-textarea', dis.local);   // XX  → Local DIS
    applyTo('tsd-textarea', dis.ts);      // TI+TX → TSD
    applyTo('disc-truck-text', dis.truck);   // TX  → Disc Truck
    applyTo('disc-tpf-text', dis.tpf);     // TPF → Disc TPF

    // LOAD side
    applyTo('lod-textarea', load.local);  // XX  → Local LOD
    applyTo('tsl-textarea', load.ts);     // TI+TX → TSL
    applyTo('load-truck-text', load.truck);  // TX  → Load Truck
    applyTo('load-tpf-text', load.tpf);    // TPF → Load TPF

    // ── Explicitly sync appState.typeAssignments from the DOM ──
    // This guarantees the state is correct before XML generation,
    // regardless of any event-propagation timing issues.
    if (typeof appState !== 'undefined' && typeof extractContainerNumbers === 'function') {
        const readTA = (id) => {
            const el = document.getElementById(id);
            return el ? extractContainerNumbers(el.value) : [];
        };
        appState.typeAssignments.DIS = readTA('dis-textarea');
        appState.typeAssignments.TSD = readTA('tsd-textarea');
        appState.typeAssignments.LOD = readTA('lod-textarea');
        appState.typeAssignments.TSL = readTA('tsl-textarea');
    }

    plSetStatus('Main 탭에 적용 완료! XML을 생성합니다...', false);

    // Trigger Generate XML — call directly (not via .click()) to avoid any
    // browser synthetic-event timing quirks.
    setTimeout(() => {
        if (typeof handleGenerateXml === 'function') {
            handleGenerateXml();
        } else {
            const btn = document.getElementById('generate-xml-btn');
            if (btn) btn.click();
        }
    }, 100);
}

// ──────────────────────────────────────────────
// Init
// ──────────────────────────────────────────────
function initPasteList() {
    // DIS paste drop area
    const disArea = document.getElementById('pl-dis-drop');
    if (disArea) {
        disArea.addEventListener('click', plPasteDis);
    }

    // LOAD paste drop area
    const loadArea = document.getElementById('pl-load-drop');
    if (loadArea) {
        loadArea.addEventListener('click', plPasteLoad);
    }

    // Clear buttons
    const disClear = document.getElementById('pl-dis-clear');
    if (disClear) {
        disClear.addEventListener('click', () => {
            plRenderSide('dis', { local: [], ts: [], truck: [], tpf: [] });
            plSetStatus('DIS 초기화 완료', false);
        });
    }

    const loadClear = document.getElementById('pl-load-clear');
    if (loadClear) {
        loadClear.addEventListener('click', () => {
            plRenderSide('load', { local: [], ts: [], truck: [], tpf: [] });
            plSetStatus('LOAD 초기화 완료', false);
        });
    }

    // Apply + Generate button
    const applyBtn = document.getElementById('pl-apply-btn');
    if (applyBtn) {
        applyBtn.addEventListener('click', plApplyToMain);
    }
}

// Run after DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPasteList);
} else {
    initPasteList();
}
