/**
 * WannaClick Pro - Chrome Extension
 * Universal auto-clicker that works on any website
 */

(function () {
    'use strict';

    console.log('[WannaClick Pro] ========================================');
    console.log('[WannaClick Pro] Extension loaded! URL:', window.location.href);
    console.log('[WannaClick Pro] ========================================');

    const MAX_WAIT_TIME = 20000;
    const CHECK_INTERVAL = 500;
    const WAIT_AFTER_CLICK = 2000;

    let intervalId = null;
    let checkCount = 0;
    let newsTabClicked = false;
    let lastProcessedUrl = '';
    let isEnabled = true;
    let targetText = 'News';
    let delayMin = 1; // seconds
    let delayMax = 3; // seconds

    /**
     * Load enabled state, target, and delay from storage
     */
    function loadSettings(callback) {
        chrome.storage.local.get(['enabled', 'targetText', 'delayMin', 'delayMax'], function (result) {
            isEnabled = result.enabled !== false; // Default to true
            targetText = result.targetText || 'News'; // Default to "News"
            delayMin = result.delayMin !== undefined ? result.delayMin : 1;
            delayMax = result.delayMax !== undefined ? result.delayMax : 3;
            console.log('[WannaClick Pro] Enabled state:', isEnabled);
            console.log('[WannaClick Pro] Target text:', targetText);
            console.log('[WannaClick Pro] Delay range:', delayMin, 'to', delayMax, 'seconds');
            if (callback) callback();
        });
    }

    /**
     * Helper function to apply the current enabled state to the UI
     */
    function applyEnabledState() {
        if (isEnabled) {
            // Reset and start fresh
            newsTabClicked = false;
            lastProcessedUrl = '';
            setTimeout(startAutoClick, 500);
        } else {
            // Stop any active polling
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        }
    }

    /**
     * Listen for storage changes - this is the PRIMARY way state is synced
     * Works across all tabs and contexts
     */
    chrome.storage.onChanged.addListener(function (changes, areaName) {
        if (areaName !== 'local') return;

        console.log('[WannaClick Pro] Storage changed:', changes);

        let needsStateUpdate = false;

        if (changes.enabled !== undefined) {
            const newEnabled = changes.enabled.newValue !== false;
            console.log('[WannaClick Pro] Enabled changed:', isEnabled, '->', newEnabled);
            isEnabled = newEnabled;
            needsStateUpdate = true;
        }

        if (changes.targetText !== undefined) {
            const newTarget = changes.targetText.newValue || 'News';
            console.log('[WannaClick Pro] Target changed:', targetText, '->', newTarget);
            targetText = newTarget;
            newsTabClicked = false;
            lastProcessedUrl = '';
            needsStateUpdate = true;
        }

        if (changes.delayMin !== undefined) {
            delayMin = changes.delayMin.newValue !== undefined ? changes.delayMin.newValue : 1;
            console.log('[WannaClick Pro] DelayMin synced:', delayMin);
        }

        if (changes.delayMax !== undefined) {
            delayMax = changes.delayMax.newValue !== undefined ? changes.delayMax.newValue : 3;
            console.log('[WannaClick Pro] DelayMax synced:', delayMax);
        }

        if (needsStateUpdate) {
            applyEnabledState();
        }
    });

    /**
     * Listen for direct messages from popup (backup for active tab)
     */
    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        console.log('[WannaClick Pro] Message received:', request.action);

        if (request.action === 'toggleChanged') {
            // Storage change listener will handle this, but update immediately for responsiveness
            isEnabled = request.enabled;
            applyEnabledState();
        } else if (request.action === 'targetChanged') {
            targetText = request.target;
            newsTabClicked = false;
            lastProcessedUrl = '';
            applyEnabledState();
        } else if (request.action === 'delayChanged') {
            delayMin = request.delayMin;
            delayMax = request.delayMax;
            console.log('[WannaClick Pro] Delay changed:', delayMin, 'to', delayMax, 'seconds');
        }
    });

    /**
     * Find the target tab element
     */
    function findTargetElement() {
        console.log('[WannaClick Pro] Searching for "' + targetText + '" element...');

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
                console.log('[WannaClick Pro] ✓ Found "' + targetText + '" in text element');
                const clickable = findClickableParent(el);
                return clickable || el;
            }
        }

        // Strategy 2: Look for elements with role="tab" or role="menuitem"
        const roleElements = document.querySelectorAll('[role="tab"], [role="menuitem"]');
        for (let el of roleElements) {
            if (hasExactText(el)) {
                console.log('[WannaClick Pro] ✓ Found "' + targetText + '" via role attribute');
                return el;
            }
        }

        // Strategy 3: Search clickable elements that contain target text
        const clickables = document.querySelectorAll('button, a, [role="button"], [role="menuitem"], li');
        for (let el of clickables) {
            if (hasExactText(el)) {
                console.log('[WannaClick Pro] ✓ Found "' + targetText + '" in clickable element');
                return el;
            }
        }

        // Strategy 4: Fallback - any role element containing text (loose match)
        for (let el of roleElements) {
            if (el.textContent.includes(targetText)) {
                console.log('[WannaClick Pro] ✓ Found "' + targetText + '" via role (includes)');
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
        console.log('[WannaClick Pro] Clicking element...');

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

        if (elapsed % 2000 === 0) {
            console.log('[WannaClick Pro] Still polling... (' + (elapsed / 1000) + 's)');
        }

        const targetElement = findTargetElement();

        if (targetElement) {
            console.log('[WannaClick Pro] ✓✓✓ "' + targetText + '" TAB FOUND after', (elapsed / 1000) + 's', '✓✓✓');

            if (intervalId) clearInterval(intervalId);
            intervalId = null;

            const randomDelay = getRandomDelay();
            console.log('[WannaClick Pro] Waiting', (randomDelay / 1000) + 's', 'before clicking...');

            setTimeout(() => {
                clickElement(targetElement);
                newsTabClicked = true;
                console.log('[WannaClick Pro] ✓ Click executed on "' + targetText + '" after', (randomDelay / 1000) + 's', 'delay!');
            }, randomDelay);

        } else if (elapsed >= MAX_WAIT_TIME) {
            console.warn('[WannaClick Pro] ✗ TIMEOUT searching for "' + targetText + '" after', (MAX_WAIT_TIME / 1000) + 's');
            if (intervalId) clearInterval(intervalId);
            intervalId = null;
        }
    }

    /**
     * Start the auto-click process
     */
    function startAutoClick() {
        if (!isEnabled) {
            console.log('[WannaClick Pro] Disabled, skipping');
            return;
        }

        const currentUrl = window.location.href;

        // Check if this page was already processed
        if (currentUrl === lastProcessedUrl && newsTabClicked) {
            console.log('[WannaClick Pro] Same page already processed, skipping');
            return;
        }

        console.log('[WannaClick Pro] ▶ Starting auto-click for:', currentUrl);

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
            console.log('[WannaClick Pro] URL changed:', lastCheckedUrl, '->', currentUrl);
            lastCheckedUrl = currentUrl;

            // Reset state for new page
            newsTabClicked = false;
            lastProcessedUrl = '';

            setTimeout(startAutoClick, 500);
        }
    }

    // ===== INITIALIZATION =====

    // Load initial settings and apply state
    loadSettings(function () {
        console.log('[WannaClick Pro] Initial settings loaded, applying state...');
        applyEnabledState();
    });

    // Listen for hash changes (SPA navigation)
    window.addEventListener('hashchange', function () {
        if (!isEnabled) return;
        console.log('[WannaClick Pro] Hash changed!');
        newsTabClicked = false;
        lastProcessedUrl = '';
        setTimeout(startAutoClick, 500);
    });

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', function () {
        if (!isEnabled) return;
        console.log('[WannaClick Pro] Popstate event!');
        newsTabClicked = false;
        lastProcessedUrl = '';
        setTimeout(startAutoClick, 500);
    });

    // Listen for visibility changes (when user switches tabs and comes back)
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible' && isEnabled) {
            console.log('[WannaClick Pro] Tab became visible!');
            // Reset and try again when tab becomes visible
            newsTabClicked = false;
            lastProcessedUrl = '';
            setTimeout(startAutoClick, 500);
        }
    });

    // Poll for URL changes (catches SPA navigation that doesn't trigger hashchange)
    setInterval(checkForUrlChange, 1000);

    console.log('[WannaClick Pro] ✓ Extension setup complete!');
})();
