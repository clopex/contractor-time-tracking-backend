import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { emptyResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";

type TimesheetSubmitInput = {
  timesheet_id: string;
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const { client, user } = await requireUser(request);
    const body = await readJson<TimesheetSubmitInput>(request);

    const { data: timesheet, error: fetchError } = await client
      .from("timesheets")
      .select("*")
      .eq("id", body.timesheet_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError || !timesheet) {
      return jsonResponse({ error: "Timesheet not found." }, 404);
    }

    const { error: entriesError } = await client
      .from("time_entries")
      .update({ status: "submitted" })
      .eq("timesheet_id", timesheet.id)
      .eq("user_id", user.id);

    if (entriesError) {
      return jsonResponse({ error: entriesError.message }, 400);
    }

    const { data, error } = await client
      .from("timesheets")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq("id", timesheet.id)
      .select("*")
      .single();

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    await client.from("audit_events").insert({
      organization_id: timesheet.organization_id,
      actor_user_id: user.id,
      event_type: "timesheet_submitted",
      entity_type: "timesheet",
      entity_id: timesheet.id,
      payload: { status: "submitted" },
    });

    return jsonResponse({ timesheet: data });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 401);
  }
});
