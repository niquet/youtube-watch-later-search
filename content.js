// Global flag to prevent multiple executions
let isScriptRunning = false;
let elementsAdded = false;

// Debounce function to prevent rapid successive calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Wait for element with enhanced timeout handling
function waitForElement(selector, timeout = 7000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject('Timeout waiting for element'), timeout);

        // Check if element already exists
        const existingElement = document.querySelector(selector);
        if (existingElement) {
            clearTimeout(timer);
            resolve(existingElement);
            return;
        }

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearTimeout(timer);
                observer.disconnect();
                resolve(el);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

async function addSearchBar() {
    // Prevent multiple simultaneous executions
    if (isScriptRunning) {
        console.log('Script already running, skipping...');
        return;
    }

    isScriptRunning = true;

    try {
        // Only run on Watch Later playlist
        // if (!location.href.includes('list=WL')) {
        //     console.log('Not on Watch Later playlist, skipping...');
        //     return;
        // }

        // Enhanced duplicate detection - check for multiple possible selectors
        const existingInput = document.querySelector('#wl-search-input') ||
            document.querySelector('input[placeholder="Search Watch Later"]');
        const existingButton = document.querySelector('#wl-loadall-btn') ||
            document.querySelector('button[innerHTML*="Load all videos"]');

        if (existingInput || existingButton || elementsAdded) {
            console.log('Elements already exist, skipping...');
            return;
        }

        const sortContainer = await waitForElement('#filter-menu');
        if (!sortContainer) {
            console.log('Filter menu not found, skipping...');
            return;
        }

        // Create search input with unique identifier
        const searchInput = document.createElement('input');
        searchInput.id = 'wl-search-input';
        searchInput.type = 'search';
        searchInput.placeholder = 'Search Watch Later';
        searchInput.setAttribute('data-wl-element', 'true'); // Additional identifier
        searchInput.style.marginLeft = '2.2rem';
        searchInput.style.marginTop = '-0.25rem';
        searchInput.style.padding = '0.5rem 2rem';
        searchInput.style.fontSize = '1.4rem';
        searchInput.style.letterSpacing = '0.5px';
        searchInput.style.lineHeight = '2.2rem';
        searchInput.style.border = '1px solid #ccc';
        searchInput.style.borderRadius = '4em';
        searchInput.style.width = '467px';
        searchInput.autocomplete = 'off';

        // Search functionality
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const videoItems = document.querySelectorAll('ytd-playlist-video-renderer');

            videoItems.forEach(item => {
                const titleEl = item.querySelector('#video-title');
                if (!titleEl) return;

                const titleText = titleEl.textContent.toLowerCase();
                const videoId = titleEl.href?.split('v=')[1]?.split('&')[0] || '';

                if (titleText.includes(query) || videoId.includes(query)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });

        // Create Load All Videos button with unique identifier
        const loadAllButton = document.createElement('button');
        loadAllButton.id = 'wl-loadall-btn';
        loadAllButton.innerHTML = '⬇️ Render all before first search';
        loadAllButton.setAttribute('data-wl-element', 'true'); // Additional identifier
        loadAllButton.style.marginLeft = '1rem';
        loadAllButton.style.marginTop = '-0.25rem';
        loadAllButton.style.padding = '0.5rem 1.5rem';
        loadAllButton.style.fontSize = '1.4rem';
        loadAllButton.style.letterSpacing = '0.5px';
        loadAllButton.style.lineHeight = '2.2rem';
        loadAllButton.style.border = '1px solid #065fd4';
        loadAllButton.style.borderRadius = '4em';
        loadAllButton.style.backgroundColor = '#065fd4';
        loadAllButton.style.color = 'white';
        loadAllButton.style.cursor = 'pointer';
        loadAllButton.style.transition = 'all 0.3s ease';
        loadAllButton.style.fontWeight = '500';

        // Load all videos functionality (with named function to prevent duplicates)
        const loadAllVideos = async () => {
            let container = document.querySelector('ytd-playlist-video-list-renderer #contents');

            // Fallback selectors for Watch Later playlist
            if (!container) {
                container = document.querySelector('#contents.ytd-playlist-video-list-renderer');
            }
            if (!container) {
                container = document.querySelector('ytd-playlist-video-list-renderer div#contents');
            }
            if (!container) {
                container = document.querySelector('[role="main"] #contents');
            }

            if (!container) {
                console.error('Could not find playlist container! Available containers:',
                    document.querySelectorAll('[id*="contents"]'));
                return;
            }

            console.log('Found container:', container);

            // Update button state to show loading
            const originalText = loadAllButton.innerHTML;
            loadAllButton.innerHTML = '⏳ Loading...';
            loadAllButton.disabled = true;
            loadAllButton.style.cursor = 'not-allowed';
            loadAllButton.style.opacity = '0.7';

            console.log('Starting playlist scrolling with offsetHeight targeting...');

            let isScrolling = true;
            let noNewContentTimeout;
            const targetOffsetHeight = 129;

            // Set up MutationObserver to detect new children
            const observer = new MutationObserver((mutations) => {
                const hasNewChildren = mutations.some(mutation =>
                    mutation.type === 'childList' && mutation.addedNodes.length > 0
                );

                if (hasNewChildren && isScrolling) {
                    console.log('New children detected by MutationObserver');

                    // Reset the timeout
                    clearTimeout(noNewContentTimeout);

                    // Schedule next scroll
                    setTimeout(() => {
                        scrollToLastChild();
                    }, 1000);
                }
            });

            // Start observing
            observer.observe(container, {
                childList: true,
                subtree: false
            });

            function scrollToLastChild() {
                if (!isScrolling) return;

                const lastChild = container.lastElementChild;
                if (lastChild) {
                    lastChild.scrollIntoView({
                        behavior: 'smooth',
                        block: 'end'
                    });

                    console.log(`Scrolled to child ${container.children.length}`);

                    // Set timeout to stop scrolling if no new content appears
                    clearTimeout(noNewContentTimeout);
                    noNewContentTimeout = setTimeout(() => {
                        finishScrolling();
                    }, 5000); // Wait 5 seconds for new content
                }
            }

            function finishScrolling() {
                isScrolling = false;
                observer.disconnect();

                console.log('Finished loading all content. Starting precision scroll to offsetHeight target...');

                // Enhanced scrolling to achieve specific offsetHeight for first element
                scrollToTargetOffsetHeight();
            }

            function scrollToTargetOffsetHeight() {
                const firstChild = container.firstElementChild;
                if (!firstChild) {
                    console.error('No first child found');
                    // Reset button state
                    loadAllButton.innerHTML = originalText;
                    loadAllButton.disabled = false;
                    loadAllButton.style.cursor = 'pointer';
                    loadAllButton.style.opacity = '1';
                    return;
                }

                let adjustmentAttempts = 0;
                const maxAttempts = 50;
                const tolerance = 1;

                function precisionScroll() {
                    const currentHeight = firstChild.offsetHeight;
                    const heightDifference = Math.abs(currentHeight - targetOffsetHeight);

                    console.log(`Attempt ${adjustmentAttempts + 1}: offsetHeight = ${currentHeight}px (target: ${targetOffsetHeight}px)`);

                    if (heightDifference <= tolerance) {
                        console.log(`🎯 Perfect! First element offsetHeight is ${currentHeight}px`);
                        // Reset button state
                        loadAllButton.innerHTML = '✅ Complete!';
                        setTimeout(() => {
                            loadAllButton.innerHTML = originalText;
                            loadAllButton.disabled = false;
                            loadAllButton.style.cursor = 'pointer';
                            loadAllButton.style.opacity = '1';
                        }, 2000);
                        return;
                    }

                    if (adjustmentAttempts >= maxAttempts) {
                        console.log(`⚠️ Maximum attempts reached. Final offsetHeight: ${currentHeight}px`);
                        // Reset button state
                        loadAllButton.innerHTML = originalText;
                        loadAllButton.disabled = false;
                        loadAllButton.style.cursor = 'pointer';
                        loadAllButton.style.opacity = '1';
                        return;
                    }

                    // Calculate precise scroll adjustment
                    const scrollDirection = currentHeight > targetOffsetHeight ? 1 : -1;
                    const scrollAmount = Math.min(heightDifference / 3, 10);

                    window.scrollBy({
                        top: scrollDirection * scrollAmount,
                        behavior: 'smooth'
                    });

                    adjustmentAttempts++;

                    // Continue adjusting
                    setTimeout(precisionScroll, 300);
                }

                // Initial scroll to top, then start precision adjustment
                firstChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setTimeout(precisionScroll, 1000);
            }

            // Start the process
            scrollToLastChild();
        };

        loadAllButton.addEventListener('click', loadAllVideos);

        // Insert elements (proper order)
        sortContainer.parentNode.insertBefore(searchInput, sortContainer.nextSibling);
        sortContainer.parentNode.insertBefore(loadAllButton, searchInput.nextSibling);

        // Mark as added
        elementsAdded = true;
        console.log('Successfully added Watch Later tools');

    } catch (error) {
        console.error('Failed to add search bar:', error);
    } finally {
        isScriptRunning = false;
    }
}

// Debounced version to prevent rapid successive calls
const debouncedAddSearchBar = debounce(addSearchBar, 500);

// Enhanced cleanup function for page navigation
function cleanupElements() {
    const existingInput = document.querySelector('#wl-search-input');
    const existingButton = document.querySelector('#wl-loadall-btn');

    if (existingInput) existingInput.remove();
    if (existingButton) existingButton.remove();

    elementsAdded = false;
    console.log('Cleaned up existing elements');
}

// Page navigation handler
function handleNavigation() {
    console.log('Navigation detected, processing...');

    if (location.href.includes('list=WL')) {
        // On Watch Later page
        debouncedAddSearchBar();
    } else {
        // Not on Watch Later page, cleanup
        cleanupElements();
    }
}

// Initial load
handleNavigation();

// Listen for YouTube SPA navigation events
window.addEventListener('yt-navigate-finish', handleNavigation);

// Fallback listener (but don't use both simultaneously to prevent doubles)
// window.addEventListener('yt-page-data-updated', handleNavigation);

// Additional cleanup on page unload
window.addEventListener('beforeunload', cleanupElements);
