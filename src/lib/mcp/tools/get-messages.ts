import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_messages",
  title: "Get messages",
  description: "Read the most recent messages in one of the signed-in user's conversations.",
  inputSchema: {
    conversation_id: z.string().uuid().describe("The conversation to read messages from."),
    limit: z.number().int().min(1).max(100).default(30).describe("Maximum number of messages to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ conversation_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("messages")
      .select("id, sender_id, content, message_type, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(limit ?? 30);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    const messages = (data ?? []).slice().reverse();
    return {
      content: [{ type: "text", text: JSON.stringify(messages) }],
      structuredContent: { messages },
    };
  },
});
