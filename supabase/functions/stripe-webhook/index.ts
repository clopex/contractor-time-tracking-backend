import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { emptyResponse, jsonResponse } from "../_shared/http.ts";

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return emptyResponse();
  }

  return jsonResponse({
    ok: true,
    message: "Stripe webhook scaffold is ready. Event verification and entitlement sync still need live Stripe configuration.",
  });
});
