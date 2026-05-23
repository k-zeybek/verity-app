const SUPABASE_URL = 'https://gpyxoibtcjuabmujrxpq.supabase.co';
const SUPABASE_PUB_KEY = 'sb_publishable_RMvnK4S1r7txxEFAqmEWFg_L4OkhGwx';

export function getToken() {
  return new Promise((resolve) => {
    // 1. Force the native callback API to ensure 100% compatibility across all build tools
    chrome.storage.local.get(['supabase_session'], async (res) => {
      console.log("[Verity Auth] Storage read complete. Data:", res);
      
      let session = res.supabase_session;
      if (!session || !session.access_token) {
        console.warn("[Verity Auth] No session or access_token found in storage.");
        return resolve(null);
      }

      // 2. Decode the JWT to get the exact expiration, ignoring external wrappers
      let expiresAt = session.expires_at;
      try {
        const payload = JSON.parse(atob(session.access_token.split('.')[1]));
        if (payload.exp) expiresAt = payload.exp;
      } catch (e) {
        console.warn("[Verity Auth] Could not parse JWT payload, falling back to session object.");
      }

      const currentTime = Math.floor(Date.now() / 1000);
      console.log(`[Verity Auth] Token Check - Current Time: ${currentTime}, Expires At: ${expiresAt}`);

      // 3. If valid for at least 60 more seconds, return it immediately
      if (expiresAt && currentTime + 60 < expiresAt) {
        console.log("[Verity Auth] Token is valid. Returning to UI.");
        return resolve(session.access_token);
      }

      // 4. Only refresh if genuinely expired
      console.log("[Verity Auth] Token expired or expiring soon. Refreshing...");
      const newToken = await refreshSession(session.refresh_token);
      resolve(newToken);
    });
  });
}

async function refreshSession(refreshToken) {
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_PUB_KEY,
        'Authorization': `Bearer ${SUPABASE_PUB_KEY}`
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!res.ok) {
      console.warn(`[Verity Auth] Refresh rejected by Supabase (Status ${res.status}).`);
      if (res.status === 400 || res.status === 401) {
         await chrome.storage.local.remove('supabase_session');
      }
      return null;
    }

    const newSession = await res.json();
    await chrome.storage.local.set({ supabase_session: newSession });
    console.log("[Verity Auth] Session refreshed successfully!");
    return newSession.access_token;
  } catch (e) {
    console.error('[Verity Auth] Network error during refresh:', e);
    return null;
  }
}

export async function requestMagicLink(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_PUB_KEY
    },
    body: JSON.stringify({
      email,
      create_user: false,
    })
  });

  if (!res.ok) {
    const data = await res.json();
    return { error: data.error_description || data.msg || 'Failed to send link' };
  }

  return {};
}

export default getToken;