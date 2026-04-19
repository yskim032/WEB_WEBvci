/**
 * PPR Check Logic
 * Validates Excel clipboard data against generated ASC container counts.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Buttons are dynamically checked to exist
    const setupListeners = setInterval(() => {
        const btnImport = document.getElementById('btn-ppr-import');
        const btnExport = document.getElementById('btn-ppr-export');

        if (btnImport || btnExport) {
            if (btnImport) btnImport.addEventListener('click', () => handlePprCheck('import'));
            if (btnExport) btnExport.addEventListener('click', () => handlePprCheck('export'));
            clearInterval(setupListeners);
        }
    }, 500);
});

function handlePprCheck(type) {
    const inputId = `ppr-${type}-input`;
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;

    const input = inputEl.value;
    if (!input.trim()) {
        alert("Please paste data first.");
        return;
    }

    const resultDiv = document.getElementById(`ppr-${type}-result`);
    if (resultDiv) resultDiv.innerHTML = '';

    const ascTotals = getAscTotals(type);
    const resultHtml = processPprHtml(input, ascTotals);

    if (resultDiv) resultDiv.innerHTML = resultHtml;
}

function getAscTotals(type) {
    let mainType = type === 'import' ? 'DIS' : 'LOD';
    let tsType = type === 'import' ? 'TSD' : 'TSL';

    let localFull = 0, localEmpty = 0;
    let ownTsFull = 0, ownTsEmpty = 0;
    let otherTsFull = 0, otherTsEmpty = 0;
    let tpfCount = 0;

    // Compute active merged containers to ensure type assignments are applied
    const merged = window.mergeAndAssignTypes ? window.mergeAndAssignTypes() : {};

    for (const [cnum, rec] of Object.entries(merged)) {
        const isFull = (rec.fullempty === 'F');
        const isEmpty = (rec.fullempty === 'E');

        if (rec.type === mainType) {
            if (isFull) localFull++;
            if (isEmpty) localEmpty++;
        }

        if (rec.type === tsType) {
            // Own T/S (자 T/S) excludes "to truck"
            const isToTruck = rec.fromtotruck === 1;
            // Other T/S (타 T/S) requires "to rail" which maps to TPF here
            const isToTpf = rec.fromtotpf === 1;

            if (!isToTruck) {
                if (isFull) ownTsFull++;
                if (isEmpty) ownTsEmpty++;
            }

            if (isToTpf) {
                if (isFull) otherTsFull++;
                if (isEmpty) otherTsEmpty++;
            }

            // Count TPF specifically for the red text message between the rows
            if (isToTpf) {
                tpfCount++;
            }
        }
    }

    return {
        localFull, localEmpty,
        ownTsFull, ownTsEmpty,
        otherTsFull, otherTsEmpty,
        tpfCount
    };
}

function extractValues(line, keywordMatch) {
    const parts = line.split('\t').map(s => s.trim());
    let idx = -1;
    for (let i = 0; i < parts.length; i++) {
        if (parts[i].includes(keywordMatch) || parts[i] === keywordMatch) {
            idx = i;
            break;
        }
    }

    if (idx === -1) return { found: false, fullVals: [], emptyVals: [], fullSum: 0, emptySum: 0 };

    const fullVals = [];
    const emptyVals = [];
    let fullSum = 0;
    let emptySum = 0;

    // Next 4 cells are FULL (20, 40, 40HC, 45)
    for (let i = 1; i <= 4; i++) {
        const valStr = parts[idx + i] || "";
        const val = parseInt(valStr.replace(/,/g, ''), 10) || 0;
        fullVals.push(valStr);
        fullSum += val;
    }

    // Following 4 cells are EMPTY
    for (let i = 5; i <= 8; i++) {
        const valStr = parts[idx + i] || "";
        const val = parseInt(valStr.replace(/,/g, ''), 10) || 0;
        emptyVals.push(valStr);
        emptySum += val;
    }

    return { found: true, fullVals, emptyVals, fullSum, emptySum };
}

function processPprHtml(input, ascTotals) {
    const lines = input.split(/\r?\n/);

    let localData = { fullSum: 0, emptySum: 0, found: false };
    let ownData = { fullSum: 0, emptySum: 0, found: false };
    let otherData = { fullSum: 0, emptySum: 0, found: false };

    for (const line of lines) {
        if (line.includes("LOCAL")) localData = extractValues(line, "LOCAL");
        else if (line.includes("자 T/S") || line.includes("자T/S") || line.includes("자")) ownData = extractValues(line, "자 T/S");
        else if (line.includes("타 T/S") || line.includes("타T/S") || line.includes("타")) otherData = extractValues(line, "타 T/S");
    }

    if (!ownData.found) {
        for (const line of lines) {
            if (line.replace(/\s+/g, '').includes("자T/S")) ownData = extractValues(line, line.includes("자 ") ? "자 " : "자T");
        }
    }
    if (!otherData.found) {
        for (const line of lines) {
            if (line.replace(/\s+/g, '').includes("타T/S")) otherData = extractValues(line, line.includes("타 ") ? "타 " : "타T");
        }
    }

    const isLocalFullOk = localData.fullSum === ascTotals.localFull;
    const isLocalEmptyOk = localData.emptySum === ascTotals.localEmpty;

    const isOwnFullOk = ownData.fullSum === ascTotals.ownTsFull;
    const isOwnEmptyOk = ownData.emptySum === ascTotals.ownTsEmpty;

    const isOtherFullOk = otherData.fullSum === ascTotals.otherTsFull;
    const isOtherEmptyOk = otherData.emptySum === ascTotals.otherTsEmpty;

    const getBgColor = (isOk, defaultBg) => {
        return isOk ? 'background-color: #00B050; color: white;' : 'background-color: #FF0000; color: white;';
    };

    // Replace the HTML builder with native Excel-like table
    let html = `
    <table style="width: auto; border-collapse: collapse; text-align: center; font-family: 'Malgun Gothic', Arial, sans-serif; font-size: 13px; color: black; margin-top: 10px;">
        <tbody>
            <tr>
                <td rowspan="3" colspan="2" style="width: 120px; border: 1px solid black; background-color: #C0C0C0; vertical-align: middle; text-align: center;">STATUS</td>
                <td colspan="8" style="height: 25px; border: 1px solid black; background-color: #CCFFCC; vertical-align: middle; text-align: center;">BOX OPERATOR ACCOUNT</td>
                <td rowspan="3" style="width: 60px; border: 1px solid black; background-color: #C0C0C0; vertical-align: middle; text-align: center; font-weight: bold;">TPF</td>
            </tr>
            <tr>
                <td colspan="4" style="height: 20px; border: 1px solid black; background-color: #C0C0C0; vertical-align: middle; text-align: center;">FULL</td>
                <td colspan="4" style="height: 20px; border: 1px solid black; background-color: #C0C0C0; vertical-align: middle; text-align: center;">EMPTY</td>
            </tr>
            <tr>
                <td style="width: 50px; height: 20px; border: 1px solid black; background-color: #C0C0C0; vertical-align: middle; text-align: center;">20'</td>
                <td style="width: 50px; border: 1px solid black; background-color: #C0C0C0; vertical-align: middle; text-align: center;">40'</td>
                <td style="width: 50px; border: 1px solid black; background-color: #C0C0C0; vertical-align: middle; text-align: center;">40'HC</td>
                <td style="width: 50px; border: 1px solid black; background-color: #C0C0C0; vertical-align: middle; text-align: center;">45'</td>
                <td style="width: 50px; border: 1px solid black; background-color: #C0C0C0; vertical-align: middle; text-align: center;">20'</td>
                <td style="width: 50px; border: 1px solid black; background-color: #C0C0C0; vertical-align: middle; text-align: center;">40'</td>
                <td style="width: 50px; border: 1px solid black; background-color: #C0C0C0; vertical-align: middle; text-align: center;">40'HC</td>
                <td style="width: 50px; border: 1px solid black; background-color: #C0C0C0; vertical-align: middle; text-align: center;">45'</td>
            </tr>
    `;

    const buildTr = (label, labelColor, data, isFullOk, isEmptyOk, extraTh = '') => {
        let rowHtml = ``;
        if (label === 'LOCAL') {
            rowHtml += `<tr><td rowspan="3" style="border: 1px solid black; background-color: #CCFFCC; vertical-align: middle; text-align: center; font-weight: bold;">MSC</td>`;
        } else {
            rowHtml += `<tr>`;
        }

        rowHtml += `<td style="border: 1px solid black; background-color: #C0C0C0; color: ${labelColor}; height: 30px; vertical-align: middle; text-align: center;">${label}</td>`;

        // FULL cells
        let fullStyle = getBgColor(isFullOk, '#B3D4FF'); // Original light blue
        if (!data.found && !isFullOk) fullStyle = 'background-color: #B3D4FF; color: black;'; // If not found and not ok, just use default
        else if (data.found) fullStyle = getBgColor(isFullOk, '#B3D4FF');
        else fullStyle = 'background-color: #B3D4FF; color: black;';

        for (let i = 0; i < 4; i++) {
            rowHtml += `<td style="border: 1px solid black; vertical-align: middle; text-align: center; ${fullStyle}">${data.found ? (data.fullVals[i] || '') : ''}</td>`;
        }

        // EMPTY cells
        let emptyStyle = getBgColor(isEmptyOk, '#FFFFFF'); // Original white
        if (!data.found && !isEmptyOk) emptyStyle = 'background-color: #FFFFFF; color: black;';
        else if (data.found) emptyStyle = getBgColor(isEmptyOk, '#FFFFFF');
        else emptyStyle = 'background-color: #FFFFFF; color: black;';

        for (let i = 0; i < 4; i++) {
            rowHtml += `<td style="border: 1px solid black; vertical-align: middle; text-align: center; ${emptyStyle}">${data.found ? (data.emptyVals[i] || '') : ''}</td>`;
        }

        if (extraTh) {
            rowHtml += extraTh;
        }

        rowHtml += `</tr>`;
        return rowHtml;
    };

    html += buildTr("LOCAL", "black", localData, isLocalFullOk, isLocalEmptyOk, `<td style="border: 1px solid black; background-color: #C0C0C0; vertical-align: middle; text-align: center;"></td>`);
    html += buildTr("자 T/S", "red", ownData, isOwnFullOk, isOwnEmptyOk, `<td rowspan="2" style="border: 1px solid black; background-color: #FFFFCC; color: red; font-size: 1.4em; font-weight: bold; vertical-align: middle; text-align: center;">${ascTotals.tpfCount}</td>`);
    html += buildTr("타 T/S", "blue", otherData, isOtherFullOk, isOtherEmptyOk, ``);

    html += `</tbody></table>`;

    html += `<div style="margin-top:15px; font-size:12px; color:#666; text-align: left;">
        LOCAL Full/Empty: ${ascTotals.localFull}/${ascTotals.localEmpty} | 
        자 T/S Full/Empty: ${ascTotals.ownTsFull}/${ascTotals.ownTsEmpty} | 
        타 T/S Full/Empty: ${ascTotals.otherTsFull}/${ascTotals.otherTsEmpty}
    </div>`;

    return html;
}
