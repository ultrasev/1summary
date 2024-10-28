import { StorageManager } from './storage.js';
import { UIManager } from './ui.js';
import { SummaryManager } from './summary.js';
import { testLLMConnection } from '../utils/models.js';
import { generateHash } from '../utils/hash.js';

export class PopupManager {
    constructor() {
        this.storageManager = new StorageManager();
        this.uiManager = new UIManager();
        this.summaryManager = new SummaryManager(this.storageManager, this.uiManager);
    }

    async init() {
        await this.loadSettings();
        this.attachEventListeners();
        this.checkSettingsAndGenerateSummary();
    }

    async loadSettings() {
        const settings = await this.storageManager.loadSettings();
        this.uiManager.populateSettingsForm(settings);
        return settings;
    }

    attachEventListeners() {
        const settingsButton = document.getElementById('settingsButton');
        const regenerateButton = document.getElementById('regenerateButton');
        const testConnectionButton = document.getElementById('testConnection');
        const promptTextarea = document.getElementById('prompt');
        const copyButton = document.getElementById('copyButton');
        const downloadButton = document.getElementById('downloadButton');

        if (settingsButton) {
            settingsButton.addEventListener('click', () => this.uiManager.toggleSettings());
        }
        if (regenerateButton) {
            regenerateButton.addEventListener('click', () => this.regenerateSummary());
        }
        if (testConnectionButton) {
            testConnectionButton.addEventListener('click', () => this.testConnection());
        }
        if (promptTextarea) {
            promptTextarea.addEventListener('input', () => this.uiManager.autoResizeTextarea());
        }
        if (copyButton) {
            copyButton.addEventListener('click', () => this.copySummary());
        }
        if (downloadButton) {
            downloadButton.addEventListener('click', () => this.downloadSummary());
        }

        this.uiManager.setupPasswordToggle();
    }

    async saveSettings() {
        const settings = this.uiManager.getSettingsFromForm();
        await this.storageManager.saveSettings(settings);

        // 重新加载设置以确保更新
        await this.loadSettings();
    }

    async checkSettingsAndGenerateSummary(forceRegenerate = false) {
        const settings = await this.loadSettings();
        if (!settings.appKey || !settings.apiUrl) {
            this.uiManager.showMessage("Please set your APP KEY and API URL in the settings.");
            return;
        }
        await this.summaryManager.generateSummary(forceRegenerate);
        this.uiManager.copyButton.style.display = 'block';
    }

    regenerateSummary() {
        this.uiManager.showMessage("Regenerating summary...");
        this.checkSettingsAndGenerateSummary(true);
    }

    async testConnection() {
        const settings = this.uiManager.getSettingsFromForm();
        await this.storageManager.saveSettings(settings);
        try {
            const result = await testLLMConnection();
            this.uiManager.updateConnectionStatus(result);
        } catch (error) {
            this.uiManager.updateConnectionStatus({
                error: error.message,
                details: error.details
            });
        }
    }

    async copySummary() {
        const summaryText = this.uiManager.summaryElement.innerText;
        try {
            await navigator.clipboard.writeText(summaryText);
            const copyButton = document.getElementById('copyButtonTitle');
            copyButton.textContent = 'Copied!';
            // const originalTitle = copyButton.getAttribute('title');
            // copyButton.setAttribute('title', 'Copied!');
            setTimeout(() => {
                copyButton.textContent = 'Copy';
            }, 2000);
        } catch (err) {
            this.uiManager.showMessage('Copy failed, please copy manually.');
        }
    }

    async downloadSummary() {
        try {
            // Get current active tab information
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const summaryText = this.uiManager.summaryElement.innerText;
            const pageContent = await this.summaryManager.getPageContent(tab.id);

            // Generate hash from URL for unique file identification
            const urlHash = await generateHash(tab.url);

            // Create and download summary file
            const summaryBlob = new Blob([summaryText], { type: 'text/plain' });
            const summaryUrl = URL.createObjectURL(summaryBlob);
            const summaryLink = document.createElement('a');
            summaryLink.href = summaryUrl;
            summaryLink.download = `${urlHash}-summary.txt`;
            document.body.appendChild(summaryLink);
            summaryLink.click();
            URL.revokeObjectURL(summaryUrl);
            document.body.removeChild(summaryLink);

            // Create and download original content file
            const contentBlob = new Blob([pageContent], { type: 'text/plain' });
            const contentUrl = URL.createObjectURL(contentBlob);
            const contentLink = document.createElement('a');
            contentLink.href = contentUrl;
            contentLink.download = `${urlHash}-content.txt`;
            document.body.appendChild(contentLink);
            contentLink.click();
            URL.revokeObjectURL(contentUrl);
            document.body.removeChild(contentLink);
        } catch (err) {
            // Handle download errors
            this.uiManager.showMessage('Download failed, please try again.');
            console.error('Download error:', err);
        }
    }


}
