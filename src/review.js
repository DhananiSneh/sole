import { escapeHtml, leadNeedle } from "./page.js";

export function review({ lead, offer, page, invoice }) {
  const checks = [
    ["The lead is on the page", page.includes(leadNeedle(lead))],
    ["The page is a complete document", /<!doctype html>/i.test(page) && /<title>/i.test(page)],
    ["The offer has a scope", listOk(offer.scope)],
    ["The offer names what is outside the work", listOk(offer.outOfScope)],
    ["The invoice matches the offer", invoice.total === offer.price && offer.price.length > 0],
    ["The price is on the page", page.includes(escapeHtml(offer.price))],
  ];
  return {
    passed: checks.every(([, ok]) => ok),
    checks: checks.map(([name, ok]) => ({ name, ok })),
  };
}

function listOk(items) {
  return Array.isArray(items) && items.length > 0 && items.every((item) => typeof item === "string" && item.trim());
}
