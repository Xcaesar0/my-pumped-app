import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const X_CLIENT_ID = Deno.env.get('X_CLIENT_ID')!;
const X_CLIENT_SECRET = Deno.env.get('X_CLIENT_SECRET')!;
const X_REDIRECT_URI = Deno.env.get('X_REDIRECT_URI')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function generateState() {
  return crypto.randomUUID();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  // 1. Start OAuth: Redirect to X
  if (path === 'start') {
    const state = generateState();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: X_CLIENT_ID,
      redirect_uri: X_REDIRECT_URI,
      scope: 'tweet.read users.read offline.access',
      state,
      code_challenge: 'challenge', // PKCE: implement if required
      code_challenge_method: 'plain',
    });
    // Set state in cookie (for CSRF protection)
    const headers = new Headers({ ...corsHeaders, 'Set-Cookie': `x_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Secure` });
    return Response.redirect(`https://twitter.com/i/oauth2/authorize?${params.toString()}`, 302, { headers });
  }

  // 2. Callback: Exchange code for tokens, fetch profile, store in DB
  if (path === 'callback') {
    const { searchParams } = url;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    // TODO: Validate state param with cookie (not available in Edge Functions, so recommend using a frontend session or JWT)
    if (!code || !state) {
      return new Response('Missing code or state', { status: 400, headers: corsHeaders });
    }
    try {
      // Exchange code for tokens
      const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: X_REDIRECT_URI,
          client_id: X_CLIENT_ID,
          client_secret: X_CLIENT_SECRET,
        }),
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return new Response(`Token exchange failed: ${err}`, { status: 400, headers: corsHeaders });
      }
      const tokenData = await tokenRes.json();
      const { access_token, refresh_token, expires_in } = tokenData;
      // Fetch user profile
      const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=id,username,profile_image_url', {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (!userRes.ok) {
        const err = await userRes.text();
        return new Response(`User fetch failed: ${err}`, { status: 400, headers: corsHeaders });
      }
      const userData = await userRes.json();
      const { id, username, profile_image_url } = userData.data;
      // Store in Supabase social_connections (provider_metadata)
      // You must authenticate the user (e.g., via JWT in Authorization header)
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return new Response('Missing Authorization header', { status: 401, headers: corsHeaders });
      }
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { global: { headers: { Authorization: authHeader } } });
      // Get user id from JWT
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return new Response('User not authenticated', { status: 401, headers: corsHeaders });
      }
      // Upsert social connection
      const { error } = await supabase.from('social_connections').upsert({
        user_id: user.id,
        platform: 'x',
        platform_user_id: id,
        platform_username: username,
        is_active: true,
        provider_metadata: {
          access_token,
          refresh_token,
          expires_at: Date.now() + expires_in * 1000,
          x_user_id: id,
          x_username: username,
          x_avatar_url: profile_image_url,
        },
        connected_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform' });
      if (error) {
        return new Response(`DB error: ${error.message}`, { status: 500, headers: corsHeaders });
      }
      // Redirect to frontend with success
      return Response.redirect('https://pumped.fun/profile?x_connected=1', 302);
    } catch (err) {
      return new Response(`OAuth error: ${err}`, { status: 500, headers: corsHeaders });
    }
  }

  // 3. Token Refresh (POST /refresh)
  if (path === 'refresh' && req.method === 'POST') {
    try {
      const { refresh_token } = await req.json();
      if (!refresh_token) return new Response('Missing refresh_token', { status: 400, headers: corsHeaders });
      const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token,
          client_id: X_CLIENT_ID,
          client_secret: X_CLIENT_SECRET,
        }),
      });
      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        return new Response(`Token refresh failed: ${err}`, { status: 400, headers: corsHeaders });
      }
      const tokenData = await tokenRes.json();
      return new Response(JSON.stringify(tokenData), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch (err) {
      return new Response(`Refresh error: ${err}`, { status: 500, headers: corsHeaders });
    }
  }

  return new Response('Not found', { status: 404, headers: corsHeaders });
}); 