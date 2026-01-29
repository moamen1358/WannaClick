const toggleEl = document.getElementById('toggle');
const statusEl = document.getElementById('status');
const statusDot = document.getElementById('status-dot');
const statusCard = document.getElementById('status-card');
const badge = document.getElementById('badge');
const targetInput = document.getElementById('target-input');
const infoText = document.getElementById('info-text');

// Load saved state
chrome.storage.local.get(['enabled', 'targetText'], function (result) {
    // Default to enabled if not set
    const enabled = result.enabled !== false;
    const target = result.targetText || 'News';

    toggleEl.checked = enabled;
    targetInput.value = target;
    updateInfoText(target);
    updateStatus();
});

// Handle toggle change
toggleEl.addEventListener('change', function () {
    const enabled = toggleEl.checked;
    chrome.storage.local.set({ enabled: enabled }, function () {
        console.log('Extension enabled:', enabled);
        updateStatus();

        // Notify content script of the change
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('app.apollo.io')) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleChanged', enabled: enabled });
            }
        });
    });
});

// Handle target input change
targetInput.addEventListener('change', function () {
    const target = targetInput.value.trim() || 'News';
    targetInput.value = target; // Normalize empty to default
    chrome.storage.local.set({ targetText: target }, function () {
        console.log('Target text changed:', target);
        updateInfoText(target);

        // Notify content script of the change
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('app.apollo.io')) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'targetChanged', target: target });
            }
        });
    });
});

// Update info text with current target
function updateInfoText(target) {
    infoText.textContent = `Automatically clicks the "${target}" tab when you visit Apollo organization pages.`;
}

function updateStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const tab = tabs[0];
        const enabled = toggleEl.checked;

        // Update badge
        if (enabled) {
            badge.textContent = 'Active';
            badge.classList.remove('off');
        } else {
            badge.textContent = 'Off';
            badge.classList.add('off');
        }

        if (!enabled) {
            statusEl.textContent = 'Extension disabled';
            statusCard.className = 'card status-disabled';
            statusDot.className = 'status-indicator disabled';
            return;
        }

        if (tab.url && tab.url.includes('app.apollo.io')) {
            if (tab.url.includes('/organizations/')) {
                statusEl.textContent = 'Active on this page';
                statusCard.className = 'card status-active';
                statusDot.className = 'status-indicator active';
            } else {
                statusEl.textContent = 'Waiting for org page';
                statusCard.className = 'card status-inactive';
                statusDot.className = 'status-indicator waiting';
            }
        } else {
            statusEl.textContent = 'Not on Apollo';
            statusCard.className = 'card status-inactive';
            statusDot.className = 'status-indicator waiting';
        }
    });
}
