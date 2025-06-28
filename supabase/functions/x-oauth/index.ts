import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, method } = req
    console.log(`X-OAuth function called: ${method} ${url}`)
    
    // Handle POST requests for token exchange
    if (method === 'POST') {
      const { code } = await req.json()
      
      if (!code) {
        return new Response(
          JSON.stringify({ error: 'Authorization code is required' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          }
        )
      }
      
      console.log(`Received code: ${code.substring(0, 10)}...`)
      
      // In a real implementation, we would exchange the code for tokens with Twitter
      // For now, we'll simulate a successful token exchange
      return new Response(
        JSON.stringify({
          access_token: `simulated_access_token_${Date.now()}`,
          refresh_token: `simulated_refresh_token_${Date.now()}`,
          expires_in: 7200,
          token_type: 'bearer'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }
    
    // Handle GET requests (should not happen in normal flow)
    if (method === 'GET') {
      return new Response(
        JSON.stringify({ message: 'X OAuth endpoint is working. Use POST to exchange authorization code for tokens.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      }
    )

  } catch (error) {
    console.error('Error in X-OAuth function:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})