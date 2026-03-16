import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { emptyResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import { minutesBetween, weekRange } from "../_shared/time.ts";

type TimerStopInput = {
  session_id: string;
  ended_at?: string;
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const { client, user } = await requireUser(request);
    const body = await readJson<TimerStopInput>(request);

    const { data: session, error: fetchError } = await client
      .from("work_sessions")
      .select("*")
      .eq("id", body.session_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError || !session) {
      return jsonResponse({ error: "Session not found." }, 404);
    }

    if (session.ended_at) {
      return jsonResponse({ error: "Session is already stopped." }, 409);
    }

    const endedAt = body.ended_at ?? new Date().toISOString();
    const minutes = minutesBetween(session.started_at, endedAt);
    const { weekStart, weekEnd } = weekRange(session.started_at);

    const { data: timesheet } = await client
      .from("timesheets")
      .upsert({
        organization_id: session.organization_id,
        user_id: user.id,
        week_start: weekStart,
        week_end: weekEnd,
        status: "draft",
      }, {
        onConflict: "organization_id,user_id,week_start",
      })
      .select("*")
      .single();

    const { data: entry, error: entryError } = await client
      .from("time_entries")
      .insert({
        organization_id: session.organization_id,
        user_id: user.id,
        project_id: session.project_id,
        task_id: session.task_id,
        timesheet_id: timesheet?.id ?? null,
        source: "timer",
        status: "draft",
        billable: session.billable,
        note: session.note,
        started_at: session.started_at,
        ended_at: endedAt,
        minutes,
      })
      .select("*")
      .single();

    if (entryError) {
      return jsonResponse({ error: entryError.message }, 400);
    }

    const { data: updatedSession, error: sessionError } = await client
      .from("work_sessions")
      .update({
        ended_at: endedAt,
        time_entry_id: entry.id,
      })
      .eq("id", session.id)
      .select("*")
      .single();

    if (sessionError) {
      return jsonResponse({ error: sessionError.message }, 400);
    }

    return jsonResponse({
      session: updatedSession,
      time_entry: entry,
      timesheet,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 401);
  }
});
