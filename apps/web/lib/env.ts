// Fail fast with a clear message when required env vars are missing.
// Import `env.*` in server-only code (API routes, server components).

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        "Copy .env.example to .env.local and fill in the value.",
    );
  }
  return val;
}

export const env = {
  get pinataJwt() {
    return requireEnv("PINATA_JWT");
  },
  get pinataGateway() {
    return process.env.PINATA_GATEWAY ?? "gateway.pinata.cloud";
  },
  get supabaseUrl() {
    return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabaseAnonKey() {
    return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  },
};
