import { StorageManager } from './storage.js';
import { UIManager } from './ui.js';
import { SummaryManager } from './summary.js';

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
}