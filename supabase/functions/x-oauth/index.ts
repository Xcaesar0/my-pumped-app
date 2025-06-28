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
    
    // Basic X/Twitter OAuth handler
    if (method === 'GET') {
      // Handle OAuth callback
      const urlParams = new URLSearchParams(url.split('?')[1])
      const code = urlParams.get('code')
      const state = urlParams.get('state')
      
      console.log(`Received OAuth callback with code: ${code?.substring(0, 10)}... and state: ${state}`)
      
      if (code) {
        // In a real implementation, you would exchange the code for tokens
        // For now, return a success response
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'OAuth callback received',
            code: code,
            state: state 
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        )
      }
    }

    if (method === 'POST') {
      // Handle OAuth token exchange
      const body = await req.json()
      console.log('Received token exchange request:', body)
      
      // In a real implementation, you would exchange the code for tokens
      // For now, simulate a successful token exchange
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'OAuth token exchange simulated',
          access_token: 'simulated_access_token_' + Date.now(),
          refresh_token: 'simulated_refresh_token_' + Date.now(),
          expires_in: 3600
        }),
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