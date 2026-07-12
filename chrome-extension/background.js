// MBA Brain DM Sender — Background Service Worker
// Gerencia comunicacao entre popup e content scripts

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Relay messages between popup and content scripts
  if (request.type === 'relay-to-tab') {
    chrome.tabs.sendMessage(request.tabId, request.payload, sendResponse);
    return true;
  }
});