import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function getEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getEnvWithFallback(primary: string, fallback: string) {
  return Deno.env.get(primary) ?? getEnv(fallback);
}

export function createUserClient(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  return createClient(
    getEnv("SUPABASE_URL"),
    getEnvWithFallback("SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"),
    {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    },
  );
}

export function createServiceClient() {
  return createClient(
    getEnv("SUPABASE_URL"),
    getEnvWithFallback("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
  );
}

export async function requireUser(request: Request) {
  const client = createUserClient(request);
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new Error("Unauthorized");
  }

  return { client, user: data.user };
}
