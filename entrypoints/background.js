export default defineBackground(() => {
  chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    if (request.action === "openOptionsPage") {
      chrome.runtime.openOptionsPage();
    }
  });

  // New: receive the Supabase access_token from your site's /auth/confirm page.
  // Your site must be listed under "externally_connectable" > "matches" in manifest.json.
  chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (message.type !== 'VERITY_AUTH_TOKEN' || !message.accessToken) {
      sendResponse({ success: false, error: 'Invalid message' });
      return;
    }

    chrome.storage.local.set({ token: message.accessToken }, () => {
      sendResponse({ success: true });
    });

    return true; // keep channel open for async response
  });
});