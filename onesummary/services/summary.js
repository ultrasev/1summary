import { llm } from '../utils/models.js';

export class SummaryManager {
    constructor(storageManager, uiManager) {
        this.storageManager = storageManager;
        this.uiManager = uiManager;
        this.regenerateButton = document.getElementById('regenerateButton');
    }

    async generateSummary(forceRegenerate = false) {
        this.uiManager.showMessage("Generating summary...");
        this.disableRegenerateButton();
        this.toggleButtonsVisibility(false);

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const tabId = tab.id;
            const url = tab.url;

            const cachedSummary = forceRegenerate ? null : await this.storageManager.getCachedSummary(tabId, url);

            if (cachedSummary) {
                this.uiManager.displaySummary(cachedSummary);
            } else {
                const content = await this.getPageContent(tabId);
                const summary = await this.getSummary(content);
                this.uiManager.displaySummary(summary);
                await this.storageManager.cacheSummary(tabId, url, summary);
            }
            this.enableRegenerateButton();
            this.toggleButtonsVisibility(true);
        } catch (error) {
            this.handleError(error);
        } finally {
            this.enableRegenerateButton();
            this.toggleButtonsVisibility(true);
        }
    }

    toggleButtonsVisibility(isVisible) {
        const buttons = document.querySelectorAll('#regenerateButton, #copyButton, .button-title');
        buttons.forEach(button => {
            if (isVisible) {
                button.classList.remove('hidden');
            } else {
                button.classList.add('hidden');
            }
        });
    }

    disableRegenerateButton() {
        this.regenerateButton.disabled = true;
        this.regenerateButton.style.opacity = '0.5';
        this.regenerateButton.style.cursor = 'not-allowed';
    }

    enableRegenerateButton() {
        this.regenerateButton.disabled = false;
        this.regenerateButton.style.opacity = '1';
        this.regenerateButton.style.cursor = 'pointer';
        this.regenerateButton.style.display = 'block';
    }

    async getPageContent(tabId) {
        if (!chrome.scripting) {
            throw new Error('chrome.scripting is not available');
        }
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                func: () => {

                    const clone = document.cloneNode(true);
                    const cloneBody = clone.body;

                    const elementsToRemove = cloneBody.querySelectorAll('script, style, nav, footer, .js-consent-banner');
                    elementsToRemove.forEach(el => el.remove());

                    const textNodes = [];
                    const walk = document.createTreeWalker(cloneBody, NodeFilter.SHOW_TEXT, null, false);
                    let node;
                    while (node = walk.nextNode()) {
                        const computedStyle = window.getComputedStyle(node.parentElement);
                        if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
                            textNodes.push(node.textContent.trim());
                        }
                    }

                    let text = textNodes.join(' ');
                    text = text.replace(/\s+/g, ' ').trim();
                    return text.slice(0, 8192); // keep the text length within 8192 characters
                },
            });
            if (results && results[0] && results[0].result) {
                return results[0].result;
            }
            throw new Error('Failed to get page content: No result returned');
        } catch (error) {
            throw new Error(`Failed to get page content: ${error.message}`);
        }
    }

    async getSummary(content) {
        let summary = '';
        await llm(content, (chunk) => {
            summary += chunk;
            this.uiManager.displaySummary(summary);
        });
        return summary;
    }

    handleError(error) {
        let errorMessage = "An unexpected error occurred.";
        if (error.message.includes("Cannot access a chrome:// URL")) {
            errorMessage = "This extension cannot summarize Chrome internal pages. Please try on a regular webpage.";
        } else if (error.message.includes("Failed to get page content")) {
            errorMessage = "Unable to read the page content. This may be due to page restrictions or a connection issue.";
        } else if (error.message.includes("chrome.scripting is not available")) {
            errorMessage = "The extension doesn't have the necessary permissions. Please check the extension settings.";
        } else {
            errorMessage = error;;
        }
        this.uiManager.showMessage(`Error: ${errorMessage}\n\nIf the problem persists, please check your internet connection and extension permissions.`);
        this.uiManager.buttonContainer.style.display = 'flex';
    }
}
