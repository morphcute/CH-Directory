import { readState, saveState } from "./store";

import {
  DEFAULT_CLIENT_ID,
  DEFAULT_CLIENT_SECRET,
  DEFAULT_REFRESH_TOKEN,
  DEFAULT_ADMIN_EMAIL,
} from "./googleConstants";

export {
  DEFAULT_CLIENT_ID,
  DEFAULT_CLIENT_SECRET,
  DEFAULT_REFRESH_TOKEN,
  DEFAULT_ADMIN_EMAIL,
};

export function getGoogleClientId(): string {
  return (
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    DEFAULT_CLIENT_ID
  );
}

export function getGoogleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET || DEFAULT_CLIENT_SECRET;
}

export function getPermanentRefreshToken(): string {
  return process.env.GOOGLE_REFRESH_TOKEN || DEFAULT_REFRESH_TOKEN;
}

/**
 * Exchanges Google OAuth authorization code for permanent refresh token and access token
 */
export async function exchangeGoogleAuthCode(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  email: string;
}> {
  const clientSecret = getGoogleClientSecret();
  const clientId = getGoogleClientId();
  if (!clientSecret) {
    throw new Error("GOOGLE_CLIENT_SECRET is not configured on the server.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
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
  const persistentRefreshToken =
    data.refresh_token ||
    state.googleRefreshToken ||
    getPermanentRefreshToken();

  const patch: Record<string, any> = {
    googleAccessToken: data.access_token,
    googleTokenExpiresAt: Date.now() + (data.expires_in || 3600) * 1000,
    googleRefreshToken: persistentRefreshToken,
  };
  if (email) {
    patch.googleConnectedEmail = email;
  }

  await saveState(patch);

  return {
    accessToken: data.access_token,
    refreshToken: persistentRefreshToken,
    email,
  };
}

let activeRefreshPromise: Promise<string | null> | null = null;

/**
 * Retrieves a valid Google access token, automatically refreshing it if expired
 * using the permanent refresh token stored in the database.
 * 
 * Safety buffer: Refreshes if token has less than 5 minutes remaining.
 * Mutex: Deduplicates simultaneous refresh calls to prevent race conditions.
 */
export async function getValidGoogleAccessToken(forceRefresh = false): Promise<string | null> {
  const state = await readState();
  const token = state.googleAccessToken;
  const refreshToken =
    state.googleRefreshToken ||
    getPermanentRefreshToken();
  const expiresAt = state.googleTokenExpiresAt || 0;

  // 1. If not forcing a refresh and token still has at least 5 minutes of validity left, return it
  if (!forceRefresh && token && expiresAt > Date.now() + 5 * 60 * 1000) {
    return token;
  }

  // 2. If a refresh is already in-flight, return the existing promise so callers share the same refresh
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  // 3. Perform token refresh using permanent refresh token
  const clientSecret = getGoogleClientSecret();
  const clientId = getGoogleClientId();

  if (refreshToken && clientSecret) {
    activeRefreshPromise = (async () => {
      try {
        const response = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.access_token) {
            const nextExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
            await saveState({
              googleAccessToken: data.access_token,
              googleTokenExpiresAt: nextExpiresAt,
              googleRefreshToken: refreshToken,
            });
            return data.access_token;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn("[Google OAuth] Refresh token request rejected by Google:", errData);
        }
      } catch (err) {
        console.warn("[Google OAuth] Failed to refresh Google access token using refresh token:", err);
      } finally {
        activeRefreshPromise = null;
      }
      return token || null;
    })();

    return activeRefreshPromise;
  }

  return token || null;
}
