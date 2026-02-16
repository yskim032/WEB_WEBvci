/**
 * Main Application Controller
 * Manages state and coordinates all components
 */

// Application state
const appState = {
    discContainers: {},
    loadContainers: {},
    discLines: [],
    loadLines: [],
    selectedPort: 'KRPUS',
    typeAssignments: {
        LOD: [],
        DIS: [],
        TSL: [],
        TSD: []
    },
    oogContainers: {
        dis: [],
        load: []
    },
    dgContainers: {
        dis: [],
        load: []
    },
    metadata: {
        vessel: '',
        voyage: ''
    }
};

/**
 * Initialize application
 */
function initApp() {
    setupEventListeners();
    updateAllCounts();

    console.log('ASC to VCI XML Converter initialized');
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // File upload zones
    setupFileDropZone('disc-drop-zone', 'disc-file-input', handleDischargeFile);
    setupFileDropZone('load-drop-zone', 'load-file-input', handleLoadFile);

    // Port selection
    document.querySelectorAll('input[name="port"]').forEach(radio => {
        radio.addEventListener('change', handlePortChange);
    });

    // Type assignment text areas
    ['LOD', 'DIS', 'TSL', 'TSD'].forEach(type => {
        const textarea = document.getElementById(`${type.toLowerCase()}-textarea`);
        if (textarea) {
            textarea.addEventListener('input', () => updateTypeAssignmentCount(type));
        }
    });

    // Account, TPF, Truck text areas
    setupAccountTextAreas();

    // OOG and DG text areas
    setupSpecialCargoTextAreas();

    // Button: Paste Excel
    const pasteBtn = document.getElementById('paste-excel-btn');
    if (pasteBtn) {
        pasteBtn.addEventListener('click', handlePasteExcel);
    }

    // Button: Generate XML
    const generateBtn = document.getElementById('generate-xml-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerateXml);
    }

    // Button: Validate
    const validateBtn = document.getElementById('validate-btn');
    if (validateBtn) {
        validateBtn.addEventListener('click', handleValidate);
    }

    // Tab switching
    setupTabs();

    // Unmapped types table events
    setupUnmappedTable();
}

/**
 * Setup file drop zone with drag & drop and browse
 */
function setupFileDropZone(dropZoneId, fileInputId, handler) {
    const dropZone = document.getElementById(dropZoneId);
    const fileInput = document.getElementById(fileInputId);

    if (!dropZone || !fileInput) return;

    // Click to browse
    dropZone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handler(file);
    });

    // Drag & drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        const file = e.dataTransfer.files[0];
        if (file) handler(file);
    });
}

/**
 * Handle discharge file upload
 */
async function handleDischargeFile(file) {
    try {
        const content = await readFileAsText(file);
        const result = parseAscFile(content, 'discharge');

        appState.discContainers = result.containers;
        appState.discLines = result.lines;

        // Extract metadata from discharge file
        const meta = extractVesselAndVoyage(result.lines);
        appState.metadata = meta;

        // Update UI
        document.getElementById('disc-file-path').textContent = file.name;
        updateAllCounts();
        updateSpecialCargoSummary();
        refreshUnmappedTable();
        refreshLashingData();

        showStatus(`Loaded discharge file: ${file.name} (${Object.keys(result.containers).length} containers)`);
    } catch (error) {
        console.error('Error loading discharge file:', error);
        showError('Failed to load discharge file: ' + error.message);
    }
}

/**
 * Handle load file upload
 */
async function handleLoadFile(file) {
    try {
        const content = await readFileAsText(file);
        const result = parseAscFile(content, 'load');

        appState.loadContainers = result.containers;
        appState.loadLines = result.lines;

        // Update UI
        document.getElementById('load-file-path').textContent = file.name;
        updateAllCounts();
        updateSpecialCargoSummary();
        refreshUnmappedTable();
        refreshLashingData();

        showStatus(`Loaded load file: ${file.name} (${Object.keys(result.containers).length} containers)`);
    } catch (error) {
        console.error('Error loading load file:', error);
        showError('Failed to load load file: ' + error.message);
    }
}

/**
 * Read file as text
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('File read error'));
        reader.readAsText(file);
    });
}

/**
 * Handle port change
 */
function handlePortChange(e) {
    appState.selectedPort = e.target.value;
    updateAllCounts();
}

/**
 * Update all counts
 */
function updateAllCounts() {
    updateMatchedCounts();
    updateLashingCounts();
    updateTypeAssignmentCounts();
}

/**
 * Update matched container counts
 */
function updateMatchedCounts() {
    const port = appState.selectedPort;

    // Count discharge containers matching port
    let discCount = 0;
    for (const [cnum, rec] of Object.entries(appState.discContainers)) {
        const pod = rec.pod || '';
        if (pod.startsWith(port) || pod === port) {
            discCount++;
        }
    }

    // Count load containers matching port
    let loadCount = 0;
    for (const [cnum, rec] of Object.entries(appState.loadContainers)) {
        const pol = rec.pol || '';
        if (pol.startsWith(port) || pol === port) {
            loadCount++;
        }
    }

    // Update UI
    const discCountEl = document.getElementById('disc-count');
    const loadCountEl = document.getElementById('load-count');

    if (discCountEl) discCountEl.textContent = `Matched containers: ${discCount}`;
    if (loadCountEl) loadCountEl.textContent = `Matched containers: ${loadCount}`;
}

/**
 * Update lashing counts
 */
function updateLashingCounts() {
    const port = appState.selectedPort;

    let discLashing = 0;
    let loadLashing = 0;

    // Count discharge lashing containers
    for (const [cnum, rec] of Object.entries(appState.discContainers)) {
        const pod = rec.pod || '';
        if (pod.startsWith(port) || pod === port) {
            const line = rec._line || '';
            if (line && isLashingContainer(line)) {
                discLashing++;
            }
        }
    }

    // Count load lashing containers
    for (const [cnum, rec] of Object.entries(appState.loadContainers)) {
        const pol = rec.pol || '';
        if (pol.startsWith(port) || pol === port) {
            const line = rec._line || '';
            if (line && isLashingContainer(line)) {
                loadLashing++;
            }
        }
    }

    const total = discLashing + loadLashing;

    // Update UI
    const discEl = document.getElementById('lashing-disc');
    const loadEl = document.getElementById('lashing-load');
    const totalEl = document.getElementById('lashing-total');

    if (discEl) discEl.textContent = `DIS: ${discLashing}`;
    if (loadEl) loadEl.textContent = `LOD: ${loadLashing}`;
    if (totalEl) totalEl.textContent = `Total: ${total}`;

    // Check for non-MSC account warning
    checkNonMscAccount();
    checkPartnerCargo();
}

/**
 * Check for partner cargo (non-MSC containers) and show ticker
 */
function checkPartnerCargo() {
    let hasPartnerCargo = false;

    // Check discharge containers
    for (const rec of Object.values(appState.discContainers)) {
        if (rec.operatorcode && rec.operatorcode !== 'MSC') {
            hasPartnerCargo = true;
            break;
        }
    }

    // Check load containers if not found
    if (!hasPartnerCargo) {
        for (const rec of Object.values(appState.loadContainers)) {
            if (rec.operatorcode && rec.operatorcode !== 'MSC') {
                hasPartnerCargo = true;
                break;
            }
        }
    }

    // Show/hide ticker
    const ticker = document.getElementById('partner-ticker');
    if (ticker) {
        ticker.style.display = hasPartnerCargo ? 'block' : 'none';
    }
}

/**
 * Check for non-MSC account containers and show warning
 */
function checkNonMscAccount() {
    let hasNonMsc = false;

    for (const rec of Object.values(appState.discContainers)) {
        if (rec.Account && rec.Account !== 'MSC') {
            hasNonMsc = true;
            break;
        }
    }

    if (!hasNonMsc) {
        for (const rec of Object.values(appState.loadContainers)) {
            if (rec.Account && rec.Account !== 'MSC') {
                hasNonMsc = true;
                break;
            }
        }
    }

    const marquee = document.getElementById('marquee-warning');
    if (marquee) {
        marquee.style.display = hasNonMsc ? 'block' : 'none';
    }
}

/**
 * Update type assignment counts
 */
function updateTypeAssignmentCounts() {
    ['LOD', 'DIS', 'TSL', 'TSD'].forEach(type => {
        updateTypeAssignmentCount(type);
    });
}

/**
 * Update single type assignment count
 */
function updateTypeAssignmentCount(type) {
    const textarea = document.getElementById(`${type.toLowerCase()}-textarea`);
    const countEl = document.getElementById(`${type.toLowerCase()}-count`);

    if (!textarea || !countEl) return;

    const containers = extractContainerNumbers(textarea.value);
    appState.typeAssignments[type] = containers;
    countEl.textContent = `Count: ${containers.length}`;
}

/**
 * Extract container numbers from text
 */
function extractContainerNumbers(text) {
    if (!text || !text.trim()) return [];

    const parts = text.split(/[\s,;\n]+/);
    const containers = [];

    for (const part of parts) {
        if (part && CONTAINER_RE.test(part)) {
            containers.push(part.trim().toUpperCase());
        }
    }

    return [...new Set(containers)]; // Remove duplicates
}

/**
 * Setup account, TPF, truck text areas
 */
function setupAccountTextAreas() {
    const areas = [
        { id: 'disc-account-text', type: 'disc', field: 'Account' },
        { id: 'load-account-text', type: 'load', field: 'Account' },
        { id: 'disc-tpf-text', type: 'disc', field: 'fromtotpf' },
        { id: 'load-tpf-text', type: 'load', field: 'fromtotpf' },
        { id: 'disc-truck-text', type: 'disc', field: 'fromtotruck' },
        { id: 'load-truck-text', type: 'load', field: 'fromtotruck' }
    ];

    areas.forEach(({ id }) => {
        const textarea = document.getElementById(id);
        if (textarea) {
            textarea.addEventListener('input', () => {
                const countEl = document.getElementById(`${id}-count`);
                if (countEl) {
                    const count = extractContainerNumbers(textarea.value).length;
                    countEl.textContent = `Count: ${count}`;
                }
            });
        }
    });
}

/**
 * Setup OOG and DG text areas
 */
function setupSpecialCargoTextAreas() {
    const fields = [
        { id: 'oog-dis-textarea', type: 'oog', origin: 'dis' },
        { id: 'oog-load-textarea', type: 'oog', origin: 'load' },
        { id: 'dg-dis-textarea', type: 'dg', origin: 'dis' },
        { id: 'dg-load-textarea', type: 'dg', origin: 'load' }
    ];

    fields.forEach(({ id, type, origin }) => {
        const textarea = document.getElementById(id);
        if (textarea) {
            textarea.addEventListener('input', () => {
                const containers = extractContainerNumbers(textarea.value);

                // Update state
                if (type === 'oog') {
                    appState.oogContainers[origin] = containers;
                } else {
                    appState.dgContainers[origin] = containers;
                }

                // Update count
                const countEl = document.getElementById(`${type}-${origin}-count`);
                if (countEl) {
                    countEl.textContent = `Count: ${containers.length}`;
                }
            });
        }
    });
}

/**
 * Show status message
 */
function showStatus(message) {
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'status-info';
    }
}

/**
 * Show error message
 */
function showError(message) {
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'status-error';
    }
    alert(message);
}

/**
 * Show success message
 */
function showSuccess(message) {
    const statusEl = document.getElementById('status-message');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = 'status-success';
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
