const SUPABASE_URL = 'https://gpyxoibtcjuabmujrxpq.supabase.co';
const SUPABASE_PUB_KEY = 'sb_publishable_RMvnK4S1r7txxEFAqmEWFg_L4OkhGwx';

export async function getToken() {
  const res = await chrome.storage.local.get('supabase_session');
  let session = res.supabase_session;

  if (!session || !session.access_token) return null;

  // Supabase provides exact expiration times natively (in seconds)
  const currentTime = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at || 0;

  // If the token expires in less than 60 seconds, refresh it quietly
  if (currentTime + 60 >= expiresAt) {
    return await refreshSession(session.refresh_token);
  }

  return session.access_token;
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
      // Refresh token is dead/revoked. Clear storage to force a re-login.
      await chrome.storage.local.remove('supabase_session');
      return null;
    }

    const newSession = await res.json();
    await chrome.storage.local.set({ supabase_session: newSession });
    
    return newSession.access_token;
  } catch (e) {
    console.error('Verity Auth Refresh Error:', e);
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
      create_user: false, // Ensures only approved beta users can get a link
    })
  });

  if (!res.ok) {
    const data = await res.json();
    return { error: data.error_description || data.msg || 'Failed to send link' };
  }

  return {};
}