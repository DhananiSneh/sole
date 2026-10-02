import { escapeHtml, leadNeedle } from "./page.js";

export function review({ lead, offer, page, invoice }) {
  const paper = lead.line === "product" ? "spec" : "offer";
  const bill = lead.line === "product" ? "price sheet" : "invoice";
  const checks = [
    ["The brief is on the page", page.includes(leadNeedle(lead))],
    ["The page is a complete document", /<!doctype html>/i.test(page) && /<title>/i.test(page)],
    [`The ${paper} has a scope`, listOk(offer.scope)],
    [`The ${paper} names what is outside the work`, listOk(offer.outOfScope)],
    [`The ${bill} matches the price`, invoice.total === offer.price && offer.price.length > 0],
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
