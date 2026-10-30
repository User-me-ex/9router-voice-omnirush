import { DefaultExecutor } from "./default.js";

/**
 * OmniRush speaks the OpenAI Responses API but requires stream=true, store=false,
 * and an input array. Chat-format clients are translated to that shape already;
 * responses-format clients are normalized here.
 */
export class OmniRushExecutor extends DefaultExecutor {
  constructor() {
    super("omnirush");
  }

  transformRequest(model, body) {
    const transformed = super.transformRequest(model, body);
    if (!transformed || typeof transformed !== "object") return transformed;

    let input = transformed.input;
    if (typeof input === "string") {
      input = [{ role: "user", content: [{ type: "input_text", text: input }] }];
    }

    return {
      ...transformed,
      ...(input !== undefined ? { input } : {}),
      stream: true,
      store: false,
    };
  }
}
