import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { emptyResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import { minutesBetween, weekRange } from "../_shared/time.ts";

type TimeEntryUpdateInput = {
  time_entry_id: string;
  project_id?: string;
  task_id?: string | null;
  note?: string | null;
  billable?: boolean;
  started_at?: string;
  ended_at?: string;
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const { client, user } = await requireUser(request);
    const body = await readJson<TimeEntryUpdateInput>(request);

    const { data: existingEntry, error: fetchError } = await client
      .from("time_entries")
      .select("*")
      .eq("id", body.time_entry_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError || !existingEntry) {
      return jsonResponse({ error: "Time entry not found." }, 404);
    }

    if (existingEntry.status !== "draft") {
      return jsonResponse({ error: "Only draft entries can be updated." }, 409);
    }

    const startedAt = body.started_at ?? existingEntry.started_at;
    const endedAt = body.ended_at ?? existingEntry.ended_at;
    const minutes = minutesBetween(startedAt, endedAt);
    const { weekStart, weekEnd } = weekRange(startedAt);

    const { data: timesheet, error: timesheetError } = await client
      .from("timesheets")
      .upsert({
        organization_id: existingEntry.organization_id,
        user_id: user.id,
        week_start: weekStart,
        week_end: weekEnd,
        status: "draft",
      }, {
        onConflict: "organization_id,user_id,week_start",
      })
      .select("*")
      .single();

    if (timesheetError) {
      return jsonResponse({ error: timesheetError.message }, 400);
    }

    const { data, error } = await client
      .from("time_entries")
      .update({
        project_id: body.project_id ?? existingEntry.project_id,
        task_id: body.task_id ?? existingEntry.task_id,
        note: body.note ?? existingEntry.note,
        billable: body.billable ?? existingEntry.billable,
        started_at: startedAt,
        ended_at: endedAt,
        minutes,
        timesheet_id: timesheet.id,
      })
      .eq("id", body.time_entry_id)
      .select("*")
      .single();

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ time_entry: data, timesheet });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 401);
  }
});
