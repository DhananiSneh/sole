import { policy } from "./policy.js";

const ENDPOINT = "https://api.x.ai/v1/responses";
const MODEL = "grok-4.7";

const SCHEMAS = {
  qualify: {
    type: "object",
    additionalProperties: false,
    required: ["fit", "reason"],
    properties: {
      fit: { type: "boolean" },
      reason: { type: "string" },
    },
  },
  offer: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "scope", "outOfScope", "price"],
    properties: {
      summary: { type: "string" },
      scope: { type: "array", items: { type: "string" } },
      outOfScope: { type: "array", items: { type: "string" } },
      price: { type: "string" },
    },
  },
  page: {
    type: "object",
    additionalProperties: false,
    required: ["html"],
    properties: { html: { type: "string" } },
  },
  invoice: {
    type: "object",
    additionalProperties: false,
    required: ["line", "total", "note"],
    properties: {
      line: { type: "string" },
      total: { type: "string" },
      note: { type: "string" },
    },
  },
};

export function createGrokTeams(apiKey = process.env.XAI_API_KEY, fetchImpl = globalThis.fetch) {
  if (!apiKey) throw new Error("XAI_API_KEY is missing");

  async function ask(name, system, user) {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        text: { format: { type: "json_schema", name, strict: true, schema: SCHEMAS[name] } },
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`SpaceXAI returned ${response.status}: ${detail.slice(0, 200)}`);
    }
    const body = await response.json();
    const pack = JSON.parse(extractJson(outputText(body)));
    if (!pack || typeof pack !== "object") throw new Error(`SpaceXAI returned an empty ${name}`);
    return pack;
  }

  return {
    name: "grok",
    sales: {
      async qualify(lead) {
        const blocked = policy(lead);
        if (blocked) return blocked;
        const system = lead.line === "product"
          ? "You are Product at Sole, an IT company. This is the company's own software, not client work. Fit means Sole should ship it as a product. Decline briefs that are not software."
          : "You are Sales at Sole, an IT company. This is service work for a client. Fit means the client wants software Sole can deliver. Decline work that is not software.";
        const pack = await ask("qualify", system, lead.lead);
        if (typeof pack.fit !== "boolean" || typeof pack.reason !== "string") {
          throw new Error("The team did not return a decision");
        }
        return { fit: pack.fit, reason: pack.reason.trim() || "The team made a decision." };
      },
      async offer(lead) {
        const fallback = lead.line === "product" ? "Set a price" : "Quote on request";
        const price = lead.budget === "Not stated" ? fallback : lead.budget;
        const system = lead.line === "product"
          ? `You are Product at Sole. Write the version-one spec. price must be exactly ${JSON.stringify(price)}. scope is what ships now. outOfScope is what waits. Quote no other number.`
          : `You are Sales at Sole. Write the client offer for this IT engagement. price must be exactly ${JSON.stringify(price)}. scope and outOfScope are short lists. Quote no other number.`;
        const pack = await ask(
          "offer",
          system,
          `Brief:\n${lead.lead}\n\nPrice to use: ${price}`,
        );
        return { ...pack, price };
      },
    },
    studio: {
      async build(lead, offer) {
        const system = lead.line === "product"
          ? "You are Engineering at Sole, an IT product company. Return one complete HTML document in the html field. This page is the product. Quote the brief verbatim. Show the version-one scope, what is later, and the customer price exactly. No external images, fonts, or scripts."
          : "You are Delivery at Sole, an IT services company. Return one complete HTML document in the html field. This page is the client delivery. Quote the lead verbatim. Show the scope, what is outside the work, and the price exactly. No external images, fonts, or scripts.";
        const pack = await ask(
          "page",
          system,
          `Brief:\n${lead.lead}\n\nSummary: ${offer.summary}\nPrice: ${offer.price}\nScope:\n- ${offer.scope.join("\n- ")}\nOutside:\n- ${offer.outOfScope.join("\n- ")}`,
        );
        if (typeof pack.html !== "string" || !pack.html.trim()) throw new Error("The build team returned an empty page");
        return pack.html;
      },
    },
    books: {
      async invoice(lead, offer) {
        const system = lead.line === "product"
          ? `You are Accounts at Sole. Write the customer price line and a one-sentence note. total must be exactly ${JSON.stringify(offer.price)}.`
          : `You are Accounts at Sole. Write the client invoice line and a one-sentence note. total must be exactly ${JSON.stringify(offer.price)}.`;
        const pack = await ask(
          "invoice",
          system,
          `Work: ${offer.summary}\nPrice: ${offer.price}\nDue: ${lead.due}\nBilling: ${lead.billing}`,
        );
        return {
          number: `INV-${lead.id}`,
          line: String(pack.line || offer.summary),
          total: String(pack.total || ""),
          note: String(pack.note || ""),
        };
      },
    },
  };
}

export function outputText(body) {
  if (typeof body.output_text === "string" && body.output_text) return body.output_text;
  const parts = [];
  for (const item of body.output || []) {
    for (const block of item.content || []) {
      if (typeof block.text === "string") parts.push(block.text);
    }
  }
  if (!parts.length) throw new Error("SpaceXAI returned no text");
  return parts.join("\n");
}

export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("SpaceXAI did not return JSON");
  return raw.slice(start, end + 1);
}
