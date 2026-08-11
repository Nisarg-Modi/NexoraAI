import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfileTool from "./tools/get-my-profile";
import listContactsTool from "./tools/list-contacts";
import listConversationsTool from "./tools/list-conversations";
import getMessagesTool from "./tools/get-messages";
import sendMessageTool from "./tools/send-message";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "nexoraai",
  title: "NexoraAI",
  version: "0.1.0",
  instructions:
    "Tools for Nexora, a messaging app. Read the signed-in user's profile and contacts, list their conversations, read recent messages, and send new messages. All access is scoped to the authenticated user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfileTool, listContactsTool, listConversationsTool, getMessagesTool, sendMessageTool],
});
