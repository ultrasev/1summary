let openSidebarTabIds = new Set();

function toggleSidebar(tab) {
    if (openSidebarTabIds.has(tab.id)) {
        chrome.sidePanel.setOptions({
            tabId: tab.id,
            enabled: false
        });
        openSidebarTabIds.delete(tab.id);
    } else {
        chrome.sidePanel.setOptions({
            tabId: tab.id,
            path: 'sidebar.html',
            enabled: true
        });
        chrome.sidePanel.open({ tabId: tab.id });
        openSidebarTabIds.add(tab.id);
    }
}

function injectKeyListener(tabId) {
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    chrome.runtime.sendMessage({ action: 'close-sidebar' });
                }
            });
        }
    });
}

chrome.action.onClicked.addListener((tab) => {
    toggleSidebar(tab);
    injectKeyListener(tab.id);
});

chrome.commands.onCommand.addListener((command, tab) => {
    if (command === "toggle-sidebar") {
        toggleSidebar(tab);
        injectKeyListener(tab.id);
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    openSidebarTabIds.delete(tabId);
});

chrome.runtime.onMessage.addListener((request, sender) => {
    if (request.action === 'toggle-sidebar' && sender.tab) {
        if (openSidebarTabIds.has(sender.tab.id)) {
            toggleSidebar(sender.tab);
        }
    } else if (request.action === 'close-sidebar' && sender.tab) {
        if (openSidebarTabIds.has(sender.tab.id)) {
            toggleSidebar(sender.tab);
        }
    }
});
