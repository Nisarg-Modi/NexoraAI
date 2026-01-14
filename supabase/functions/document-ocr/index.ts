import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedFields {
  document_type: string;
  full_name: string | null;
  date_of_birth: string | null;
  id_number: string | null;
  address: string | null;
  expiry_date: string | null;
  issue_date: string | null;
  nationality: string | null;
  gender: string | null;
  additional_fields: Record<string, string>;
  raw_text: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, imageBase64 } = await req.json();

    if (!imageUrl && !imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Either imageUrl or imageBase64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build the image content for the vision model
    let imageContent;
    if (imageBase64) {
      const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        imageContent = {
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${base64Data}`
          }
        };
      } else {
        imageContent = {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`
          }
        };
      }
    } else {
      imageContent = {
        type: "image_url",
        image_url: {
          url: imageUrl
        }
      };
    }

    console.log('Sending request to Lovable AI for structured OCR extraction...');

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
            content: `You are an expert OCR (Optical Character Recognition) assistant specialized in extracting structured data from ID documents, passports, driver's licenses, and other official documents. Extract all visible text and identify specific fields accurately. If a field is not visible or unclear, return null for that field.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text and structured fields from this document image. Identify the document type and extract specific fields like name, date of birth, ID number, address, etc.'
              },
              imageContent
            ]
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_document_data",
              description: "Extract structured data from a document image including all identifiable fields and raw text.",
              parameters: {
                type: "object",
                properties: {
                  document_type: {
                    type: "string",
                    description: "Type of document (e.g., 'ID Card', 'Passport', 'Driver License', 'Medical Card', 'Insurance Card', 'Other')"
                  },
                  full_name: {
                    type: "string",
                    nullable: true,
                    description: "Full name as shown on the document"
                  },
                  date_of_birth: {
                    type: "string",
                    nullable: true,
                    description: "Date of birth in YYYY-MM-DD format if possible, otherwise as shown"
                  },
                  id_number: {
                    type: "string",
                    nullable: true,
                    description: "Document ID number, license number, passport number, or similar identifier"
                  },
                  address: {
                    type: "string",
                    nullable: true,
                    description: "Full address if visible"
                  },
                  expiry_date: {
                    type: "string",
                    nullable: true,
                    description: "Document expiry date in YYYY-MM-DD format if possible"
                  },
                  issue_date: {
                    type: "string",
                    nullable: true,
                    description: "Document issue date in YYYY-MM-DD format if possible"
                  },
                  nationality: {
                    type: "string",
                    nullable: true,
                    description: "Nationality or citizenship if shown"
                  },
                  gender: {
                    type: "string",
                    nullable: true,
                    description: "Gender if shown (M, F, or as displayed)"
                  },
                  additional_fields: {
                    type: "object",
                    description: "Any other identified fields as key-value pairs (e.g., blood type, class, restrictions, employer)"
                  },
                  raw_text: {
                    type: "string",
                    description: "All raw text extracted from the document"
                  }
                },
                required: ["document_type", "raw_text"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_document_data" } }
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
    if (!toolCall || toolCall.function.name !== 'extract_document_data') {
      throw new Error('Failed to extract structured data from document');
    }

    const extractedFields: ExtractedFields = JSON.parse(toolCall.function.arguments);

    console.log('Structured OCR extraction successful:', extractedFields.document_type);

    // Format the extracted text for display
    let formattedText = `DOCUMENT TYPE: ${extractedFields.document_type}\n\n`;
    formattedText += `EXTRACTED FIELDS:\n`;
    
    if (extractedFields.full_name) formattedText += `• Name: ${extractedFields.full_name}\n`;
    if (extractedFields.date_of_birth) formattedText += `• Date of Birth: ${extractedFields.date_of_birth}\n`;
    if (extractedFields.id_number) formattedText += `• ID Number: ${extractedFields.id_number}\n`;
    if (extractedFields.address) formattedText += `• Address: ${extractedFields.address}\n`;
    if (extractedFields.expiry_date) formattedText += `• Expiry Date: ${extractedFields.expiry_date}\n`;
    if (extractedFields.issue_date) formattedText += `• Issue Date: ${extractedFields.issue_date}\n`;
    if (extractedFields.nationality) formattedText += `• Nationality: ${extractedFields.nationality}\n`;
    if (extractedFields.gender) formattedText += `• Gender: ${extractedFields.gender}\n`;
    
    if (extractedFields.additional_fields && Object.keys(extractedFields.additional_fields).length > 0) {
      formattedText += `\nADDITIONAL FIELDS:\n`;
      for (const [key, value] of Object.entries(extractedFields.additional_fields)) {
        formattedText += `• ${key}: ${value}\n`;
      }
    }
    
    formattedText += `\nRAW TEXT:\n${extractedFields.raw_text}`;

    return new Response(
      JSON.stringify({ 
        success: true,
        extractedText: formattedText,
        structuredData: extractedFields,
        model: 'google/gemini-3-flash-preview'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in document-ocr function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process document';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
