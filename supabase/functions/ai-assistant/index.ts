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
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return jsonResponse({ error: "Missing GEMINI_API_KEY." }, 500);
    }

    const prompt = [
      "You are an AI assistant for a contractor time tracking app.",
      "Return valid JSON only.",
      "JSON shape: {\"reply\": string, \"suggested_actions\": Array<{\"type\": string, \"label\": string, \"payload\": object}>}.",
      "Keep suggested_actions small and safe. Never assume destructive write access.",
      `Organization ID: ${body.organization_id}`,
      `User message: ${body.message}`,
    ].join("\n");

    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    const payload = await response.json();
    if (!response.ok) {
      return jsonResponse({ error: payload.error?.message ?? "Gemini request failed." }, 400);
    }

    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return jsonResponse({ error: "Gemini returned no content." }, 400);
    }

    const parsed = JSON.parse(rawText.replace(/^```json\s*|\s*```$/g, "").trim());

    return jsonResponse({
      organization_id: body.organization_id,
      user_message: body.message,
      mode: "gemini_live",
      reply: parsed.reply ?? "No reply generated.",
      suggested_actions: Array.isArray(parsed.suggested_actions) ? parsed.suggested_actions : [],
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 401);
  }
});
