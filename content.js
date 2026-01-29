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
    let targetText = 'News';
    let delayMin = 1; // seconds
    let delayMax = 3; // seconds

    /**
     * Visual status indicator states
     */
    const STATUS = {
        IDLE: { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', dot: 'rgba(255,255,255,0.8)', label: 'Ready' },
        SEARCHING: { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', dot: '#fff', label: 'Searching...' },
        CLICKED: { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', dot: '#fff', label: 'Done!' },
        TIMEOUT: { bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', dot: '#fff', label: 'Timeout' },
        DISABLED: { bg: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)', dot: 'rgba(255,255,255,0.5)', label: 'Disabled' }
    };

    /**
     * Load enabled state, target, and delay from storage
     */
    function loadSettings(callback) {
        chrome.storage.local.get(['enabled', 'targetText', 'delayMin', 'delayMax'], function (result) {
            isEnabled = result.enabled !== false; // Default to true
            targetText = result.targetText || 'News'; // Default to "News"
            delayMin = result.delayMin !== undefined ? result.delayMin : 1;
            delayMax = result.delayMax !== undefined ? result.delayMax : 3;
            console.log('[Apollo News Tab] Enabled state:', isEnabled);
            console.log('[Apollo News Tab] Target text:', targetText);
            console.log('[Apollo News Tab] Delay range:', delayMin, 'to', delayMax, 'seconds');
            if (callback) callback();
        });
    }

    /**
     * Listen for toggle and target changes from popup
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
        } else if (request.action === 'targetChanged') {
            targetText = request.target;
            console.log('[Apollo News Tab] Target changed:', targetText);

            // Reset state to allow clicking new target
            newsTabClicked = false;
            lastProcessedUrl = '';

            if (isEnabled) {
                updateStatusIndicator(STATUS.IDLE);
                setTimeout(startAutoClick, 500);
            }
        } else if (request.action === 'delayChanged') {
            delayMin = request.delayMin;
            delayMax = request.delayMax;
            console.log('[Apollo News Tab] Delay changed:', delayMin, 'to', delayMax, 'seconds');
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
            bottom: 20px;
            right: 20px;
            z-index: 999999;
            padding: 10px 16px;
            border-radius: 10px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            font-weight: 600;
            color: white;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4), 0 2px 6px rgba(0,0,0,0.2);
            cursor: default;
            user-select: none;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            gap: 8px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        `;
        statusIndicator.innerHTML = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,0.8);"></span> Ready';
        statusIndicator.title = 'WannaNews - Apollo News Tab Automation';
        document.body.appendChild(statusIndicator);
        console.log('[Apollo News Tab] Visual indicator created');
    }

    /**
     * Update the visual status indicator
     */
    function updateStatusIndicator(status) {
        if (!statusIndicator) return;
        statusIndicator.style.background = status.bg;
        statusIndicator.innerHTML = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${status.dot};${status === STATUS.SEARCHING ? 'animation:wnPulse 1s ease-in-out infinite;' : ''}"></span> ${status.label}`;

        // Inject animation keyframes if not already present
        if (!document.getElementById('wn-animations')) {
            const style = document.createElement('style');
            style.id = 'wn-animations';
            style.textContent = `
                @keyframes wnPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(0.8); }
                }
            `;
            document.head.appendChild(style);
        }
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
     * Find the target tab element
     */
    function findTargetElement() {
        console.log('[Apollo News Tab] Searching for "' + targetText + '" tab...');

        // Strategy 1: Find ALL spans and look for exact target text
        const allSpans = document.querySelectorAll('span');

        for (let span of allSpans) {
            const text = span.textContent.trim();

            if (text === targetText) {
                console.log('[Apollo News Tab] ✓ Found "' + targetText + '" span');

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
            if (tab.textContent.trim().includes(targetText)) {
                console.log('[Apollo News Tab] ✓ Found "' + targetText + '" via role="tab"');
                return tab;
            }
        }

        // Strategy 3: Deep search any clickable with target text
        const clickables = document.querySelectorAll('button, a, [role="button"], li, div[class*="tab"]');
        for (let el of clickables) {
            if (el.textContent.trim() === targetText) {
                console.log('[Apollo News Tab] ✓ Found "' + targetText + '" via deep search');
                return el;
            }
        }

        return null;
    }

    /**
     * Get a random delay in milliseconds between delayMin and delayMax
     */
    function getRandomDelay() {
        const min = delayMin * 1000; // convert to ms
        const max = delayMax * 1000;
        return Math.floor(Math.random() * (max - min + 1)) + min;
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

        const targetElement = findTargetElement();

        if (targetElement) {
            console.log('[Apollo News Tab] ✓✓✓ "' + targetText + '" TAB FOUND after', elapsed, 'ms ✓✓✓');

            if (intervalId) clearInterval(intervalId);
            intervalId = null;

            const randomDelay = getRandomDelay();
            console.log('[Apollo News Tab] Waiting', randomDelay, 'ms before clicking...');

            setTimeout(() => {
                clickElement(targetElement);
                newsTabClicked = true;
                updateStatusIndicator(STATUS.CLICKED);
                console.log('[Apollo News Tab] ✓ Click executed on "' + targetText + '" after', randomDelay, 'ms delay!');
            }, randomDelay);

        } else if (elapsed >= MAX_WAIT_TIME) {
            console.warn('[Apollo News Tab] ✗ TIMEOUT searching for "' + targetText + '" after', MAX_WAIT_TIME, 'ms');
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

    // Load initial settings
    loadSettings(function () {
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
