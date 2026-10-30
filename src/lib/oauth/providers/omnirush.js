import { OMNIRUSH_CONFIG } from "../constants/oauth.js";
import { OMNIRUSH_CLIENT_VERSION, omnirushUserAgent } from "open-sse/config/omnirush.js";

const CLIENT_VERSION = OMNIRUSH_CONFIG.clientVersion || OMNIRUSH_CLIENT_VERSION;

// OmniRush's manager only accepts requests from its own clients: the /device
// endpoints expect the CLI-style User-Agent, and model requests expect the
// product UA plus X-OmniRush-Client. See assets/extensions/omnirush/auth.js.
function deviceHeaders(extra = {}) {
  return {
    "content-type": "application/json",
    accept: "application/json",
    "user-agent": omnirushUserAgent(CLIENT_VERSION),
    "x-omnirush-client": `cli/${CLIENT_VERSION}`,
    ...extra,
  };
}

async function readJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

const omnirush = {
  config: OMNIRUSH_CONFIG,
  flowType: "device_code",
  requestDeviceCode: async (config) => {
    const res = await fetch(config.deviceAuthorizeUrl, {
      method: "POST",
      headers: deviceHeaders(),
      body: JSON.stringify({ device_name: "9router", platform: process.platform }),
    });
    const data = await readJson(res);
    if (!res.ok) {
      throw new Error(data?.detail || `OmniRush device authorization failed (${res.status})`);
    }
    return {
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_uri || config.loginUrl,
      verification_uri_complete: data.verification_uri_complete,
      expires_in: data.expires_in,
      interval: data.interval || 5,
    };
  },
  pollToken: async (config, deviceCode) => {
    const res = await fetch(config.deviceTokenUrl, {
      method: "POST",
      headers: deviceHeaders(),
      body: JSON.stringify({ device_code: deviceCode }),
    });
    const data = await readJson(res);

    if (res.status === 428 || data?.detail === "authorization_pending") {
      return { ok: false, data: { error: "authorization_pending" } };
    }
    if (data?.detail === "slow_down") {
      return { ok: false, data: { error: "slow_down" } };
    }
    if (!res.ok || !data?.access_token) {
      return {
        ok: false,
        data: {
          error: data?.detail || "token_request_failed",
          error_description: data?.detail,
        },
      };
    }

    let me = null;
    try {
      const meRes = await fetch(config.userInfoUrl, {
        headers: deviceHeaders({ authorization: `Bearer ${data.access_token}` }),
      });
      if (meRes.ok) me = await readJson(meRes);
    } catch {
      // Identity is best-effort; the token is what matters.
    }

    return {
      ok: true,
      data: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: typeof data.expires_in === "number" && data.expires_in > 0 ? data.expires_in : 3600,
        _omnirushEmail: me?.email || "",
        _omnirushName: me?.display_name || "",
        _omnirushUserId: me?.id || "",
        _omnirushGatewayUrl: data.gateway_url || "",
      },
    };
  },
  mapTokens: (tokens) => {
    const email = (tokens._omnirushEmail || "").trim() || null;
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresIn: tokens.expires_in,
      email,
      displayName: (tokens._omnirushName || "").trim() || email,
      providerSpecificData: {
        authMethod: "device",
        userId: tokens._omnirushUserId || "",
        gatewayUrl: tokens._omnirushGatewayUrl || "",
        clientVersion: CLIENT_VERSION,
      },
    };
  },
};

export default omnirush;
