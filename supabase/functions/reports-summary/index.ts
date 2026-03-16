import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { emptyResponse, jsonResponse } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const { client } = await requireUser(request);
    const organizationId = new URL(request.url).searchParams.get("organization_id");

    if (!organizationId) {
      return jsonResponse({ error: "organization_id is required." }, 400);
    }

    const [{ data: projects }, { data: timesheets }, { data: entries }] = await Promise.all([
      client
        .from("projects")
        .select("id, name, status")
        .eq("organization_id", organizationId)
        .order("name"),
      client
        .from("timesheets")
        .select("id, status")
        .eq("organization_id", organizationId),
      client
        .from("time_entries")
        .select("project_id, minutes, billable, status")
        .eq("organization_id", organizationId),
    ]);

    const totalsByProject = (entries ?? []).reduce<Record<string, number>>((acc, entry) => {
      acc[entry.project_id] = (acc[entry.project_id] ?? 0) + entry.minutes;
      return acc;
    }, {});

    return jsonResponse({
      active_projects: (projects ?? []).filter((project) => project.status === "active").length,
      submitted_timesheets: (timesheets ?? []).filter((timesheet) => timesheet.status === "submitted").length,
      approved_timesheets: (timesheets ?? []).filter((timesheet) => timesheet.status === "approved").length,
      total_hours: Math.round((entries ?? []).reduce((sum, entry) => sum + entry.minutes, 0) / 60),
      billable_hours: Math.round((entries ?? []).filter((entry) => entry.billable).reduce((sum, entry) => sum + entry.minutes, 0) / 60),
      project_breakdown: (projects ?? []).map((project) => ({
        id: project.id,
        name: project.name,
        hours: Math.round((totalsByProject[project.id] ?? 0) / 60),
      })),
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 401);
  }
});
