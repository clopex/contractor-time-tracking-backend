import { corsHeaders } from "./cors.ts";

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function emptyResponse(status = 204) {
  return new Response(null, {
    status,
    headers: corsHeaders,
  });
}

export async function readJson<T>(request: Request): Promise<T> {
  return await request.json() as T;
}
