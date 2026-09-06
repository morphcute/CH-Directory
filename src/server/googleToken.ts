import { readState, saveState } from "./store";

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "258026102388-qt7roag98lboej25gl1c372053amcuoc.apps.googleusercontent.com";

const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

/**
 * Exchanges Google OAuth authorization code for permanent refresh token and access token
 */
export async function exchangeGoogleAuthCode(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  email: string;
}> {
  if (!GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_SECRET is not configured on the server.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: "postmessage",
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Failed to exchange authorization code with Google.",
    );
  }

  // Get user profile from Google to confirm email
  let email = "";
  try {
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (userRes.ok) {
      const user = await userRes.json();
      email = (user.email || "").toLowerCase().trim();
    }
  } catch {
    // fallback
  }

  const state = await readState();
  const patch: Record<string, any> = {
    googleAccessToken: data.access_token,
    googleTokenExpiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  if (data.refresh_token) {
    patch.googleRefreshToken = data.refresh_token;
  }
  if (email) {
    patch.googleConnectedEmail = email;
  }

  await saveState(patch);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    email,
  };
}

/**
 * Retrieves a valid Google access token, automatically refreshing it if expired
 * using the permanent refresh token stored in the database.
 */
export async function getValidGoogleAccessToken(): Promise<string | null> {
  const state = await readState();
  const token = state.googleAccessToken;
  const refreshToken = state.googleRefreshToken;
  const expiresAt = state.googleTokenExpiresAt || 0;

  // If token is still fresh (more than 1 minute left before expiration), return it
  if (token && expiresAt > Date.now() + 60000) {
    return token;
  }

  // If we have a refresh token and client secret, request a new access token
  if (refreshToken && GOOGLE_CLIENT_SECRET) {
    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          await saveState({
            googleAccessToken: data.access_token,
            googleTokenExpiresAt: Date.now() + (data.expires_in || 3600) * 1000,
          });
          return data.access_token;
        }
      }
    } catch (err) {
      console.warn("Failed to refresh Google access token using refresh token:", err);
    }
  }

  // Fallback to existing token
  return token || null;
}
