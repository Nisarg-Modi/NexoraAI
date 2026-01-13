import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BadgeNotificationRequest {
  userId: string;
  userName: string;
  badgeType: string;
  status: "approved" | "rejected";
  rejectionReason?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, userName, badgeType, status, rejectionReason }: BadgeNotificationRequest = await req.json();

    console.log(`Sending badge notification for user ${userId}, badge ${badgeType} (${status})`);

    if (!userId) {
      throw new Error("User ID is required");
    }

    // Create Supabase client with service role to access user email
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user email from auth.users table using service role
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !userData?.user?.email) {
      console.error("Could not fetch user email:", userError);
      return new Response(
        JSON.stringify({ error: "Could not fetch user email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const userEmail = userData.user.email;
    console.log(`Sending email to ${userEmail}`);

    const badgeDisplayName = badgeType.charAt(0).toUpperCase() + badgeType.slice(1);
    
    let subject: string;
    let htmlContent: string;

    if (status === "approved") {
      subject = `🎉 Your ${badgeDisplayName} Badge Request Has Been Approved!`;
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Congratulations!</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 16px;">
              Hi <strong>${userName}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #374151; margin-bottom: 16px;">
              Great news! Your request for the <strong style="color: #059669;">${badgeDisplayName}</strong> badge has been <strong style="color: #059669;">approved</strong>!
            </p>
            
            <p style="font-size: 16px; color: #374151; margin-bottom: 16px;">
              Your new badge is now visible on your profile. Thank you for being a valued member of our community!
            </p>
            
            <div style="text-align: center; margin-top: 24px;">
              <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 12px 24px; border-radius: 8px; font-weight: 600;">
                ✨ ${badgeDisplayName} Badge Earned!
              </div>
            </div>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 20px;">
            — The Nexora Team
          </p>
        </div>
      `;
    } else {
      subject = `Update on Your ${badgeDisplayName} Badge Request`;
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Badge Request Update</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb;">
            <p style="font-size: 16px; color: #374151; margin-bottom: 16px;">
              Hi <strong>${userName}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #374151; margin-bottom: 16px;">
              We've reviewed your request for the <strong>${badgeDisplayName}</strong> badge. Unfortunately, we were unable to approve it at this time.
            </p>
            
            ${rejectionReason ? `
            <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
              <p style="font-size: 14px; color: #991b1b; margin: 0;">
                <strong>Reason:</strong> ${rejectionReason}
              </p>
            </div>
            ` : ''}
            
            <p style="font-size: 16px; color: #374151; margin-bottom: 0;">
              You're welcome to apply again in the future. If you have any questions, feel free to reach out to our support team.
            </p>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 20px;">
            — The Nexora Team
          </p>
        </div>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "Nexora <onboarding@resend.dev>",
      to: [userEmail],
      subject,
      html: htmlContent,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-badge-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
