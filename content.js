/**
 * WannaNews Auto-Clicker - Chrome Extension
 * Universal auto-clicker that works on any website
 */

(function () {
    'use strict';

    console.log('[WannaNews] ========================================');
    console.log('[WannaNews] Extension loaded! URL:', window.location.href);
    console.log('[WannaNews] ========================================');

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
            console.log('[WannaNews] Enabled state:', isEnabled);
            console.log('[WannaNews] Target text:', targetText);
            console.log('[WannaNews] Delay range:', delayMin, 'to', delayMax, 'seconds');
            if (callback) callback();
        });
    }

    /**
     * Listen for toggle and target changes from popup
     */
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.action === 'toggleChanged') {
            isEnabled = request.enabled;
            console.log('[WannaNews] Toggle changed:', isEnabled);

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
            console.log('[WannaNews] Target changed:', targetText);

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
            console.log('[WannaNews] Delay changed:', delayMin, 'to', delayMax, 'seconds');
        }
    });

    /**
     * Create and inject a visual status indicator into the page
     */
    function createStatusIndicator() {
        if (statusIndicator) return;

        statusIndicator = document.createElement('div');
        statusIndicator.id = 'wannanews-indicator';
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
        statusIndicator.title = 'WannaNews Auto-Clicker';
        document.body.appendChild(statusIndicator);
        console.log('[WannaNews] Visual indicator created');
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
     * Find the target tab element
     */
    function findTargetElement() {
        console.log('[WannaNews] Searching for "' + targetText + '" element...');

        // Helper: Check if element or its children contain exact text
        function hasExactText(el) {
            // Check direct text nodes
            for (let node of el.childNodes) {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === targetText) {
                    return true;
                }
            }
            // Check child elements
            for (let child of el.children) {
                if (child.textContent.trim() === targetText) {
                    return true;
                }
            }
            return false;
        }

        // Helper: Find clickable parent
        function findClickableParent(el) {
            let parent = el.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
                if (parent.tagName === 'BUTTON' || parent.tagName === 'A' ||
                    parent.getAttribute('role') === 'tab' ||
                    parent.getAttribute('role') === 'button' ||
                    parent.getAttribute('role') === 'menuitem' ||
                    parent.tagName === 'LI' ||
                    parent.onclick || parent.hasAttribute('data-test')) {
                    return parent;
                }
                parent = parent.parentElement;
            }
            return null;
        }

        // Strategy 1: Find text elements (span, div, p, label) with exact match
        const textElements = document.querySelectorAll('span, div, p, label');
        for (let el of textElements) {
            if (el.textContent.trim() === targetText && el.children.length === 0) {
                console.log('[WannaNews] ✓ Found "' + targetText + '" in text element');
                const clickable = findClickableParent(el);
                return clickable || el;
            }
        }

        // Strategy 2: Look for elements with role="tab" or role="menuitem"
        const roleElements = document.querySelectorAll('[role="tab"], [role="menuitem"]');
        for (let el of roleElements) {
            if (hasExactText(el)) {
                console.log('[WannaNews] ✓ Found "' + targetText + '" via role attribute');
                return el;
            }
        }

        // Strategy 3: Search clickable elements that contain target text
        const clickables = document.querySelectorAll('button, a, [role="button"], [role="menuitem"], li');
        for (let el of clickables) {
            if (hasExactText(el)) {
                console.log('[WannaNews] ✓ Found "' + targetText + '" in clickable element');
                return el;
            }
        }

        // Strategy 4: Fallback - any role element containing text (loose match)
        for (let el of roleElements) {
            if (el.textContent.includes(targetText)) {
                console.log('[WannaNews] ✓ Found "' + targetText + '" via role (includes)');
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
        console.log('[WannaNews] Clicking element...');

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
            console.log('[WannaNews] Still polling... (' + (elapsed / 1000) + 's)');
        }

        const targetElement = findTargetElement();

        if (targetElement) {
            console.log('[WannaNews] ✓✓✓ "' + targetText + '" TAB FOUND after', (elapsed / 1000) + 's', '✓✓✓');

            if (intervalId) clearInterval(intervalId);
            intervalId = null;

            const randomDelay = getRandomDelay();
            console.log('[WannaNews] Waiting', (randomDelay / 1000) + 's', 'before clicking...');

            setTimeout(() => {
                clickElement(targetElement);
                newsTabClicked = true;
                updateStatusIndicator(STATUS.CLICKED);
                console.log('[WannaNews] ✓ Click executed on "' + targetText + '" after', (randomDelay / 1000) + 's', 'delay!');
            }, randomDelay);

        } else if (elapsed >= MAX_WAIT_TIME) {
            console.warn('[WannaNews] ✗ TIMEOUT searching for "' + targetText + '" after', (MAX_WAIT_TIME / 1000) + 's');
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
            console.log('[WannaNews] Disabled, skipping');
            return;
        }

        const currentUrl = window.location.href;

        // Check if this page was already processed
        if (currentUrl === lastProcessedUrl && newsTabClicked) {
            console.log('[WannaNews] Same page already processed, skipping');
            return;
        }

        console.log('[WannaNews] ▶ Starting auto-click for:', currentUrl);

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
            console.log('[WannaNews] URL changed:', lastCheckedUrl, '->', currentUrl);
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
        console.log('[WannaNews] Hash changed!');
        newsTabClicked = false;
        lastProcessedUrl = '';
        setTimeout(startAutoClick, 500);
    });

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', function () {
        console.log('[WannaNews] Popstate event!');
        newsTabClicked = false;
        lastProcessedUrl = '';
        setTimeout(startAutoClick, 500);
    });

    // Listen for visibility changes (when user switches tabs and comes back)
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            console.log('[WannaNews] Tab became visible!');
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

    console.log('[WannaNews] ✓ Extension setup complete!');
})();
