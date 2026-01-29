/**
 * Apollo News Tab Auto-Clicker - Chrome Extension
 * Automatically clicks the News tab on Apollo organization pages
 */

(function () {
    'use strict';

    console.log('[Apollo News Tab] ========================================');
    console.log('[Apollo News Tab] Extension loaded! URL:', window.location.href);
    console.log('[Apollo News Tab] ========================================');

    const MAX_WAIT_TIME = 20000;
    const CHECK_INTERVAL = 500;
    const WAIT_AFTER_CLICK = 2000;

    let intervalId = null;
    let checkCount = 0;
    let newsTabClicked = false;
    let lastProcessedUrl = '';
    let statusIndicator = null;
    let isEnabled = true;

    /**
     * Visual status indicator states
     */
    const STATUS = {
        IDLE: { color: '#888', label: 'Idle' },
        SEARCHING: { color: '#f0ad4e', label: 'Searching...' },
        CLICKED: { color: '#5cb85c', label: 'Done!' },
        TIMEOUT: { color: '#d9534f', label: 'Timeout' },
        DISABLED: { color: '#666', label: 'Disabled' }
    };

    /**
     * Load enabled state from storage
     */
    function loadEnabledState(callback) {
        chrome.storage.local.get(['enabled'], function (result) {
            isEnabled = result.enabled !== false; // Default to true
            console.log('[Apollo News Tab] Enabled state:', isEnabled);
            if (callback) callback();
        });
    }

    /**
     * Listen for toggle changes from popup
     */
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.action === 'toggleChanged') {
            isEnabled = request.enabled;
            console.log('[Apollo News Tab] Toggle changed:', isEnabled);

            if (isEnabled) {
                updateStatusIndicator(STATUS.IDLE);
                // Try to click if on organization page
                setTimeout(startAutoClick, 500);
            } else {
                updateStatusIndicator(STATUS.DISABLED);
                // Stop any active polling
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
            }
        }
    });

    /**
     * Create and inject a visual status indicator into the page
     */
    function createStatusIndicator() {
        if (statusIndicator) return;

        statusIndicator = document.createElement('div');
        statusIndicator.id = 'apollo-news-tab-indicator';
        statusIndicator.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 999999;
            padding: 6px 12px;
            border-radius: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 11px;
            font-weight: 600;
            color: white;
            background-color: ${STATUS.IDLE.color};
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: default;
            user-select: none;
            transition: background-color 0.3s ease;
        `;
        statusIndicator.textContent = '🔵 News Tab';
        statusIndicator.title = 'Apollo News Tab Auto-Clicker';
        document.body.appendChild(statusIndicator);
        console.log('[Apollo News Tab] Visual indicator created');
    }

    /**
     * Update the visual status indicator
     */
    function updateStatusIndicator(status) {
        if (!statusIndicator) return;
        statusIndicator.style.backgroundColor = status.color;
        statusIndicator.textContent = `📰 ${status.label}`;
    }

    /**
     * Check if current page is an organization page
     */
    function isOrganizationPage() {
        const url = window.location.href;
        const isOrg = url.includes('/organizations/');
        console.log('[Apollo News Tab] Checking if org page:', isOrg);
        return isOrg;
    }

    /**
     * Get a unique identifier for the current organization page
     */
    function getCurrentOrgId() {
        const url = window.location.href;
        const match = url.match(/\/organizations\/([^/?#]+)/);
        return match ? match[1] : null;
    }

    /**
     * Find the News tab element
     */
    function findNewsTab() {
        console.log('[Apollo News Tab] Searching for News tab...');

        // Strategy 1: Find ALL spans and look for exact "News" text
        const allSpans = document.querySelectorAll('span');

        for (let span of allSpans) {
            const text = span.textContent.trim();

            if (text === 'News') {
                console.log('[Apollo News Tab] ✓ Found "News" span');

                // Try to find clickable parent
                let parent = span.parentElement;
                for (let i = 0; i < 5 && parent; i++) {
                    if (parent.tagName === 'BUTTON' || parent.tagName === 'A' ||
                        parent.getAttribute('role') === 'tab' ||
                        parent.getAttribute('role') === 'button' ||
                        parent.tagName === 'LI' ||
                        parent.onclick || parent.hasAttribute('data-cy')) {
                        console.log('[Apollo News Tab] ✓ Found clickable parent');
                        return parent;
                    }
                    parent = parent.parentElement;
                }

                // No clickable parent found, return the span
                return span;
            }
        }

        // Strategy 2: Look for elements with role="tab"
        const tabs = document.querySelectorAll('[role="tab"]');
        for (let tab of tabs) {
            if (tab.textContent.trim().includes('News')) {
                console.log('[Apollo News Tab] ✓ Found News via role="tab"');
                return tab;
            }
        }

        // Strategy 3: Deep search any clickable with "News"
        const clickables = document.querySelectorAll('button, a, [role="button"], li, div[class*="tab"]');
        for (let el of clickables) {
            if (el.textContent.trim() === 'News') {
                console.log('[Apollo News Tab] ✓ Found News via deep search');
                return el;
            }
        }

        return null;
    }

    /**
     * Click the News tab
     */
    function clickElement(element) {
        console.log('[Apollo News Tab] Clicking element...');

        element.scrollIntoView({ behavior: 'instant', block: 'center' });

        // Method 1: Native click
        element.click();

        // Method 2: MouseEvent
        setTimeout(() => {
            const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window });
            const mouseUp = new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window });
            const click = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });

            element.dispatchEvent(mouseDown);
            element.dispatchEvent(mouseUp);
            element.dispatchEvent(click);
        }, 100);

        // Method 3: Focus and Enter key
        setTimeout(() => {
            element.focus();
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true });
            element.dispatchEvent(enterEvent);
        }, 200);
    }

    /**
     * Main polling function
     */
    function pollForNewsTab() {
        if (!isEnabled) {
            if (intervalId) clearInterval(intervalId);
            return;
        }

        if (newsTabClicked) {
            if (intervalId) clearInterval(intervalId);
            return;
        }

        checkCount++;
        const elapsed = checkCount * CHECK_INTERVAL;

        updateStatusIndicator(STATUS.SEARCHING);

        if (elapsed % 2000 === 0) {
            console.log('[Apollo News Tab] Still polling... (' + elapsed + 'ms)');
        }

        const newsTab = findNewsTab();

        if (newsTab) {
            console.log('[Apollo News Tab] ✓✓✓ NEWS TAB FOUND after', elapsed, 'ms ✓✓✓');

            if (intervalId) clearInterval(intervalId);
            intervalId = null;

            setTimeout(() => {
                clickElement(newsTab);
                newsTabClicked = true;
                updateStatusIndicator(STATUS.CLICKED);
                console.log('[Apollo News Tab] ✓ Click executed!');
            }, 500);

        } else if (elapsed >= MAX_WAIT_TIME) {
            console.warn('[Apollo News Tab] ✗ TIMEOUT after', MAX_WAIT_TIME, 'ms');
            updateStatusIndicator(STATUS.TIMEOUT);
            if (intervalId) clearInterval(intervalId);
            intervalId = null;
        }
    }

    /**
     * Start the auto-click process
     */
    function startAutoClick() {
        if (!isEnabled) {
            console.log('[Apollo News Tab] Disabled, skipping');
            return;
        }

        const currentUrl = window.location.href;
        const currentOrgId = getCurrentOrgId();

        // Check if this is a new organization page
        if (currentUrl === lastProcessedUrl && newsTabClicked) {
            console.log('[Apollo News Tab] Same page already processed, skipping');
            return;
        }

        if (!isOrganizationPage()) {
            console.log('[Apollo News Tab] Not an organization page, skipping');
            return;
        }

        console.log('[Apollo News Tab] ▶ Starting auto-click for:', currentUrl);

        createStatusIndicator();
        updateStatusIndicator(STATUS.SEARCHING);

        lastProcessedUrl = currentUrl;
        newsTabClicked = false;
        checkCount = 0;

        if (intervalId) {
            clearInterval(intervalId);
        }

        intervalId = setInterval(pollForNewsTab, CHECK_INTERVAL);
        setTimeout(pollForNewsTab, 100);
    }

    /**
     * Check for URL changes (for SPA navigation)
     */
    let lastCheckedUrl = window.location.href;

    function checkForUrlChange() {
        const currentUrl = window.location.href;
        if (currentUrl !== lastCheckedUrl) {
            console.log('[Apollo News Tab] URL changed:', lastCheckedUrl, '->', currentUrl);
            lastCheckedUrl = currentUrl;

            // Reset state for new page
            newsTabClicked = false;
            lastProcessedUrl = '';

            setTimeout(startAutoClick, 500);
        }
    }

    // ===== INITIALIZATION =====

    // Load initial state
    loadEnabledState(function () {
        // Create indicator early
        createStatusIndicator();

        if (!isEnabled) {
            updateStatusIndicator(STATUS.DISABLED);
        }
    });

    // Listen for hash changes (SPA navigation)
    window.addEventListener('hashchange', function () {
        console.log('[Apollo News Tab] Hash changed!');
        newsTabClicked = false;
        lastProcessedUrl = '';
        setTimeout(startAutoClick, 500);
    });

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', function () {
        console.log('[Apollo News Tab] Popstate event!');
        newsTabClicked = false;
        lastProcessedUrl = '';
        setTimeout(startAutoClick, 500);
    });

    // Listen for visibility changes (when user switches tabs and comes back)
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            console.log('[Apollo News Tab] Tab became visible!');
            // Reset and try again when tab becomes visible
            newsTabClicked = false;
            lastProcessedUrl = '';
            setTimeout(startAutoClick, 500);
        }
    });

    // Poll for URL changes (catches SPA navigation that doesn't trigger hashchange)
    setInterval(checkForUrlChange, 1000);

    // Initial run
    setTimeout(startAutoClick, 1000);

    console.log('[Apollo News Tab] ✓ Extension setup complete!');
})();
