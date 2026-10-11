export default defineBackground(() => {

  // 1. Handle INTERNAL messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log("Received internal message");
    
    if (message?.action === "openOptionsPage") {
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
    }
  });

  // 2. Handle EXTERNAL messages
  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    log("Received external message");

    if (message?.type === 'VERITY_AUTH_TOKEN') {
      if (typeof message.session?.access_token !== 'string' || !message.session.access_token ||
          typeof message.session?.refresh_token !== 'string' || !message.session.refresh_token) {
        sendResponse({ success: false, error: 'Missing session payload' });
        return;
      }

      // Save the complete session object permanently
      chrome.storage.local.set({ supabase_session: message.session }, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: 'Could not save session' });
          return;
        }
        log("Successfully saved session to local storage!");
        sendResponse({ success: true });
      });
      
      return true;
    }

    sendResponse({ success: false, error: 'Unrecognized message type' });
  });
});

function log(...args) { console.log("[Verity Background]", ...args); }