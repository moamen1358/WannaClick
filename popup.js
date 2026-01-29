const toggleEl = document.getElementById('toggle');
const statusEl = document.getElementById('status');

// Load saved state
chrome.storage.local.get(['enabled'], function (result) {
    // Default to enabled if not set
    const enabled = result.enabled !== false;
    toggleEl.checked = enabled;
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

function updateStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const tab = tabs[0];
        const enabled = toggleEl.checked;

        if (!enabled) {
            statusEl.textContent = '⏸ Disabled';
            statusEl.className = 'status-value status-disabled';
            return;
        }

        if (tab.url && tab.url.includes('app.apollo.io')) {
            if (tab.url.includes('/organizations/')) {
                statusEl.textContent = '✓ Active on this page';
                statusEl.className = 'status-value status-active';
            } else {
                statusEl.textContent = 'Waiting for org page';
                statusEl.className = 'status-value status-inactive';
            }
        } else {
            statusEl.textContent = 'Not on Apollo';
            statusEl.className = 'status-value status-inactive';
        }
    });
}
