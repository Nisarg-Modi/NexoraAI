import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support both GET with query param and POST with body
    let token: string | null = null;
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
      token = url.searchParams.get('token');
    } else if (req.method === 'POST') {
      const body = await req.json();
      token = body.token;
    }

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Share token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Accessing shared document with token:', token.substring(0, 8) + '...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the share link
    const { data: shareLink, error: shareError } = await supabase
      .from('document_share_links')
      .select('*, user_documents(*)')
      .eq('share_token', token)
      .eq('is_active', true)
      .single();

    if (shareError || !shareLink) {
      console.error('Share link not found:', shareError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired share link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if link has expired
    if (new Date(shareLink.expires_at) < new Date()) {
      console.log('Share link expired');
      return new Response(
        JSON.stringify({ error: 'This share link has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check max access count
    if (shareLink.max_access_count !== null && shareLink.accessed_count >= shareLink.max_access_count) {
      console.log('Max access count reached');
      return new Response(
        JSON.stringify({ error: 'This share link has reached its maximum access limit' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const document = shareLink.user_documents;
    if (!document) {
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment access count
    await supabase
      .from('document_share_links')
      .update({ accessed_count: shareLink.accessed_count + 1 })
      .eq('id', shareLink.id);

    // Generate a signed URL for the document
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.file_path, 3600); // 1 hour expiry

    if (urlError) {
      console.error('Error generating signed URL:', urlError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate document access URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully generated access for document:', document.file_name);

    return new Response(
      JSON.stringify({
        success: true,
        document: {
          file_name: document.file_name,
          file_type: document.file_type,
          document_category: document.document_category,
          signed_url: signedUrl.signedUrl,
        },
        expires_at: shareLink.expires_at,
        access_count: shareLink.accessed_count + 1,
        max_access_count: shareLink.max_access_count,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error accessing shared document:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
