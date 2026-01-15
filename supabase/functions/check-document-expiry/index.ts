import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting document expiry check...");

    // Calculate target dates (30, 14, and 7 days from now)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDays = [30, 14, 7];
    const targetDates = targetDays.map(days => {
      const date = new Date(today);
      date.setDate(date.getDate() + days);
      return {
        days,
        dateStr: date.toISOString().split('T')[0]
      };
    });

    console.log("Checking for documents expiring on:", targetDates);

    let totalNotificationsSent = 0;

    // Check each target date
    for (const { days, dateStr } of targetDates) {
      // Find documents expiring on this date
      const { data: expiringDocs, error: docsError } = await supabase
        .from("user_documents")
        .select("id, user_id, file_name, extracted_name, document_category, extracted_expiry_date")
        .eq("extracted_expiry_date", dateStr);

      if (docsError) {
        console.error(`Error fetching documents expiring in ${days} days:`, docsError);
        continue;
      }

      if (!expiringDocs || expiringDocs.length === 0) {
        console.log(`No documents expiring in ${days} days`);
        continue;
      }

      console.log(`Found ${expiringDocs.length} documents expiring in ${days} days`);

      // Group documents by user
      const docsByUser = expiringDocs.reduce((acc, doc) => {
        if (!acc[doc.user_id]) {
          acc[doc.user_id] = [];
        }
        acc[doc.user_id].push(doc);
        return acc;
      }, {} as Record<string, typeof expiringDocs>);

      // Send notifications to each user
      for (const [userId, userDocs] of Object.entries(docsByUser)) {
        // Check if user has push subscriptions
        const { data: subscriptions, error: subError } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", userId)
          .limit(1);

        if (subError || !subscriptions || subscriptions.length === 0) {
          console.log(`No push subscriptions for user ${userId}, skipping notification`);
          continue;
        }

        // Prepare notification content
        const docCount = userDocs.length;
        const docNames = userDocs
          .map(d => d.extracted_name || d.file_name)
          .slice(0, 3)
          .join(", ");
        
        const urgencyWord = days <= 7 ? "⚠️ Urgent" : days <= 14 ? "⏰ Reminder" : "📋 Notice";
        
        let title: string;
        let body: string;

        if (docCount === 1) {
          const doc = userDocs[0];
          title = `${urgencyWord}: Document Expiring Soon`;
          body = `Your ${doc.document_category.replace('_', ' ')} "${doc.extracted_name || doc.file_name}" expires in ${days} days.`;
        } else {
          title = `${urgencyWord}: ${docCount} Documents Expiring Soon`;
          body = `${docNames}${docCount > 3 ? ` and ${docCount - 3} more` : ''} expire in ${days} days.`;
        }

        // Send push notification
        try {
          const { error: pushError } = await supabase.functions.invoke("send-push-notification", {
            body: {
              userId,
              title,
              body,
              data: {
                type: "document_expiry",
                days,
                documentIds: userDocs.map(d => d.id)
              }
            }
          });

          if (pushError) {
            console.error(`Error sending push notification to user ${userId}:`, pushError);
          } else {
            console.log(`Sent expiry notification to user ${userId} for ${docCount} document(s)`);
            totalNotificationsSent++;
          }
        } catch (error) {
          console.error(`Failed to send notification to user ${userId}:`, error);
        }
      }
    }

    console.log(`Document expiry check complete. Total notifications sent: ${totalNotificationsSent}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Checked document expiry. Sent ${totalNotificationsSent} notifications.`,
        notificationsSent: totalNotificationsSent
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-document-expiry:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
