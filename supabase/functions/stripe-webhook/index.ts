import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { emptyResponse, jsonResponse } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { verifyStripeSignature } from "../_shared/stripe.ts";

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  try {
    const payload = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return jsonResponse({ error: "Missing Stripe signature." }, 400);
    }

    const isValid = await verifyStripeSignature(payload, signature);
    if (!isValid) {
      return jsonResponse({ error: "Invalid Stripe signature." }, 400);
    }

    const event = JSON.parse(payload);
    const object = event.data?.object ?? {};
    const serviceClient = createServiceClient();

    const organizationId =
      object.metadata?.organization_id ??
      object.client_reference_id ??
      null;

    if (!organizationId) {
      return jsonResponse({ ok: true, ignored: true, reason: "No organization metadata." });
    }

    const subscriptionStatus = object.status ?? "active";
    const customerId = object.customer ?? null;
    const subscriptionId = object.subscription ?? object.id ?? null;
    const planCode =
      object.plan?.id ??
      object.items?.data?.[0]?.price?.id ??
      object.display_items?.[0]?.price?.id ??
      "starter";
    const seats =
      object.items?.data?.[0]?.quantity ??
      object.quantity ??
      1;

    if (
      event.type === "checkout.session.completed" ||
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const status = event.type === "customer.subscription.deleted" ? "canceled" : subscriptionStatus;

      await serviceClient.from("subscriptions").upsert({
        organization_id: organizationId,
        provider: "stripe",
        provider_customer_id: customerId,
        provider_subscription_id: subscriptionId,
        plan_code: planCode,
        status,
        seats,
      }, {
        onConflict: "organization_id",
      });

      await serviceClient.from("entitlements").upsert([
        {
          organization_id: organizationId,
          code: "advanced_reports",
          enabled: status !== "canceled",
          limit_value: null,
        },
        {
          organization_id: organizationId,
          code: "ai_assistant",
          enabled: status !== "canceled",
          limit_value: status === "canceled" ? 0 : 500,
        },
        {
          organization_id: organizationId,
          code: "team_members",
          enabled: status !== "canceled",
          limit_value: seats,
        },
      ], {
        onConflict: "organization_id,code",
      });
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 400);
  }
});
