import { OMNIRUSH_CLIENT_HEADER, OMNIRUSH_CLIENT_VERSION } from "../../config/omnirush.js";

export default {
  id: "omnirush",
  priority: 26,
  alias: "omni",
  uiAlias: "omni",
  display: {
    name: "OmniRush",
    icon: "bolt",
    color: "#F97316",
    textIcon: "OR",
    website: "https://omnirush.ai",
    notice: {
      text: "Device-code login. Requests use OmniRush's Responses API with the official CLI client identity.",
      signupUrl: "https://omnirush.ai/console",
    },
  },
  category: "oauth",
  authType: "oauth",
  authModes: ["oauth"],
  hasOAuth: true,
  authHint: "Sign in with the device code at https://omnirush.ai/console",
  transport: {
    baseUrl: "https://omnirush.ai/omnirush/v1/responses",
    format: "openai-responses",
    forceStream: true,
    headers: {
      "User-Agent": "omnirush",
      "X-OmniRush-Client": OMNIRUSH_CLIENT_HEADER,
    },
    timeoutMs: 300000,
    stallTimeoutMs: 300000,
  },
  models: [
    {
      id: "gpt-6-astra",
      name: "GPT 6 Astra",
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 400000,
      maxOutputTokens: 128000,
    },
    {
      id: "gpt-6.1-sol",
      name: "GPT 6.1 Sol",
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 400000,
      maxOutputTokens: 128000,
    },
    {
      id: "gpt-6-sol",
      name: "GPT 6 Sol",
      reasoning: true,
      input: ["text", "image"],
      contextWindow: 400000,
      maxOutputTokens: 128000,
    },
  ],
  oauth: {
    deviceAuthorizeUrl: "https://omnirush.ai/omnirush/device/authorize",
    deviceTokenUrl: "https://omnirush.ai/omnirush/device/token",
    refreshUrl: "https://omnirush.ai/omnirush/device/refresh",
    userInfoUrl: "https://omnirush.ai/omnirush/device/me",
    loginUrl: "https://omnirush.ai/console",
    clientVersion: OMNIRUSH_CLIENT_VERSION,
    refreshLeadMs: 120000,
  },
  features: {
    usage: false,
  },
};
