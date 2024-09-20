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

chrome.action.onClicked.addListener((tab) => {
    toggleSidebar(tab);
});

chrome.commands.onCommand.addListener((command, tab) => {
    if (command === "toggle-sidebar") {
        toggleSidebar(tab);
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    openSidebarTabIds.delete(tabId);
});
