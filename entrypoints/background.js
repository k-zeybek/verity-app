export default defineBackground(() => {

  // 1. Handle INTERNAL messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    log("Received internal message:", message);
    
    if (message?.action === "openOptionsPage") {
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
    }
  });

  // 2. Handle EXTERNAL messages
  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    log("Received external message:", message);

    if (message.type === 'VERITY_AUTH_TOKEN') {
      if (!message.session) {
        sendResponse({ success: false, error: 'Missing session payload' });
        return;
      }

      // Save the complete session object permanently
      chrome.storage.local.set({ supabase_session: message.session }, () => {
        log("Successfully saved session to local storage!");
        sendResponse({ success: true });
      });
      
      return true; // REQUIRED: Tells Chrome to keep the tunnel open for the async storage write
    }

    // Fallback for unhandled messages
    sendResponse({ success: false, error: 'Unrecognized message type' });
  });
});

// Simple internal logger helper for background debugging
function log(...args) { console.log("[Verity Background]", ...args); }