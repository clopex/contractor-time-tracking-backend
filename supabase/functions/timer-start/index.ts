import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { emptyResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";

type TimerStartInput = {
  organization_id: string;
  project_id: string;
  task_id?: string | null;
  note?: string | null;
  billable?: boolean;
  started_at?: string;
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const { client, user } = await requireUser(request);
    const body = await readJson<TimerStartInput>(request);

    const { data: existingSession } = await client
      .from("work_sessions")
      .select("id")
      .eq("organization_id", body.organization_id)
      .eq("user_id", user.id)
      .is("ended_at", null)
      .maybeSingle();

    if (existingSession) {
      return jsonResponse({ error: "An active session already exists." }, 409);
    }

    const startedAt = body.started_at ?? new Date().toISOString();

    const { data, error } = await client
      .from("work_sessions")
      .insert({
        organization_id: body.organization_id,
        user_id: user.id,
        project_id: body.project_id,
        task_id: body.task_id ?? null,
        note: body.note ?? null,
        billable: body.billable ?? true,
        started_at: startedAt,
      })
      .select("*")
      .single();

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ session: data }, 201);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 401);
  }
});
