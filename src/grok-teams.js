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
        const pack = await ask(
          "qualify",
          "You are Sales at Sole, a one-person studio. The studio delivers a one-page website, a written offer, and an invoice. Decide if this lead is that kind of work. Decline work that is not a page the studio can ship.",
          lead.lead,
        );
        if (typeof pack.fit !== "boolean" || typeof pack.reason !== "string") {
          throw new Error("Sales did not return a decision");
        }
        return { fit: pack.fit, reason: pack.reason.trim() || "Sales made a decision." };
      },
      async offer(lead) {
        const price = lead.budget === "Not stated" ? "Quote on request" : lead.budget;
        const pack = await ask(
          "offer",
          `You are Sales at Sole. Write the offer for a one-page website. price must be exactly ${JSON.stringify(price)}. Quote no other number. scope and outOfScope are short lists.`,
          `Lead:\n${lead.lead}\n\nPrice to use: ${price}`,
        );
        return { ...pack, price };
      },
    },
    studio: {
      async build(lead, offer) {
        const pack = await ask(
          "page",
          "You are Studio at Sole. Return one complete HTML document in the html field. Quote the lead verbatim. Show every scope line, every out-of-scope line, and the price exactly. No external images, fonts, or scripts.",
          `Lead:\n${lead.lead}\n\nSummary: ${offer.summary}\nPrice: ${offer.price}\nScope:\n- ${offer.scope.join("\n- ")}\nOutside:\n- ${offer.outOfScope.join("\n- ")}`,
        );
        if (typeof pack.html !== "string" || !pack.html.trim()) throw new Error("Studio returned an empty page");
        return pack.html;
      },
    },
    books: {
      async invoice(lead, offer) {
        const pack = await ask(
          "invoice",
          `You are Books at Sole. Write the invoice line and a one-sentence note. total must be exactly ${JSON.stringify(offer.price)}.`,
          `Work: ${offer.summary}\nPrice: ${offer.price}\nDue: ${lead.due}`,
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
