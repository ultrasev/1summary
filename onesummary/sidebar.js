import { UIManager } from './services/ui.js';
import { PopupManager } from './services/popup.js';

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
