import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { emptyResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { createServiceClient, requireUser } from "../_shared/supabase.ts";

type InviteMemberInput = {
  organization_id: string;
  email: string;
  full_name: string;
  role: "owner" | "manager" | "contractor";
  hourly_rate_cents?: number;
  password: string;
};

const allowedRoles = new Set(["owner", "manager", "contractor"]);

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const { client, user } = await requireUser(request);
    const body = await readJson<InviteMemberInput>(request);

    if (!body.organization_id) {
      return jsonResponse({ error: "organization_id is required." }, 400);
    }

    const email = body.email.trim().toLowerCase();
    const fullName = body.full_name.trim();
    const password = body.password.trim();
    const role = body.role;
    const hourlyRateCents = Math.max(0, body.hourly_rate_cents ?? 0);

    if (!email) {
      return jsonResponse({ error: "Email is required." }, 400);
    }

    if (!fullName) {
      return jsonResponse({ error: "Full name is required." }, 400);
    }

    if (!allowedRoles.has(role)) {
      return jsonResponse({ error: "Invalid role." }, 400);
    }

    if (password.length < 8) {
      return jsonResponse({ error: "Password must be at least 8 characters." }, 400);
    }

    const { data: callerMembership, error: membershipError } = await client
      .from("memberships")
      .select("role")
      .eq("organization_id", body.organization_id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (membershipError || !callerMembership) {
      return jsonResponse({ error: "You do not belong to this organization." }, 403);
    }

    const callerRole = callerMembership.role;
    if (!["owner", "manager"].includes(callerRole)) {
      return jsonResponse({ error: "Only owners and managers can create members." }, 403);
    }

    if (role === "owner" && callerRole !== "owner") {
      return jsonResponse({ error: "Only owners can create other owners." }, 403);
    }

    const service = createServiceClient();
    const createUserResult = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createUserResult.error || !createUserResult.data.user) {
      return jsonResponse({
        error: createUserResult.error?.message ?? "Unable to create auth user.",
      }, 400);
    }

    const createdUser = createUserResult.data.user;

    const { error: profileError } = await service
      .from("user_profiles")
      .upsert({
        id: createdUser.id,
        full_name: fullName,
        email,
      }, {
        onConflict: "id",
      });

    if (profileError) {
      await service.auth.admin.deleteUser(createdUser.id);
      return jsonResponse({ error: profileError.message }, 400);
    }

    const { error: membershipUpsertError } = await service
      .from("memberships")
      .upsert({
        organization_id: body.organization_id,
        user_id: createdUser.id,
        role,
        hourly_rate_cents: hourlyRateCents,
        invited_by: user.id,
        is_active: true,
        deleted_at: null,
      }, {
        onConflict: "organization_id,user_id",
      });

    if (membershipUpsertError) {
      await service.auth.admin.deleteUser(createdUser.id);
      return jsonResponse({ error: membershipUpsertError.message }, 400);
    }

    await service.from("audit_events").insert({
      organization_id: body.organization_id,
      actor_user_id: user.id,
      event_type: "member_created",
      entity_type: "membership",
      entity_id: createdUser.id,
      payload: {
        email,
        role,
        hourly_rate_cents: hourlyRateCents,
      },
    });

    return jsonResponse({
      member: {
        user_id: createdUser.id,
        email,
        full_name: fullName,
        role,
        hourly_rate_cents: hourlyRateCents,
      },
    }, 201);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 401);
  }
});
