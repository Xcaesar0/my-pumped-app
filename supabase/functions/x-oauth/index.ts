import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const { url, method } = req
    
    // Basic X/Twitter OAuth handler
    if (method === 'GET') {
      // Handle OAuth callback
      const urlParams = new URLSearchParams(url.split('?')[1])
      const code = urlParams.get('code')
      const state = urlParams.get('state')
      
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
      // Handle OAuth initiation or token exchange
      const body = await req.json()
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'OAuth request processed',
          data: body 
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
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})