type RequiredClientEnvVar =
  | "NEXT_PUBLIC_VAPI_PUBLIC_KEY"
  | "NEXT_PUBLIC_VAPI_ASSISTANT_ID";

function readRequiredEnvVar(name: RequiredClientEnvVar): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing environment variable: ${name}. Add it to .env.local and restart the dev server.`
    );
  }

  return value;
}

export const env: Record<RequiredClientEnvVar, string> = {
  NEXT_PUBLIC_VAPI_PUBLIC_KEY: readRequiredEnvVar("NEXT_PUBLIC_VAPI_PUBLIC_KEY"),
  NEXT_PUBLIC_VAPI_ASSISTANT_ID: readRequiredEnvVar("NEXT_PUBLIC_VAPI_ASSISTANT_ID"),
};
