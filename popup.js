const toggleEl = document.getElementById('toggle');
const statusEl = document.getElementById('status');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const targetInput = document.getElementById('target-input');
const delayMinInput = document.getElementById('delay-min');
const delayMaxInput = document.getElementById('delay-max');

// Load saved state
chrome.storage.local.get(['enabled', 'targetText', 'delayMin', 'delayMax'], function (result) {
    const enabled = result.enabled !== false;
    const target = result.targetText || 'News';
    const delayMin = result.delayMin !== undefined ? result.delayMin : 0;
    const delayMax = result.delayMax !== undefined ? result.delayMax : 3;

    toggleEl.checked = enabled;
    targetInput.value = target;
    delayMinInput.value = delayMin;
    delayMaxInput.value = delayMax;
    updateStatus(enabled);
});

// Handle toggle change
toggleEl.addEventListener('change', function () {
    const enabled = toggleEl.checked;
    chrome.storage.local.set({ enabled: enabled }, function () {
        updateStatus(enabled);
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleChanged', enabled: enabled }).catch(() => {});
            }
        });
    });
});

// Handle target input change
targetInput.addEventListener('change', function () {
    const target = targetInput.value.trim() || 'News';
    targetInput.value = target;
    chrome.storage.local.set({ targetText: target }, function () {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'targetChanged', target: target }).catch(() => {});
            }
        });
    });
});

// Handle delay input changes
function handleDelayChange() {
    let delayMin = parseFloat(delayMinInput.value);
    let delayMax = parseFloat(delayMaxInput.value);

    if (isNaN(delayMin) || delayMin < 0) delayMin = 0;
    if (isNaN(delayMax) || delayMax < 0) delayMax = 3;
    if (delayMax < delayMin) {
        delayMax = delayMin;
        delayMaxInput.value = delayMax;
    }

    chrome.storage.local.set({ delayMin: delayMin, delayMax: delayMax }, function () {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'delayChanged', delayMin: delayMin, delayMax: delayMax }).catch(() => {});
            }
        });
    });
}

delayMinInput.addEventListener('change', handleDelayChange);
delayMaxInput.addEventListener('change', handleDelayChange);

function updateStatus(enabled) {
    if (enabled) {
        statusEl.textContent = 'Ready';
        statusDot.classList.remove('off');
        statusText.classList.remove('off');
    } else {
        statusEl.textContent = 'Disabled';
        statusDot.classList.add('off');
        statusText.classList.add('off');
    }
}
