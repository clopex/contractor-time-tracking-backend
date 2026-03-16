import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { emptyResponse, jsonResponse, readJson } from "../_shared/http.ts";
import { requireUser } from "../_shared/supabase.ts";
import { stripeRequest, type StripeCheckoutSession, type StripeCustomer } from "../_shared/stripe.ts";

type BillingCheckoutInput = {
  organization_id: string;
  price_id: string;
  success_url?: string;
  cancel_url?: string;
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const { client, user } = await requireUser(request);
    const body = await readJson<BillingCheckoutInput>(request);

    const [{ data: membership }, { data: subscription }, { data: profile }] = await Promise.all([
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
      client
        .from("user_profiles")
        .select("email, full_name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    if (!membership || membership.role !== "owner") {
      return jsonResponse({ error: "Only organization owners can start checkout." }, 403);
    }

    let customerId = subscription?.provider_customer_id ?? null;

    if (!customerId) {
      const customer = await stripeRequest<StripeCustomer>("/v1/customers", {
        email: profile?.email ?? user.email ?? "",
        name: profile?.full_name ?? user.user_metadata?.full_name ?? "ContractorOS Owner",
        "metadata[organization_id]": body.organization_id,
      });

      customerId = customer.id;
    }

    const successUrl = body.success_url ?? `${Deno.env.get("ADMIN_SITE_URL") ?? "http://localhost:3000"}/settings/billing?status=success`;
    const cancelUrl = body.cancel_url ?? `${Deno.env.get("ADMIN_SITE_URL") ?? "http://localhost:3000"}/settings/billing?status=cancelled`;

    const session = await stripeRequest<StripeCheckoutSession>("/v1/checkout/sessions", {
      mode: "subscription",
      customer: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      "line_items[0][price]": body.price_id,
      "line_items[0][quantity]": "1",
      "allow_promotion_codes": "true",
      client_reference_id: body.organization_id,
      "metadata[organization_id]": body.organization_id,
      "subscription_data[metadata][organization_id]": body.organization_id,
    });

    return jsonResponse({
      checkout_url: session.url,
      session_id: session.id,
      customer_id: customerId,
    });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 400);
  }
});
