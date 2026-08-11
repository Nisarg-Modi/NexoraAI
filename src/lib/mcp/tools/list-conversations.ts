import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_conversations",
  title: "List conversations",
  description: "List the signed-in user's Nexora conversations (direct chats and groups), most recently updated first.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(20).describe("Maximum number of conversations to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: parts, error: partsError } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", ctx.getUserId());
    if (partsError) {
      return { content: [{ type: "text", text: partsError.message }], isError: true };
    }
    const ids = (parts ?? []).map((p) => p.conversation_id);
    if (ids.length === 0) {
      return { content: [{ type: "text", text: "No conversations." }], structuredContent: { conversations: [] } };
    }
    const { data, error } = await supabase
      .from("conversations")
      .select("id, is_group, group_name, created_at, updated_at")
      .in("id", ids)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { conversations: data ?? [] },
    };
  },
});
