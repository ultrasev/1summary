import { PROMPT } from '../config.js';

export class UIManager {
    constructor() {
        this.summaryElement = document.getElementById('summary');
        this.regenerateButton = document.getElementById('regenerateButton');
        this.settingsDiv = document.getElementById('settings');
        this.settingsDiv.style.display = 'none';
        this.copyButton = document.getElementById('copyButton');
        this.buttonContainer = document.querySelector('.button-container');
        this.setupApiCandidates();
    }

    populateSettingsForm(settings) {
        // 设置表单
        document.getElementById('appKey').value = settings.appKey || '';
        document.getElementById('apiUrl').value = settings.apiUrl || '';
        document.getElementById('model').value = settings.model || '';
        document.getElementById('prompt').value = settings.prompt || PROMPT;
        document.getElementById('temperature').value = settings.temperature || '0.7';

        const apiCandidates = document.getElementById('apiCandidates');
        const matchingOption = Array.from(apiCandidates.options).find(option => option.value === settings.apiUrl);
        if (matchingOption) {
            apiCandidates.value = settings.apiUrl;
        } else {
            apiCandidates.value = "";
        }
    }

    getSettingsFromForm() {
        return {
            appKey: document.getElementById('appKey').value,
            apiUrl: document.getElementById('apiUrl').value,
            model: document.getElementById('model').value,
            prompt: document.getElementById('prompt').value,
            temperature: document.getElementById('temperature').value,
            provider: document.getElementById('apiUrl').value,
        };
    }

    toggleSettings() {
        if (this.settingsDiv.style.display === 'none' || this.settingsDiv.style.display === '') {
            this.settingsDiv.style.display = 'block';
            this.summaryElement.style.display = 'none';
            this.buttonContainer.style.display = 'none';
        } else {
            this.settingsDiv.style.display = 'none';
            this.summaryElement.style.display = 'block';
            if (this.summaryElement.textContent.trim() !== '' && !this.summaryElement.textContent.includes('Generating summary...')) {
                this.buttonContainer.style.display = 'flex';
            }
        }
    }

    showMessage(message) {
        this.summaryElement.textContent = message;
        this.buttonContainer.style.display = 'none';
    }

    displaySummary(summary) {
        const extractedSummary = summary.match(/```markdown\n([\s\S]*?)```/)?.[1] || summary;
        const formattedSummary = extractedSummary.replace(/\n{3,}/g, '\n\n');
        if (typeof marked !== 'undefined') {
            this.summaryElement.innerHTML = marked.parse(formattedSummary, {
                gfm: true,
                breaks: true,
                sanitize: false
            });
        } else {
            this.summaryElement.textContent = formattedSummary;
        }
        this.scrollToBottom();
        this.buttonContainer.style.display = 'flex';
    }

    scrollToBottom() {
        this.summaryElement.scrollTop = this.summaryElement.scrollHeight;
    }

    autoResizeTextarea() {
        const textarea = document.getElementById('prompt');
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    setupPasswordToggle() {
        const togglePassword = document.getElementById('togglePassword');
        const appKeyInput = document.getElementById('appKey');
        togglePassword.addEventListener('click', function () {
            const type = appKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
            appKeyInput.setAttribute('type', type);
            this.innerHTML = type === 'password'
                ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>';
        });
    }

    updateConnectionStatus(result) {
        const connectionStatus = document.getElementById('connectionStatus');
        const connectionStatusText = document.getElementById('connectionStatusText');
        connectionStatus.innerHTML = '';
        connectionStatusText.innerHTML = '';
        if (result.success) {
            connectionStatus.innerHTML = 'SUCCESS';
            connectionStatus.classList.add('success');
            connectionStatus.classList.remove('error');
            connectionStatusText.innerHTML = '<p>Connection established successfully. Configuration has been saved.</p>';
        } else {
            connectionStatus.innerHTML = 'ERROR';
            connectionStatus.classList.add('error');
            connectionStatus.classList.remove('success');
            connectionStatusText.innerHTML = `<p>Connection failed: ${result.error}</p>`;
        }

        // Add detailed response information
        if (result.details) {
            connectionStatusText.innerHTML += '<div class="details-container"><pre class="details-content">' + JSON.stringify(result.details, null, 2) + '</pre></div>';
        }
    }

    setupApiCandidates() {
        const apiCandidates = document.getElementById('apiCandidates');
        const apiUrlInput = document.getElementById('apiUrl');

        apiCandidates.addEventListener('change', async (event) => {
            if (event.target.value) {
                apiUrlInput.value = event.target.value;
                const provider = event.target.value;

                // 使用 Promise 包装 chrome.storage.local.get
                const result = await new Promise(resolve => {
                    chrome.storage.local.get(['providers'], resolve);
                });

                const providers = result.providers || {};
                const providerSettings = providers[provider] || {};

                document.getElementById('appKey').value = providerSettings.appKey || '';
                document.getElementById('model').value = providerSettings.model || '';
                document.getElementById('prompt').value = providerSettings.prompt || PROMPT;
                document.getElementById('temperature').value = providerSettings.temperature || '0.7';

                await this.saveProviderSettings(provider);
            }
        });

        apiUrlInput.addEventListener('input', async () => {
            const currentUrl = apiUrlInput.value;
            const matchingOption = Array.from(apiCandidates.options).find(option => option.value === currentUrl);
            if (matchingOption) {
                apiCandidates.value = currentUrl;
            } else {
                apiCandidates.value = "";
            }

            await this.saveProviderSettings(currentUrl);
        });
    }

    async saveProviderSettings(provider) {
        const settings = {
            provider: provider,
            appKey: document.getElementById('appKey').value,
            apiUrl: document.getElementById('apiUrl').value,
            model: document.getElementById('model').value,
            prompt: document.getElementById('prompt').value,
            temperature: document.getElementById('temperature').value,
        };

        await new Promise(resolve => {
            chrome.storage.local.set({ provider: provider }, resolve);
        });

        const storageManager = new StorageManager();
        await storageManager.saveSettings(settings);

        this.showSaveSuccessMessage(settings.model);
    }

    showSaveSuccessMessage(model) {
        const messageElement = document.createElement('div');
        messageElement.textContent = `Model changed to ${model}`;
        messageElement.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #4CAF50;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        opacity: 0;
        font-size: 14px;
        transition: opacity 0.3s ease-in-out;
      `;

        document.body.appendChild(messageElement);

        setTimeout(() => {
            messageElement.style.opacity = '1';
        }, 100);

        setTimeout(() => {
            messageElement.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(messageElement);
            }, 300);
        }, 3000);
    }
}
