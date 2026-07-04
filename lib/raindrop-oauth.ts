const AUTHORIZE_URL = "https://raindrop.io/oauth/authorize";
const TOKEN_URL = "https://raindrop.io/oauth/access_token";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export type RaindropOAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export function getAuthorizeUrl(state: string): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", getEnv("RAINDROP_CLIENT_ID"));
  url.searchParams.set("redirect_uri", getEnv("RAINDROP_REDIRECT_URI"));
  url.searchParams.set("state", state);
  return url.toString();
}

async function requestTokens(body: Record<string, string>): Promise<RaindropOAuthTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Raindrop OAuth token request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export function exchangeCodeForTokens(code: string): Promise<RaindropOAuthTokens> {
  return requestTokens({
    grant_type: "authorization_code",
    code,
    client_id: getEnv("RAINDROP_CLIENT_ID"),
    client_secret: getEnv("RAINDROP_CLIENT_SECRET"),
    redirect_uri: getEnv("RAINDROP_REDIRECT_URI"),
  });
}

export function refreshAccessToken(refreshToken: string): Promise<RaindropOAuthTokens> {
  return requestTokens({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: getEnv("RAINDROP_CLIENT_ID"),
    client_secret: getEnv("RAINDROP_CLIENT_SECRET"),
  });
}
