type StripeMethod = "GET" | "POST";

function getStripeSecretKey() {
  const value = Deno.env.get("STRIPE_SECRET_KEY");
  if (!value) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }
  return value;
}

export async function stripeRequest<T>(
  path: string,
  body?: Record<string, string>,
  method: StripeMethod = "POST",
): Promise<T> {
  const headers = new Headers({
    Authorization: `Bearer ${getStripeSecretKey()}`,
  });

  let requestBody: URLSearchParams | undefined;

  if (body) {
    headers.set("Content-Type", "application/x-www-form-urlencoded");
    requestBody = new URLSearchParams(body);
  }

  const response = await fetch(`https://api.stripe.com${path}`, {
    method,
    headers,
    body: requestBody,
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Stripe request failed");
  }

  return payload as T;
}

export async function verifyStripeSignature(payload: string, signatureHeader: string) {
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }

  const elements = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key, value];
    }),
  );

  const timestamp = elements.t;
  const signature = elements.v1;

  if (!timestamp || !signature) {
    throw new Error("Invalid Stripe signature header");
  }

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );

  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return expected === signature;
}

export type StripeCheckoutSession = {
  id: string;
  url: string;
  customer: string | null;
  subscription: string | null;
  client_reference_id: string | null;
  metadata?: Record<string, string>;
};

export type StripeCustomer = {
  id: string;
  email: string | null;
};

export type StripePortalSession = {
  id: string;
  url: string;
};
