import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { emptyResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";

type TimesheetRejectInput = {
  timesheet_id: string;
  comment: string;
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const { client, user } = await requireUser(request);
    const body = await readJson<TimesheetRejectInput>(request);

    const { data: timesheet, error: fetchError } = await client
      .from("timesheets")
      .select("*")
      .eq("id", body.timesheet_id)
      .maybeSingle();

    if (fetchError || !timesheet) {
      return jsonResponse({ error: "Timesheet not found." }, 404);
    }

    const { data: membership } = await client
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", timesheet.organization_id)
      .maybeSingle();

    if (!membership || !["owner", "manager"].includes(membership.role)) {
      return jsonResponse({ error: "Only managers or owners can reject timesheets." }, 403);
    }

    const reviewedAt = new Date().toISOString();

    const { error: entriesError } = await client
      .from("time_entries")
      .update({ status: "rejected" })
      .eq("timesheet_id", timesheet.id);

    if (entriesError) {
      return jsonResponse({ error: entriesError.message }, 400);
    }

    const { data, error } = await client
      .from("timesheets")
      .update({
        status: "rejected",
        reviewed_at: reviewedAt,
        reviewed_by: user.id,
        rejection_reason: body.comment,
      })
      .eq("id", timesheet.id)
      .select("*")
      .single();

    if (error) {
      return jsonResponse({ error: error.message }, 400);
    }

    await client.from("approval_decisions").insert({
      organization_id: timesheet.organization_id,
      timesheet_id: timesheet.id,
      actor_user_id: user.id,
      action: "rejected",
      comment: body.comment,
    });

    await client.from("audit_events").insert({
      organization_id: timesheet.organization_id,
      actor_user_id: user.id,
      event_type: "timesheet_rejected",
      entity_type: "timesheet",
      entity_id: timesheet.id,
      payload: { comment: body.comment },
    });

    return jsonResponse({ timesheet: data });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 401);
  }
});
