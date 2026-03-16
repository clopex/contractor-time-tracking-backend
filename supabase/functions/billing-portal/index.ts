import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { emptyResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import { stripeRequest, type StripePortalSession } from "../_shared/stripe.ts";

type BillingPortalInput = {
  organization_id: string;
  return_url?: string;
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const { client, user } = await requireUser(request);
    const body = await readJson<BillingPortalInput>(request);

    const [{ data: membership }, { data: subscription }] = await Promise.all([
      client
        .from("memberships")
        .select("role")
        .eq("organization_id", body.organization_id)
        .eq("user_id", user.id)
        .maybeSingle(),
      client
        .from("subscriptions")
        .select("provider_customer_id")
        .eq("organization_id", body.organization_id)
        .maybeSingle(),
    ]);

    if (!membership || membership.role !== "owner") {
      return jsonResponse({ error: "Only organization owners can open billing portal." }, 403);
    }

    if (!subscription?.provider_customer_id) {
      return jsonResponse({ error: "No Stripe customer found for this organization yet." }, 400);
    }

    const portal = await stripeRequest<StripePortalSession>("/v1/billing_portal/sessions", {
      customer: subscription.provider_customer_id,
      return_url: body.return_url ?? `${Deno.env.get("ADMIN_SITE_URL") ?? "http://localhost:3000"}/settings/billing`,
    });

    return jsonResponse({ portal_url: portal.url });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 400);
  }
});
