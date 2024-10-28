export class StorageManager {
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

    async currentProvider() {
        const result = await new Promise((resolve) => {
            chrome.storage.local.get('provider', resolve);
        });
        return result.provider || 'default';
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
