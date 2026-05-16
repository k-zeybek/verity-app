const SUPABASE_URL = 'https://gpyxoibtcjuabmujrxpq.supabase.co'
const SUPABASE_PUB_KEY = 'sb_publishable_RMvnK4S1r7txxEFAqmEWFg_L4OkhGwx'

// Unchanged — content script calls this before every API request.
export async function getToken() {
  const { token } = await chrome.storage.local.get('token')
  return token
}

// Sends a magic link email via Supabase.
// create_user: false means it only works if you've already approved them
// (i.e. their Supabase auth user exists). Unapproved emails get no email at all.
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
  })

  if (!res.ok) {
    const data = await res.json()
    return { error: data.error_description || data.msg || 'Failed to send link' }
  }

  return {}
}

export default getToken