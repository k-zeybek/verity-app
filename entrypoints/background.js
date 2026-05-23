export default defineBackground(() => {
  // A single, unified listener prevents Chrome from dropping external messages
  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    log("Received external message:", message);

    // Route A: Handle Options Page
    if (message.action === "openOptionsPage") {
      chrome.runtime.openOptionsPage();
      sendResponse({ success: true });
      return;
    }

    // Route B: Handle Supabase Authentication Session
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