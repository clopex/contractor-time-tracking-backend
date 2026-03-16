import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { emptyResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";

type AssistantInput = {
  organization_id: string;
  message: string;
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    await requireUser(request);
    const body = await readJson<AssistantInput>(request);

    return jsonResponse({
      organization_id: body.organization_id,
      user_message: body.message,
      mode: "draft_only",
      reply: "AI assistant scaffold is live. Connect OpenAI and implement action planning before enabling real mutations.",
      suggested_actions: [],
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 401);
  }
});
