export default defineBackground(() => {
  chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    if (request.action === "openOptionsPage") {
      chrome.runtime.openOptionsPage();
    }
  });

  // Receives the full Supabase session from auth/confirm
  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (message.type !== 'VERITY_AUTH_TOKEN' || !message.session) {
      sendResponse({ success: false, error: 'Invalid payload. Expected a session object.' });
      return;
    }

    // Save the entire session (access token + refresh token + expiry)
    chrome.storage.local.set({ supabase_session: message.session }, () => {
      sendResponse({ success: true });
    });

    return true; 
  });
});