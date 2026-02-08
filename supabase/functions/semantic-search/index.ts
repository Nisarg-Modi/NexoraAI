import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Sanitize auth header to ensure it's a valid ByteString (ASCII only)
    const sanitizedAuthHeader = authHeader.replace(/[^\x00-\x7F]/g, '');

    const { query, filters, limit = 10 } = await req.json();
    
    if (!query) {
      throw new Error('Search query is required');
    }

    const OPENAI_API_KEY = (Deno.env.get('OPENAI_API_KEY') ?? '').replace(/[^\x21-\x7E]/g, '');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Detect if this is an OpenRouter key (starts with sk-or-)
    const isOpenRouter = OPENAI_API_KEY.startsWith('sk-or-');
    const apiUrl = isOpenRouter
      ? 'https://openrouter.ai/api/v1/embeddings'
      : 'https://api.openai.com/v1/embeddings';

    console.log('Performing semantic search for:', query, 'using', isOpenRouter ? 'OpenRouter' : 'OpenAI');

    // Create Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: sanitizedAuthHeader },
        },
      }
    );

    // Check user's subscription status
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data: subscription } = await supabaseClient
      .from('user_subscriptions')
      .select('plan_type')
      .eq('user_id', user.id)
      .single();

    const hasPremium = subscription?.plan_type === 'premium' || subscription?.plan_type === 'enterprise';

    // Generate query embedding
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    };
    if (isOpenRouter) {
      headers['HTTP-Referer'] = Deno.env.get('SUPABASE_URL') ?? 'https://lovable.dev';
      headers['X-Title'] = 'Nexora Chat';
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
        dimensions: 768
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('Failed to generate query embedding');
    }

    const data = await response.json();
    const queryEmbedding = data.data[0].embedding;

    // Build SQL query for vector similarity search
    let sqlQuery = `
      SELECT 
        me.id,
        me.message_id,
        me.conversation_id,
        me.content_preview,
        me.created_at,
        m.content,
        m.sender_id,
        m.message_type,
        1 - (me.embedding <=> $1::vector) as similarity
      FROM message_embeddings me
      JOIN messages m ON me.message_id = m.id
      JOIN conversation_participants cp ON me.conversation_id = cp.conversation_id
      WHERE cp.user_id = $2
    `;

    // Add premium filters if available
    const params = [JSON.stringify(queryEmbedding), user.id];
    let paramIndex = 3;

    if (hasPremium && filters) {
      if (filters.conversationId) {
        sqlQuery += ` AND me.conversation_id = $${paramIndex}`;
        params.push(filters.conversationId);
        paramIndex++;
      }
      if (filters.senderId) {
        sqlQuery += ` AND m.sender_id = $${paramIndex}`;
        params.push(filters.senderId);
        paramIndex++;
      }
      if (filters.startDate) {
        sqlQuery += ` AND me.created_at >= $${paramIndex}`;
        params.push(filters.startDate);
        paramIndex++;
      }
      if (filters.endDate) {
        sqlQuery += ` AND me.created_at <= $${paramIndex}`;
        params.push(filters.endDate);
        paramIndex++;
      }
      if (filters.messageType) {
        sqlQuery += ` AND m.message_type = $${paramIndex}`;
        params.push(filters.messageType);
        paramIndex++;
      }
    }

    sqlQuery += `
      ORDER BY similarity DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    // Execute search using service role for RPC
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: results, error: searchError } = await serviceClient
      .rpc('semantic_search', {
        query_embedding: JSON.stringify(queryEmbedding),
        user_id: user.id,
        conversation_filter: filters?.conversationId || null,
        sender_filter: filters?.senderId || null,
        start_date: filters?.startDate || null,
        end_date: filters?.endDate || null,
        message_type_filter: filters?.messageType || null,
        match_threshold: 0.5,
        match_count: limit
      });

    if (searchError) {
      console.error('Search error:', searchError);
      throw new Error(`Search failed: ${searchError.message}`);
    }

    console.log(`Found ${results?.length || 0} results`);

    return new Response(
      JSON.stringify({ 
        results: results || [],
        hasPremium,
        query
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in semantic-search:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
