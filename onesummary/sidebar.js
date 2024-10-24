import { llm, testLLMConnection } from './models.js';
import { PROMPT } from './config.js';

class StorageManager {
  loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['provider', 'providers'], (result) => {
        const provider = result.provider || 'default';
        const providers = result.providers || {};
        const settings = providers[provider] || {};
        resolve({
          provider: provider,
          appKey: settings.appKey || '',
          apiUrl: settings.apiUrl || '',
          model: settings.model || '',
          prompt: settings.prompt || '',
          temperature: settings.temperature || ''
        });
      });
    });
  }

  async saveSettings(settings) {
    const { provider, ...providerSettings } = settings;
    const result = await new Promise((resolve) => {
      chrome.storage.local.get('providers', resolve);
    });
    const providers = result.providers || {};
    providers[provider] = providerSettings;
    await new Promise((resolve) => {
      chrome.storage.local.set({ providers, provider }, resolve);
    });
  }

  getCachedSummary(tabId, url) {
    return new Promise((resolve) => {
      chrome.storage.local.get([`summary_${tabId}_${url}`], (result) => {
        resolve(result[`summary_${tabId}_${url}`] || null);
      });
    });
  }

  cacheSummary(tabId, url, summary) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [`summary_${tabId}_${url}`]: summary }, resolve);
    });
  }
}

class UIManager {
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
      }
    });

    apiUrlInput.addEventListener('input', () => {
      const currentUrl = apiUrlInput.value;
      const matchingOption = Array.from(apiCandidates.options).find(option => option.value === currentUrl);
      if (matchingOption) {
        apiCandidates.value = currentUrl;
      } else {
        apiCandidates.value = "";
      }
    });
  }
}

class SummaryManager {
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

class PopupManager {
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

// Initialize the PopupManager when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const popupManager = new PopupManager();
  await popupManager.init();
});

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateSummary") {
    const uiManager = new UIManager();
    uiManager.displaySummary(request.summary);
  }
});