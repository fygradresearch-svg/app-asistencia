export function createDeviceToken() {
  return `${crypto.randomUUID()}.${crypto.randomUUID()}`;
}

export function getBearerToken(headers: Headers) {
  const authorization = headers.get("authorization");
  if (!authorization) {
    return null;
  }
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}
