import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
const VALID_LANGUAGES = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ja',
  'ko',
  'zh',
  'ar',
  'hi',
  'ru',
  'nl',
  'pl',
  'tr'
];
const translateSchema = z.object({
  text: z.string().min(1, 'Text cannot be empty').max(5000, 'Text too long (max 5000 characters)').transform((str)=>str.trim()),
  targetLanguage: z.enum(VALID_LANGUAGES, {
    errorMap: ()=>({
        message: 'Invalid target language'
      })
  }),
  messageId: z.string().uuid().optional()
});
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const body = await req.json();
    // Validate input with Zod
    const validationResult = translateSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(JSON.stringify({
        error: 'Invalid input',
        details: validationResult.error.errors.map((e)=>e.message).join(', ')
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const { text, targetLanguage, messageId } = validationResult.data;
    const OPENAI_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        error: 'Missing or invalid Bearer token'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Check translation limits
    const { data: subscription } = await supabase.from('user_subscriptions').select('plan_type').eq('user_id', user.id).maybeSingle();
    const isPremium = subscription?.plan_type === 'premium' || subscription?.plan_type === 'enterprise';
    // Check daily limit for free users
    if (!isPremium) {
      const { count } = await supabase.from('message_translations').select('*', {
        count: 'exact',
        head: true
      }).eq('user_id', user.id).gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      if (count && count >= 50) {
        return new Response(JSON.stringify({
          error: 'Translation limit reached',
          limitReached: true,
          message: 'Free users are limited to 50 translations per day. Upgrade to Premium for unlimited translations.'
        }), {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    console.log('Translating text to:', targetLanguage);
    // Use Lovable AI for translation
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the following text to ${targetLanguage}. Only return the translated text, nothing else. Preserve tone, formality, and meaning.`
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      })
    });
    if (!response.ok) {
      console.error('AI gateway error:', response.status);
      throw new Error('Translation failed');
    }
    const data = await response.json();
    const translatedText = data.choices?.[0]?.message?.content?.trim();
    if (!translatedText) {
      throw new Error('No translation returned');
    }
    // Detect source language
    const detectResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Detect the language of the following text. Return only the ISO 639-1 language code (e.g., 'en', 'es', 'fr'). Nothing else."
          },
          {
            role: "user",
            content: text
          }
        ],
        temperature: 0,
        max_tokens: 10
      })
    });
    const detectData = await detectResponse.json();
    const sourceLanguage = detectData.choices?.[0]?.message?.content?.trim()?.toLowerCase() || 'unknown';
    // Store translation
    const { error: insertError } = await supabase.from('message_translations').insert({
      user_id: user.id,
      message_id: messageId || crypto.randomUUID(),
      source_language: sourceLanguage,
      target_language: targetLanguage,
      original_text: text,
      translated_text: translatedText
    });
    if (insertError) {
      console.error('Error storing translation:', insertError);
    }
    return new Response(JSON.stringify({
      translatedText,
      sourceLanguage,
      targetLanguage
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('Error in translate-message:', error);
    // Return user-friendly error without exposing internal details
    const errorMessage = error instanceof Error && error.message.includes('Unauthorized') ? 'Authentication required' : 'Unable to complete translation. Please try again.';
    return new Response(JSON.stringify({
      error: errorMessage,
      translatedText: null
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500
    });
  }
});
