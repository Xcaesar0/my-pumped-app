import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, oauth_token, oauth_verifier } = await req.json()
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get X API credentials from environment
    const xApiKey = Deno.env.get('X_API_KEY')
    const xApiSecret = Deno.env.get('X_API_SECRET')

    // --- START DEBUG LOGS ---
    console.log("--- Edge Function Secrets Debug ---");
    console.log("Is X_API_KEY present?", !!xApiKey);
    console.log("Is X_API_SECRET present?", !!xApiSecret);
    if (xApiKey) {
      console.log("X_API_KEY Length:", xApiKey.length);
      console.log("X_API_KEY Partial:", `${xApiKey.substring(0, 3)}...${xApiKey.slice(-3)}`);
    }
    if (xApiSecret) {
      console.log("X_API_SECRET Length:", xApiSecret.length);
      console.log("X_API_SECRET Partial:", `${xApiSecret.substring(0, 3)}...${xApiSecret.slice(-3)}`);
    }
    console.log("---------------------------------");
    
    const callbackUrl = Deno.env.get('X_CALLBACK_URL') || 'https://pumped.fun/callback'
    
    if (action === 'get_auth_url') {
      // Step 1: Get request token
      const requestTokenResponse = await fetch('https://api.twitter.com/oauth/request_token', {
        method: 'POST',
        headers: {
          'Authorization': generateOAuthHeader('POST', 'https://api.twitter.com/oauth/request_token', {
            oauth_callback: callbackUrl
          }, xApiKey, xApiSecret)
        }
      })
      
      if (!requestTokenResponse.ok) {
        const errorText = await requestTokenResponse.text()
        console.error('Request token error:', errorText)
        throw new Error(`Failed to get request token: ${requestTokenResponse.status}`)
      }
      
      const requestTokenData = new URLSearchParams(await requestTokenResponse.text())
      const oauthToken = requestTokenData.get('oauth_token')
      
      if (!oauthToken) {
        throw new Error('No oauth_token received')
      }
      
      // Step 2: Generate authorization URL
      const authUrl = `https://api.twitter.com/oauth/authorize?oauth_token=${oauthToken}`
      
      return new Response(JSON.stringify({ auth_url: authUrl, oauth_token: oauthToken }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    if (action === 'exchange_token' && oauth_token && oauth_verifier) {
      // Step 3: Exchange request token for access token
      const accessTokenResponse = await fetch('https://api.twitter.com/oauth/access_token', {
        method: 'POST',
        headers: {
          'Authorization': generateOAuthHeader('POST', 'https://api.twitter.com/oauth/access_token', {
            oauth_token,
            oauth_verifier
          }, xApiKey, xApiSecret)
        }
      })
      
      if (!accessTokenResponse.ok) {
        const errorText = await accessTokenResponse.text()
        console.error('Access token error:', errorText)
        throw new Error(`Failed to exchange token: ${accessTokenResponse.status}`)
      }
      
      const accessTokenData = new URLSearchParams(await accessTokenResponse.text())
      const accessToken = accessTokenData.get('oauth_token')
      const accessTokenSecret = accessTokenData.get('oauth_token_secret')
      const userId = accessTokenData.get('user_id')
      const screenName = accessTokenData.get('screen_name')
      
      if (!accessToken || !accessTokenSecret || !userId) {
        throw new Error('Invalid token response')
      }
      
      // Get user info from X API (using OAuth 1.0a for v2 API)
      const userResponse = await fetch(`https://api.twitter.com/2/users/${userId}?user.fields=id,username,name,profile_image_url`, {
        headers: {
          'Authorization': generateOAuthHeader('GET', `https://api.twitter.com/2/users/${userId}`, {}, xApiKey, xApiSecret, accessToken, accessTokenSecret)
        }
      })
      
      let userData = null
      if (userResponse.ok) {
        userData = await userResponse.json()
      }
      
      return new Response(JSON.stringify({
        access_token: accessToken,
        access_token_secret: accessTokenSecret,
        user_id: userId,
        screen_name: screenName,
        user_data: userData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
    
  } catch (error) {
    console.error('X OAuth error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function generateOAuthHeader(
  method: string, 
  url: string, 
  params: Record<string, string>, 
  apiKey: string, 
  apiSecret: string,
  accessToken?: string,
  accessTokenSecret?: string
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const nonce = Math.random().toString(36).substring(2)
  
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_version: '1.0',
    ...params
  }
  
  // Add access token if provided (for authenticated requests)
  if (accessToken) {
    oauthParams.oauth_token = accessToken
  }
  
  // Create signature base string
  const sortedParams = Object.keys(oauthParams)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(oauthParams[key])}`)
    .join('&')
  
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams)
  ].join('&')
  
  // Create signing key
  const signingKey = accessTokenSecret 
    ? `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessTokenSecret)}`
    : `${encodeURIComponent(apiSecret)}&`
  
  // Generate HMAC-SHA1 signature
  const signature = hmac('sha1', signingKey, signatureBaseString, 'base64')
  
  // Build OAuth header
  const oauthHeader = [
    'OAuth',
    `oauth_consumer_key="${encodeURIComponent(apiKey)}"`,
    `oauth_nonce="${encodeURIComponent(nonce)}"`,
    `oauth_signature="${encodeURIComponent(signature)}"`,
    `oauth_signature_method="HMAC-SHA1"`,
    `oauth_timestamp="${timestamp}"`,
    `oauth_version="1.0"`
  ]
  
  // Add access token to header if provided
  if (accessToken) {
    oauthHeader.push(`oauth_token="${encodeURIComponent(accessToken)}"`)
  }
  
  return oauthHeader.join(', ')
} 