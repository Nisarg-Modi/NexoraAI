import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, action } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'imageBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Extract base64 data and mime type
    let base64Data: string;
    let mimeType = 'image/jpeg';
    
    const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (matches) {
      mimeType = matches[1];
      base64Data = matches[2];
    } else {
      base64Data = imageBase64;
    }

    // Build image content for the vision model using inline_data format
    const imageContent = {
      type: "image_url",
      image_url: { 
        url: `data:${mimeType};base64,${base64Data}`
      }
    };

    console.log('Extracting text from image for translation...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert OCR assistant. Extract ALL visible text from images accurately and detect the language.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text from this image and detect the language of the text.'
              },
              imageContent
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_text_with_language",
              description: "Extract text from image and detect its language",
              parameters: {
                type: "object",
                properties: {
                  extracted_text: {
                    type: "string",
                    description: "All text extracted from the image, preserving structure and line breaks"
                  },
                  detected_language: {
                    type: "string",
                    description: "ISO 639-1 language code of the detected language (e.g., 'en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'hi', 'ru')"
                  },
                  language_name: {
                    type: "string",
                    description: "Human-readable name of the detected language (e.g., 'English', 'Spanish', 'French')"
                  },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "Confidence level of language detection"
                  }
                },
                required: ["extracted_text", "detected_language", "language_name"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_text_with_language" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_text_with_language') {
      throw new Error('Failed to extract text from image');
    }

    const result = JSON.parse(toolCall.function.arguments);
    const extractedText = result.extracted_text?.trim();

    if (!extractedText) {
      return new Response(
        JSON.stringify({ error: 'No text could be extracted from the image' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Text extraction successful, language:', result.language_name, 'length:', extractedText.length);

    return new Response(
      JSON.stringify({ 
        success: true,
        extractedText,
        detectedLanguage: result.detected_language,
        languageName: result.language_name,
        confidence: result.confidence || 'medium'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in scan-translate function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process image';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
