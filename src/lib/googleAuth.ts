/**
 * Pure Google OAuth 2.0 implementation using Google Identity Services (GIS)
 * Zero Firebase dependencies.
 */

export const GOOGLE_SHEETS_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";

const DEFAULT_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  process.env.GOOGLE_CLIENT_ID ||
  "258026102388-qt7roag98lboej25gl1c372053amcuoc.apps.googleusercontent.com";

let cachedAccessToken: string | null = null;
let cachedUser: { email: string; name?: string; picture?: string } | null =
  null;

/**
 * Get the Google OAuth Client ID
 */
export function getGoogleClientId(): string {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("ch_google_client_id");
    if (custom && custom.trim()) return custom.trim();
  }
  return (
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    DEFAULT_CLIENT_ID
  );
}

/**
 * Set a custom Google OAuth Client ID in localStorage
 */
export function setGoogleClientId(clientId: string) {
  if (typeof window !== "undefined") {
    if (clientId && clientId.trim()) {
      localStorage.setItem("ch_google_client_id", clientId.trim());
    } else {
      localStorage.removeItem("ch_google_client_id");
    }
  }
}

/**
 * Dynamically loads the official Google Identity Services script
 */
export function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (
      (window as unknown as { google?: { accounts?: { oauth2?: unknown } } })
        .google?.accounts?.oauth2
    ) {
      return resolve();
    }
    const existing = document.getElementById("google-gsi-client");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi-client";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(
        new Error(
          "Failed to load Google Identity Services SDK. Please check your connection.",
        ),
      );
    document.head.appendChild(script);
  });
}

/**
 * Google Sign In with Google Identity Services OAuth 2.0 Token Client
 */
export async function googleSignIn(): Promise<{
  user: { email: string; name?: string; picture?: string };
  accessToken: string;
}> {
  await loadGsiScript();
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error(
      "Google OAuth Client ID is not configured. Please enter your Client ID in .env.local as NEXT_PUBLIC_GOOGLE_CLIENT_ID.",
    );
  }

  const google = (
    window as unknown as {
      google?: {
        accounts?: {
          oauth2?: {
            initTokenClient: (config: {
              client_id: string;
              scope: string;
              callback: (resp: {
                access_token?: string;
                error?: string;
                error_description?: string;
              }) => void;
            }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
          };
        };
      };
    }
  ).google;

  const oauth2 = google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error("Google Identity Services is not available.");
  }

  return new Promise((resolve, reject) => {
    try {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: `openid email profile ${GOOGLE_SHEETS_SCOPE}`,
        callback: async (response) => {
          if (response.error) {
            reject(
              new Error(
                response.error_description ||
                  response.error ||
                  "Google Sign In was cancelled or failed.",
              ),
            );
            return;
          }
          const accessToken = response.access_token;
          if (!accessToken) {
            reject(new Error("No access token returned from Google."));
            return;
          }

          try {
            // Fetch verified user profile using Google's userinfo endpoint
            const res = await fetch(
              "https://www.googleapis.com/oauth2/v3/userinfo",
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              },
            );
            if (!res.ok) {
              throw new Error("Could not retrieve Google profile details.");
            }
            const info = await res.json();
            const user = {
              email: (info.email || "").toLowerCase().trim(),
              name: info.name,
              picture: info.picture,
            };

            cachedAccessToken = accessToken;
            cachedUser = user;

            if (typeof window !== "undefined") {
              localStorage.setItem("ch_google_token", accessToken);
              localStorage.setItem("ch_google_user", JSON.stringify(user));
            }

            resolve({ user, accessToken });
          } catch (err) {
            reject(err);
          }
        },
      });

      client.requestAccessToken({ prompt: "select_account" });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Get current in-memory cached access token
 */
export async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken) return cachedAccessToken;
  if (typeof window !== "undefined") {
    return localStorage.getItem("ch_google_token");
  }
  return null;
}

/**
 * Sign out and clear Google OAuth tokens
 */
export async function logoutGoogle(): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.removeItem("ch_google_token");
    localStorage.removeItem("ch_google_user");
  }
  cachedAccessToken = null;
  cachedUser = null;
}
