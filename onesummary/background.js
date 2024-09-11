chrome.commands.onCommand.addListener((command) => {
    if (command === "summarize") {
        chrome.action.openPopup();
    }
});
