// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const X_API_KEY = Deno.env.get("X_API_KEY")
const X_API_SECRET = Deno.env.get("X_API_SECRET")
const CALLBACK_URL = Deno.env.get("X_CALLBACK_URL") || "https://pumped.fun/x-callback"

function percentEncode(str: string) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function getOAuthSignatureBaseString(method: string, url: string, params: Record<string, string>) {
  const sorted = Object.keys(params).sort().map(key => `${percentEncode(key)}=${percentEncode(params[key])}`).join('&')
  return [method.toUpperCase(), percentEncode(url), percentEncode(sorted)].join('&')
}

function getSigningKey(consumerSecret: string, tokenSecret = "") {
  return `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`
}

async function getOAuthSignature(baseString: string, signingKey: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(baseString)
  )
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

function withCORS(response: Response) {
  const headers = new Headers(response.headers)
  headers.set("Access-Control-Allow-Origin", "https://pumped.fun")
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

console.log("Hello from Functions!")

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    // Handle preflight
    return withCORS(new Response(null, { status: 204 }))
  }

  if (req.method !== "POST") {
    return withCORS(new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 }))
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {}

  // Step 2: Handle callback with oauth_token and oauth_verifier
  if (body.oauth_token && body.oauth_verifier) {
    const oauth_token = body.oauth_token
    const oauth_verifier = body.oauth_verifier

    // Prepare params for access token exchange
    const url = "https://api.twitter.com/oauth/access_token"
    const oauth_consumer_key = X_API_KEY!
    const oauth_nonce = crypto.randomUUID().replace(/-/g, "")
    const oauth_signature_method = "HMAC-SHA1"
    const oauth_timestamp = Math.floor(Date.now() / 1000).toString()
    const oauth_version = "1.0"

    const params = {
      oauth_consumer_key,
      oauth_token,
      oauth_nonce,
      oauth_signature_method,
      oauth_timestamp,
      oauth_verifier,
      oauth_version
    }

    const baseString = getOAuthSignatureBaseString("POST", url, params)
    const signingKey = getSigningKey(X_API_SECRET!)
    const oauth_signature = await getOAuthSignature(baseString, signingKey)

    const authHeader =
      `OAuth oauth_consumer_key="${percentEncode(oauth_consumer_key)}",` +
      `oauth_token="${percentEncode(oauth_token)}",` +
      `oauth_nonce="${percentEncode(oauth_nonce)}",` +
      `oauth_signature="${percentEncode(oauth_signature)}",` +
      `oauth_signature_method="${percentEncode(oauth_signature_method)}",` +
      `oauth_timestamp="${percentEncode(oauth_timestamp)}",` +
      `oauth_verifier="${percentEncode(oauth_verifier)}",` +
      `oauth_version="${percentEncode(oauth_version)}"`
      .replace(/\\"/g, '"');

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: ""
    })

    const text = await response.text()
    if (!response.ok) {
      return withCORS(new Response(JSON.stringify({ error: "Failed to get access token", details: text }), { status: 500 }))
    }

    // Parse response: oauth_token, oauth_token_secret, user_id, screen_name
    const result = Object.fromEntries(Array.from((new URLSearchParams(text)) as any))
    if (!result.oauth_token || !result.user_id || !result.screen_name) {
      return withCORS(new Response(JSON.stringify({ error: "Missing data in access token response", details: result }), { status: 500 }))
    }

    // TODO: Save to DB here (user_id, screen_name, oauth_token, oauth_token_secret)
    // For now, just return success and the info
    return withCORS(new Response(
      JSON.stringify({
        success: true,
        x_user_id: result.user_id,
        x_screen_name: result.screen_name,
        oauth_token: result.oauth_token,
        oauth_token_secret: result.oauth_token_secret
      }),
      { headers: { "Content-Type": "application/json" } }
    ))
  }

  // Step 1: Obtain a request token from X
  const oauth_callback = CALLBACK_URL
  const oauth_consumer_key = X_API_KEY!
  const oauth_nonce = crypto.randomUUID().replace(/-/g, "")
  const oauth_signature_method = "HMAC-SHA1"
  const oauth_timestamp = Math.floor(Date.now() / 1000).toString()
  const oauth_version = "1.0"

  const params = {
    oauth_callback,
    oauth_consumer_key,
    oauth_nonce,
    oauth_signature_method,
    oauth_timestamp,
    oauth_version
  }

  const url = "https://api.twitter.com/oauth/request_token"
  const baseString = getOAuthSignatureBaseString("POST", url, params)
  const signingKey = getSigningKey(X_API_SECRET!)
  const oauth_signature = await getOAuthSignature(baseString, signingKey)

  const authHeader =
    `OAuth oauth_callback="${percentEncode(oauth_callback)}",` +
    `oauth_consumer_key="${percentEncode(oauth_consumer_key)}",` +
    `oauth_nonce="${percentEncode(oauth_nonce)}",` +
    `oauth_signature="${percentEncode(oauth_signature)}",` +
    `oauth_signature_method="${percentEncode(oauth_signature_method)}",` +
    `oauth_timestamp="${percentEncode(oauth_timestamp)}",` +
    `oauth_version="${percentEncode(oauth_version)}"`
    .replace(/\\"/g, '"');

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": authHeader,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: ""
  })

  const text = await response.text()
  if (!response.ok) {
    return withCORS(new Response(JSON.stringify({ error: "Failed to get request token", details: text }), { status: 500 }))
  }

  // Parse response: oauth_token, oauth_token_secret, oauth_callback_confirmed
  const result = Object.fromEntries(Array.from((new URLSearchParams(text)) as any))
  if (!result.oauth_token) {
    return withCORS(new Response(JSON.stringify({ error: "No oauth_token in response", details: result }), { status: 500 }))
  }

  // Step 2: Return the authorization URL for the frontend
  const authUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${result.oauth_token}`
  return withCORS(new Response(JSON.stringify({ authUrl }), { headers: { "Content-Type": "application/json" } }))
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/x-oauth' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
