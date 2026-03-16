import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { emptyResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import { minutesBetween, weekRange } from "../_shared/time.ts";

type TimeEntryCreateInput = {
  organization_id: string;
  project_id: string;
  task_id?: string | null;
  note?: string | null;
  billable?: boolean;
  started_at: string;
  ended_at: string;
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const { client, user } = await requireUser(request);
    const body = await readJson<TimeEntryCreateInput>(request);
    const minutes = minutesBetween(body.started_at, body.ended_at);
    const { weekStart, weekEnd } = weekRange(body.started_at);

    const { data: timesheet, error: timesheetError } = await client
      .from("timesheets")
      .upsert({
        organization_id: body.organization_id,
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
      .insert({
        organization_id: body.organization_id,
        user_id: user.id,
        project_id: body.project_id,
        task_id: body.task_id ?? null,
        timesheet_id: timesheet.id,
        source: "manual",
        status: "draft",
        billable: body.billable ?? true,
        note: body.note ?? null,
        started_at: body.started_at,
        ended_at: body.ended_at,
        minutes,
      })
      .select("*")
      .single();

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    return jsonResponse({ time_entry: data, timesheet }, 201);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 401);
  }
});
