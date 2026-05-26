export const ADMIN_SESSION_COOKIE = "admin_session";

type AdminSessionPayload = {
  sub: number;
  username: string;
  exp: number;
};

const encoder = new TextEncoder();

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || "dev_admin_session_secret_change_me";
}

function toBase64Url(input: string | ArrayBuffer) {
  const bytes =
    typeof input === "string"
      ? encoder.encode(input)
      : new Uint8Array(input);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function getKey() {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(value: string) {
  const key = await getKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(signature);
}

export async function createAdminSessionToken(payload: Omit<AdminSessionPayload, "exp">) {
  const body: AdminSessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8
  };
  const encoded = toBase64Url(JSON.stringify(body));
  const signature = await sign(encoded);
  return `${encoded}.${signature}`;
}

export async function verifyAdminSessionToken(token: string): Promise<AdminSessionPayload | null> {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = await sign(encoded);
  if (expected !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encoded)) as AdminSessionPayload;
    if (!payload.sub || !payload.username || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
