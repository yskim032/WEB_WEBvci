/**
 * Lashing Details UI - New Separate Button Design
 * Handles Lashing Required and Non-Lashing containers separately
 */

const lashingData = {
    lashing: [],
    nonLashing: [],
    lashingPage: 1,
    nonLashingPage: 1,
    itemsPerPage: 100,
    filterList: null // Set of container numbers or null if no filter
};

function setupLashingUI() {
    // View toggle buttons
    const btnShowLashing = document.getElementById('btn-show-lashing');
    const btnShowNonLashing = document.getElementById('btn-show-non-lashing');

    // Filter buttons
    const btnApplyFilter = document.getElementById('btn-apply-lashing-filter');
    const btnClearFilter = document.getElementById('btn-clear-lashing-filter');

    // Copy/Export buttons for Lashing
    const btnLashingCopy = document.getElementById('btn-lashing-copy');
    const btnLashingExport = document.getElementById('btn-lashing-export');

    // Copy/Export buttons for Non-Lashing
    const btnNonLashingCopy = document.getElementById('btn-non-lashing-copy');
    const btnNonLashingExport = document.getElementById('btn-non-lashing-export');

    if (btnShowLashing) {
        btnShowLashing.addEventListener('click', () => showLashingSection('lashing'));
    }

    if (btnShowNonLashing) {
        btnShowNonLashing.addEventListener('click', () => showLashingSection('non-lashing'));
    }

    if (btnApplyFilter) btnApplyFilter.addEventListener('click', applyLashingFilter);
    if (btnClearFilter) btnClearFilter.addEventListener('click', clearLashingFilter);

    if (btnLashingCopy) btnLashingCopy.addEventListener('click', () => copyLashingData('lashing'));
    if (btnLashingExport) btnLashingExport.addEventListener('click', () => exportLashingData('lashing'));
    if (btnNonLashingCopy) btnNonLashingCopy.addEventListener('click', () => copyLashingData('non-lashing'));
    if (btnNonLashingExport) btnNonLashingExport.addEventListener('click', () => exportLashingData('non-lashing'));

    // Load initial data if files are already loaded
    if (Object.keys(appState.discContainers).length > 0 || Object.keys(appState.loadContainers).length > 0) {
        refreshLashingData();
    }
}

function showLashingSection(section) {
    const lashingSection = document.getElementById('lashing-section');
    const nonLashingSection = document.getElementById('non-lashing-section');
    const btnLashing = document.getElementById('btn-show-lashing');
    const btnNonLashing = document.getElementById('btn-show-non-lashing');

    if (section === 'lashing') {
        lashingSection.classList.add('active');
        nonLashingSection.classList.remove('active');
        btnLashing.classList.add('active');
        btnNonLashing.classList.remove('active');
    } else {
        lashingSection.classList.remove('active');
        nonLashingSection.classList.add('active');
        btnLashing.classList.remove('active');
        btnNonLashing.classList.add('active');
    }
}

function applyLashingFilter() {
    const input = document.getElementById('lashing-filter-input');
    const msg = document.getElementById('filter-status-msg');

    if (!input) return;

    const text = input.value.trim();
    if (!text) {
        clearLashingFilter();
        return;
    }

    // Split by comma, space, newline
    const containers = text.split(/[\s,]+/).filter(c => c.length > 0).map(c => c.toUpperCase());

    if (containers.length === 0) {
        clearLashingFilter();
        return;
    }

    lashingData.filterList = new Set(containers);

    if (msg) msg.textContent = `Filtered by ${containers.length} containers`;

    refreshLashingData();
}

function clearLashingFilter() {
    const input = document.getElementById('lashing-filter-input');
    const msg = document.getElementById('filter-status-msg');

    lashingData.filterList = null;
    if (input) input.value = '';
    if (msg) msg.textContent = '';

    refreshLashingData();
}

/**
 * Update Summary Stats (DIS, LOD, Total) in the Port Section
 */
function updateLashingSummaryStats() {
    const discContainers = Object.values(appState.discContainers || {});
    const loadContainers = Object.values(appState.loadContainers || {});

    let discCount = 0;
    let loadCount = 0;

    discContainers.forEach(rec => {
        if (rec._line && isLashingContainer(rec._line)) discCount++;
    });

    loadContainers.forEach(rec => {
        if (rec._line && isLashingContainer(rec._line)) loadCount++;
    });

    const total = discCount + loadCount;

    const elDisc = document.getElementById('lashing-disc');
    const elLoad = document.getElementById('lashing-load');
    const elTotal = document.getElementById('lashing-total');

    if (elDisc) elDisc.textContent = `DIS: ${discCount}`;
    if (elLoad) elLoad.textContent = `LOD: ${loadCount}`;
    if (elTotal) elTotal.textContent = `Total: ${total}`;
}

function refreshLashingData() {
    // Update summary stats regardless of filter
    updateLashingSummaryStats();

    let allContainers = [
        ...Object.values(appState.discContainers),
        ...Object.values(appState.loadContainers)
    ];

    // Apply Filter if exists
    if (lashingData.filterList) {
        allContainers = allContainers.filter(rec => {
            const containerNo = extractContainerNumber(rec._line || '') || rec.container || '';
            // Check exact match
            return lashingData.filterList.has(containerNo);
        });
    }

    // Separate into lashing and non-lashing
    lashingData.lashing = allContainers.filter(rec => {
        return rec._line && isLashingContainer(rec._line);
    });

    lashingData.nonLashing = allContainers.filter(rec => {
        return rec._line && !isLashingContainer(rec._line);
    });

    // Sort both by stowage
    const sortByStowage = (a, b) => {
        const stowA = extractStowposition(a._line || '') || '';
        const stowB = extractStowposition(b._line || '') || '';
        return stowA.localeCompare(stowB);
    };

    lashingData.lashing.sort(sortByStowage);
    lashingData.nonLashing.sort(sortByStowage);

    // Update counts
    updateLashingBadgeCounts();

    // Render both tables
    renderLashingTable('lashing');
    renderLashingTable('non-lashing');
}

// Expose to window for access from other modules
window.refreshLashingData = refreshLashingData;
window.setupLashingUI = setupLashingUI;

function updateLashingBadgeCounts() {
    const lashingCount = document.getElementById('lashing-count');
    const nonLashingCount = document.getElementById('non-lashing-count');

    if (lashingCount) lashingCount.textContent = lashingData.lashing.length;
    if (nonLashingCount) nonLashingCount.textContent = lashingData.nonLashing.length;
}

function renderLashingTable(type) {
    const tableId = type === 'lashing' ? 'lashing-table' : 'non-lashing-table';
    const paginationId = type === 'lashing' ? 'lashing-pagination' : 'non-lashing-pagination';
    const data = type === 'lashing' ? lashingData.lashing : lashingData.nonLashing;
    const currentPage = type === 'lashing' ? lashingData.lashingPage : lashingData.nonLashingPage;

    const tbody = document.querySelector(`#${tableId} tbody`);
    const pagination = document.getElementById(paginationId);

    if (!tbody) return;

    tbody.innerHTML = '';
    if (pagination) pagination.innerHTML = '';

    const start = (currentPage - 1) * lashingData.itemsPerPage;
    const end = start + lashingData.itemsPerPage;
    const pageItems = data.slice(start, end);

    let seq = start + 1;
    pageItems.forEach(rec => {
        const line = rec._line || '';
        const tr = document.createElement('tr');

        // Extract Details
        const container = extractContainerNumber(line) || rec.container || '';
        const stow = extractStowposition(line) || '';
        const mid = extractMiddleFields(line) || {};
        const polPod = extractLastPolPod(line) || {};

        // Status indicator
        const isLashing = type === 'lashing';
        const statusHtml = isLashing
            ? '<span class="lashing-indicator yes">O</span>'
            : '<span class="lashing-indicator no">X</span>';

        tr.innerHTML = `
            <td>${seq++}</td>
            <td>${container}</td>
            <td>${mid.typeabrev || ''}</td>
            <td>${polPod.pol || ''}</td>
            <td>${polPod.pod || ''}</td>
            <td>${stow}</td>
            <td>${mid.gross || ''}</td>
            <td style="text-align: center;">${statusHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    renderPagination(type, pagination, data.length);
}

function renderPagination(type, container, totalItems) {
    const totalPages = Math.ceil(totalItems / lashingData.itemsPerPage);
    if (totalPages <= 1) return;

    const currentPage = type === 'lashing' ? lashingData.lashingPage : lashingData.nonLashingPage;

    const createBtn = (pageNum) => {
        const btn = document.createElement('button');
        btn.className = `page-btn ${pageNum === currentPage ? 'active' : ''}`;
        btn.textContent = pageNum;
        btn.addEventListener('click', () => {
            if (type === 'lashing') {
                lashingData.lashingPage = pageNum;
            } else {
                lashingData.nonLashingPage = pageNum;
            }
            renderLashingTable(type);
        });
        container.appendChild(btn);
    };

    // Range logic
    const range = 3;
    createBtn(1);

    let startRange = Math.max(2, currentPage - range);
    let endRange = Math.min(totalPages - 1, currentPage + range);

    if (startRange > 2) {
        const span = document.createElement('span');
        span.textContent = '...';
        container.appendChild(span);
    }

    for (let i = startRange; i <= endRange; i++) {
        createBtn(i);
    }

    if (endRange < totalPages - 1) {
        const span = document.createElement('span');
        span.textContent = '...';
        container.appendChild(span);
    }

    if (totalPages > 1) createBtn(totalPages);
}

async function copyLashingData(type) {
    const data = type === 'lashing' ? lashingData.lashing : lashingData.nonLashing;

    if (data.length === 0) {
        showError('No data to copy');
        return;
    }

    let text = "Seq\tContainer No\tType\tPOL\tPOD\tStowage\tWeight\n";
    let seq = 1;

    text += data.map(rec => {
        const line = rec._line || '';
        const container = extractContainerNumber(line) || rec.container || '';
        const stow = extractStowposition(line) || '';
        const mid = extractMiddleFields(line) || {};
        const polPod = extractLastPolPod(line) || {};

        return `${seq++}\t${container}\t${mid.typeabrev || ''}\t${polPod.pol || ''}\t${polPod.pod || ''}\t${stow}\t${mid.gross || ''}`;
    }).join('\n');

    try {
        await navigator.clipboard.writeText(text);
        showStatus(`Copied ${data.length} containers to clipboard`);
    } catch (err) {
        showError('Failed to copy to clipboard');
    }
}

function exportLashingData(type) {
    const data = type === 'lashing' ? lashingData.lashing : lashingData.nonLashing;

    if (data.length === 0) {
        showError('No data to export');
        return;
    }

    let csv = "Seq,Container No,Type,POL,POD,Stowage,Weight\n";
    let seq = 1;

    csv += data.map(rec => {
        const line = rec._line || '';
        const container = extractContainerNumber(line) || rec.container || '';
        const stow = extractStowposition(line) || '';
        const mid = extractMiddleFields(line) || {};
        const polPod = extractLastPolPod(line) || {};

        return `${seq++},${container},${mid.typeabrev || ''},${polPod.pol || ''},${polPod.pod || ''},${stow},${mid.gross || ''}`;
    }).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}_containers.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showStatus(`Exported ${data.length} containers to CSV`);
}
