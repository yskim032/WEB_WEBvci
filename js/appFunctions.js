/**
 * Additional App Functions
 * Excel paste, validation, XML generation, unmapped types UI
 */

/**
 * Handle Excel paste from clipboard
 */
async function handlePasteExcel() {
    try {
        const text = await navigator.clipboard.readText();

        if (!text || !text.trim()) {
            showError('Clipboard is empty');
            return;
        }

        const rows = text.split(/\r?\n/).filter(row => row.trim());

        if (rows.length < 3) {
            showError('Need at least 3 rows in Excel data');
            return;
        }

        const parsedRows = rows.map(row => row.split('\t'));
        const dataRows = parsedRows.slice(3); // Skip header rows

        if (dataRows.length === 0) {
            showError('No data found after row 3');
            return;
        }

        // Column mapping (0-based indices)
        const mappings = [
            { label: 'DIS', col: 7, textarea: 'dis-textarea' },           // H (index 7)
            { label: 'TSD', col: 8, textarea: 'tsd-textarea' },           // I
            { label: 'Disc TPF', col: 10, textarea: 'disc-tpf-text' },    // K
            { label: 'Disc Truck', col: 9, textarea: 'disc-truck-text' }, // J
            { label: 'LOD', col: 11, textarea: 'lod-textarea' },          // L
            { label: 'TSL', col: 12, textarea: 'tsl-textarea' },          // M
            { label: 'Load Truck', col: 13, textarea: 'load-truck-text' }, // N
            { label: 'Load TPF', col: 14, textarea: 'load-tpf-text' }     // O
        ];

        let summary = [];

        for (const mapping of mappings) {
            const values = extractColumnValues(dataRows, mapping.col);
            const textarea = document.getElementById(mapping.textarea);

            if (textarea && values.length > 0) {
                textarea.value = values.join('\n');
                textarea.dispatchEvent(new Event('input'));
                summary.push(`${mapping.label}: ${values.length}`);
            }
        }

        if (summary.length > 0) {
            showSuccess(`Pasted Excel data - ${summary.join(' / ')}`);
        } else {
            showStatus('No valid container data found in clipboard');
        }

    } catch (error) {
        console.error('Paste error:', error);
        showError('Failed to paste from clipboard. Make sure to allow clipboard access.');
    }
}

/**
 * Extract values from a specific column
 */
function extractColumnValues(dataRows, columnIndex) {
    const values = [];

    for (const row of dataRows) {
        if (columnIndex < row.length) {
            const value = row[columnIndex].trim();
            if (value && CONTAINER_RE.test(value)) {
                values.push(value);
            }
        }
    }

    return values;
}

/**
 * Handle Generate XML
 */
function handleGenerateXml() {
    // Check if we have containers
    if (Object.keys(appState.discContainers).length === 0 &&
        Object.keys(appState.loadContainers).length === 0) {
        showError('Please load at least one ASC file first');
        return;
    }

    try {
        // Merge containers and apply type assignments
        const mergedContainers = mergeAndAssignTypes();

        // Apply unmapped type overrides
        typeMapper.applyOverrides(mergedContainers);

        // Generate XML
        const xmlDoc = buildVcidataXml(mergedContainers, appState.selectedPort);

        // Generate filename
        const filename = generateXmlFilename(appState.selectedPort, appState.metadata);

        // Download
        downloadXml(xmlDoc, filename);

        showSuccess(`XML generated: ${filename} (${Object.keys(mergedContainers).length} containers)`);

    } catch (error) {
        console.error('XML generation error:', error);
        showError('Failed to generate XML: ' + error.message);
    }
}

/**
 * Merge containers and assign types
 */
function mergeAndAssignTypes() {
    const merged = {};
    const port = appState.selectedPort;

    // Helper to normalize port codes
    const normalizePort = (portCode) => {
        if (portCode === 'KRBUS') return 'KRPUS';
        return portCode;
    };

    // Add discharge containers
    for (const [cnum, rec] of Object.entries(appState.discContainers)) {
        const pod = normalizePort(rec.pod || '');
        if (pod.startsWith(port) || pod === port) {
            merged[cnum] = { ...rec };
            // Auto-assign type='DIS' for non-MSC discharge containers
            if (rec.operatorcode !== 'MSC') {
                merged[cnum].type = 'DIS';
            } else {
                merged[cnum].type = ''; // Will be assigned below
            }
        }
    }

    // Add load containers
    for (const [cnum, rec] of Object.entries(appState.loadContainers)) {
        const pol = normalizePort(rec.pol || '');
        if (pol.startsWith(port) || pol === port) {
            if (merged[cnum]) {
                // Already exists from discharge, merge data
                Object.assign(merged[cnum], rec);
                // Keep discharge origin type if already set
            } else {
                merged[cnum] = { ...rec };
                // Auto-assign type='LOD' for non-MSC load containers
                if (rec.operatorcode !== 'MSC') {
                    merged[cnum].type = 'LOD';
                } else {
                    merged[cnum].type = '';
                }
            }
        }
    }

    // Assign types based on text areas
    assignType(merged, appState.typeAssignments.LOD, 'LOD');
    assignType(merged, appState.typeAssignments.DIS, 'DIS');
    assignType(merged, appState.typeAssignments.TSL, 'TSL');
    assignType(merged, appState.typeAssignments.TSD, 'TSD');

    // Assign Account codes
    assignAccount(merged, 'disc');
    assignAccount(merged, 'load');

    // Assign TPF flags
    assignFlag(merged, 'disc-tpf-text', 'fromtotpf');
    assignFlag(merged, 'load-tpf-text', 'fromtotpf');

    // Assign Truck flags
    assignFlag(merged, 'disc-truck-text', 'fromtotruck');
    assignFlag(merged, 'load-truck-text', 'fromtotruck');

    return merged;
}

/**
 * Assign type to containers
 */
function assignType(containers, containerList, typeValue) {
    for (const cnum of containerList) {
        if (containers[cnum]) {
            containers[cnum].type = typeValue;
        }
    }
}

/**
 * Assign account codes
 */
function assignAccount(containers, type) {
    const textarea = document.getElementById(`${type}-account-text`);
    const codeInput = document.getElementById(`${type}-account-code`);

    if (!textarea || !codeInput) return;

    const accountCode = codeInput.value.trim() || 'MSC';
    const containerList = extractContainerNumbers(textarea.value);

    for (const cnum of containerList) {
        if (containers[cnum]) {
            containers[cnum].Account = accountCode;
        }
    }
}

/**
 * Assign flags (TPF, Truck, etc.)
 */
function assignFlag(containers, textareaId, fieldName) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    const containerList = extractContainerNumbers(textarea.value);

    for (const cnum of containerList) {
        if (containers[cnum]) {
            containers[cnum][fieldName] = 1;
        }
    }
}

/**
 * Handle validation
 */
function handleValidate() {
    const result = validator.validate(
        appState.discContainers,
        appState.loadContainers,
        appState.typeAssignments
    );

    // Update summary
    const summaryEl = document.getElementById('correction-summary');
    if (summaryEl) {
        summaryEl.textContent = result.summary;
        summaryEl.className = result.passed ? 'validation-pass' : 'validation-fail';
    }

    // Update discharge validation tree
    updateValidationTree('disc-correction-tree', result.issues.discharge);

    // Update load validation tree
    updateValidationTree('load-correction-tree', result.issues.load);

    // Update discharge status
    const discStatus = document.getElementById('disc-correction-status');
    if (discStatus) {
        const discAsc = Object.keys(appState.discContainers).length;
        const discExcel = appState.typeAssignments.DIS.length + appState.typeAssignments.TSD.length;
        const discOk = result.issues.discharge.length === 0;
        discStatus.textContent = `ASC: ${discAsc} | Excel: ${discExcel} | Status: ${discOk ? '✓ OK' : '⚠ Issues'}`;
    }

    // Update load status
    const loadStatus = document.getElementById('load-correction-status');
    if (loadStatus) {
        const loadAsc = Object.keys(appState.loadContainers).length;
        const loadExcel = appState.typeAssignments.LOD.length + appState.typeAssignments.TSL.length;
        const loadOk = result.issues.load.length === 0;
        loadStatus.textContent = `ASC: ${loadAsc} | Excel: ${loadExcel} | Status: ${loadOk ? '✓ OK' : '⚠ Issues'}`;
    }

    showStatus(result.passed ? 'Validation passed!' : 'Validation found issues');
}

/**
 * Update validation tree
 */
function updateValidationTree(treeId, issues) {
    const tbody = document.querySelector(`#${treeId} tbody`);
    if (!tbody) return;

    tbody.innerHTML = '';

    for (const issue of issues) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="${issue.status.includes('Excel') ? 'excel-only' : 'asc-only'}">${issue.status}</td>
            <td>${issue.container}</td>
            <td>${issue.source}</td>
        `;
        tbody.appendChild(tr);
    }
}

/**
 * Update special cargo summary (DG/OOG)
 */
function updateSpecialCargoSummary() {
    const data = {
        disDg: [],
        disOog: [],
        loadDg: [],
        loadOog: []
    };

    // Discharge
    for (const [cnum, rec] of Object.entries(appState.discContainers)) {
        if (rec.operatorcode === 'MSC') {
            if (rec.imo === 1) data.disDg.push(cnum);
            if (rec.oogcargo === 1) data.disOog.push(cnum);
        }
    }

    // Load
    for (const [cnum, rec] of Object.entries(appState.loadContainers)) {
        if (rec.operatorcode === 'MSC') {
            if (rec.imo === 1) data.loadDg.push(cnum);
            if (rec.oogcargo === 1) data.loadOog.push(cnum);
        }
    }

    // Update UI
    updateSpecialCargoBox('dis-dg-text', 'dis-dg-count', data.disDg);
    updateSpecialCargoBox('dis-oog-text', 'dis-oog-count', data.disOog);
    updateSpecialCargoBox('load-dg-text', 'load-dg-count', data.loadDg);
    updateSpecialCargoBox('load-oog-text', 'load-oog-count', data.loadOog);
}

/**
 * Update special cargo box
 */
function updateSpecialCargoBox(textId, countId, containers) {
    const textarea = document.getElementById(textId);
    const countEl = document.getElementById(countId);

    if (textarea) {
        textarea.value = containers.sort().join('\n');
    }

    if (countEl) {
        countEl.textContent = `${containers.length} cntrs`;
    }
}

/**
 * Setup tabs
 */
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;

            // Remove active class from all
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked
            button.classList.add('active');
            const content = document.getElementById(`${tabName}-tab`);
            if (content) {
                content.classList.add('active');
            }

            // Refresh unmapped table when switching to that tab
            if (tabName === 'unmapped') {
                refreshUnmappedTable();
            } else if (tabName === 'lashing') {
                refreshLashingData();
            }
        });
    });

    setupUnmappedTable();
    setupLashingUI();
}

/**
 * Setup unmapped types table
 */
/**
 * Setup unmapped types table
 */
function setupUnmappedTable() {
    const table = document.getElementById('unmapped-table');
    if (!table) return;

    let isDragging = false;
    let startRowIndex = -1;

    // Double-click to edit (Inline)
    table.addEventListener('dblclick', (e) => {
        const cell = e.target.closest('td');
        if (!cell || cell.cellIndex !== 2) return; // Only "New Type" column
        if (cell.querySelector('input')) return; // Already editing

        const row = cell.closest('tr');
        const container = row.cells[0].textContent;
        const currentValue = cell.textContent;

        // Create input
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
        input.style.width = '100%';
        input.style.height = '40px'; // 2x height
        input.style.fontSize = '1.1em';
        input.style.boxSizing = 'border-box';

        // Save function
        const save = () => {
            const newValue = input.value;
            const resolvedType = typeof resolveTypeEntry === 'function' ? resolveTypeEntry(newValue) : newValue.trim().toUpperCase();

            // cleanup
            cell.textContent = resolvedType;

            // Only update if changed
            if (resolvedType !== currentValue) {
                typeMapper.setOverride(container, resolvedType);
                refreshUnmappedTable();
            }
        };

        // Cancel function
        const cancel = () => {
            cell.textContent = currentValue;
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur(); // Triggers save
            } else if (e.key === 'Escape') {
                input.removeEventListener('blur', save); // Prevent save
                cancel();
            }
        });

        cell.textContent = '';
        cell.appendChild(input);
        input.focus();
    });

    // Mouse events for drag selection
    const tbody = table.querySelector('tbody');

    tbody.addEventListener('mousedown', (e) => {
        const row = e.target.closest('tr');
        if (!row) return;

        // If clicking on input, don't start drag
        if (e.target.tagName === 'INPUT') return;

        isDragging = true;
        startRowIndex = Array.from(tbody.children).indexOf(row);

        // Clear previous selection unless Ctrl is held
        if (!e.ctrlKey && !e.metaKey) {
            tbody.querySelectorAll('tr.selected').forEach(r => r.classList.remove('selected'));
        }

        row.classList.add('selected');
        e.preventDefault(); // Prevent text selection
    });

    tbody.addEventListener('mouseover', (e) => {
        if (!isDragging) return;

        const row = e.target.closest('tr');
        if (!row) return;

        const currentRowIndex = Array.from(tbody.children).indexOf(row);
        const rows = Array.from(tbody.children);

        // Select range
        const start = Math.min(startRowIndex, currentRowIndex);
        const end = Math.max(startRowIndex, currentRowIndex);

        // Clear current dragging selection (keep Ctrl selection logic if needed, but for simple drag we just re-select)
        // For simple drag behavior like Excel:
        rows.forEach((r, i) => {
            if (i >= start && i <= end) {
                r.classList.add('selected');
            } else if (!e.ctrlKey && !e.metaKey) {
                // Deselect others if not holding Ctrl (this is a simplification)
                // A true Excel-like selection with Ctrl+Drag is complex. 
                // Let's stick to simple range drag for now.
                r.classList.remove('selected');
            }
        });
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        startRowIndex = -1;
    });

    // Copy/Paste (Ctrl+C / Ctrl+V) support could be added here later

    // Copy To Selected Button
    const copyBtn = document.getElementById('copy-to-selected-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const selectedRows = Array.from(tbody.querySelectorAll('tr.selected'));

            if (selectedRows.length < 2) {
                showError("Please select at least 2 rows (drag or Ctrl+click)");
                return;
            }

            const containers = selectedRows.map(row => row.cells[0].textContent);
            typeMapper.fillDown(containers);
            refreshUnmappedTable();
        });
    }

    // Ctrl+Z to fill down (Keep existing logic as backup/power user feature)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
            const selectedRows = Array.from(tbody.querySelectorAll('tr.selected'));
            if (selectedRows.length >= 2) {
                e.preventDefault();
                const containers = selectedRows.map(row => row.cells[0].textContent);
                typeMapper.fillDown(containers);
                refreshUnmappedTable();
            }
        }
    });

    // Click to copy container number
    table.addEventListener('click', async (e) => {
        const cell = e.target.closest('td');
        if (!cell || cell.cellIndex !== 0) return; // Only "Container Number" column

        const containerNumber = cell.textContent.trim();
        if (!containerNumber) return;

        try {
            await navigator.clipboard.writeText(containerNumber);

            // Visual feedback
            const originalText = cell.textContent;
            cell.textContent = 'Copied!';
            cell.style.color = '#00b894';
            cell.style.fontWeight = 'bold';

            setTimeout(() => {
                cell.textContent = originalText;
                cell.style.color = '';
                cell.style.fontWeight = '';
            }, 1000);

        } catch (err) {
            console.error('Copy failed:', err);
        }
    });

    setupRecommendModal(tbody);
}

// Lashing UI functions have been moved to js/lashingUI.js
/**
 * Setup Recommend Type Modal
 */
function setupRecommendModal(unmappedTbody) {
    const modal = document.getElementById('recommend-modal');
    const btn = document.getElementById('recommend-type-btn');
    const closeBtn = document.getElementById('close-recommend-modal');
    const searchInput = document.getElementById('recommend-search');
    const tableBody = document.querySelector('#recommend-table tbody');

    if (!modal || !btn || !tableBody) return;

    // Open Modal
    btn.addEventListener('click', () => {
        // Check selection (optional, but good UX to warn if nothing selected)
        // Actually user might want to browse first, but the action requires selection.
        const selectedRows = unmappedTbody.querySelectorAll('tr.selected');
        if (selectedRows.length === 0) {
            showError("Please select at least one row in the Unmapped table first.");
            return;
        }

        modal.style.display = 'flex';
        renderRecommendTable(RECOMMENDATION_DATA);
        searchInput.value = '';
        searchInput.focus();
    });

    // Close Modal
    const closeModal = () => {
        modal.style.display = 'none';
    };
    closeBtn.addEventListener('click', closeModal);

    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Search Filter
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = RECOMMENDATION_DATA.filter(item =>
            item.code.toLowerCase().includes(query) ||
            item.desc.toLowerCase().includes(query) ||
            item.type.toLowerCase().includes(query)
        );
        renderRecommendTable(filtered);
    });

    // Render Table
    function renderRecommendTable(data) {
        tableBody.innerHTML = '';
        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.code}</td>
                <td>${item.desc}</td>
                <td><strong>${item.type}</strong></td>
            `;
            tr.style.cursor = 'pointer';

            // Row Click -> Apply Type
            tr.addEventListener('click', () => {
                applyTypeToSelected(item.type);
                closeModal();
            });

            tableBody.appendChild(tr);
        });
    }

    // Apply Logic
    function applyTypeToSelected(typeValue) {
        const selectedRows = Array.from(unmappedTbody.querySelectorAll('tr.selected'));
        if (selectedRows.length === 0) return;

        const containers = selectedRows.map(row => row.cells[0].textContent);

        containers.forEach(container => {
            typeMapper.setOverride(container, typeValue);
        });

        refreshUnmappedTable();
        showSuccess(`Applied type ${typeValue} to ${containers.length} containers.`);
    }


}

function refreshUnmappedTable() {
    // Get unmapped records from parser
    const unmappedRecords = getUnmappedTypeRecords();
    typeMapper.addUnmappedRecords(unmappedRecords);

    const validContainers = new Set([
        ...Object.keys(appState.discContainers),
        ...Object.keys(appState.loadContainers)
    ]);
    typeMapper.cleanup(validContainers);

    const records = typeMapper.getUnmappedRecordsWithStatus();
    const tbody = document.querySelector('#unmapped-table tbody');

    if (!tbody) return;

    tbody.innerHTML = '';

    for (const rec of records) {
        const tr = document.createElement('tr');
        tr.dataset.container = rec.container;
        tr.className = rec.status === 'Needs Mapping' ? 'needs-mapping' : 'mapped';

        tr.innerHTML = `
            <td class="copyable" title="Click to copy">${rec.container}</td>
            <td>${rec.original}</td>
            <td class="editable">${rec.new}</td>
            <td>${rec.status}</td>
        `;

        tbody.appendChild(tr);
    }

    // Update count and Tab Badge/Style
    const countEl = document.getElementById('unmapped-count');
    const badgeEl = document.getElementById('unmapped-tab-badge');
    const tabBtn = document.querySelector('.tab-button[data-tab="unmapped"]');

    const needsCount = typeMapper.getNeedsMappingCount();

    if (countEl) {
        countEl.textContent = `Unmapped containers: ${records.length} (needs mapping: ${needsCount})`;
    }

    if (badgeEl) {
        badgeEl.textContent = records.length;
        badgeEl.style.display = records.length > 0 ? 'inline' : 'none';

        // Remove existing classes
        if (tabBtn) {
            tabBtn.classList.remove('tab-alert', 'tab-success');

            if (records.length > 0) {
                if (needsCount > 0) {
                    badgeEl.style.color = 'white'; // White text on red bg
                    tabBtn.classList.add('tab-alert');
                } else {
                    badgeEl.style.color = 'white';
                    tabBtn.classList.add('tab-success');
                }
            } else {
                badgeEl.style.color = 'red'; // Default back to red text if hidden/small
            }
        }
    }
}
