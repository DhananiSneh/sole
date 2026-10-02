export function intake(lead, now = new Date(), line = "service") {
  const text = String(lead || "").trim();
  if (!text) throw new Error("The company needs a lead");
  return {
    id: now.toISOString().replace(/[:.]/g, "-"),
    lead: text,
    title: firstSentence(text),
    budget: findBudget(text),
    due: findDue(text),
    billing: findBilling(text),
    line: line === "product" ? "product" : "service",
    openedAt: now.toISOString(),
  };
}

function firstSentence(text) {
  const sentence = text.split(/(?<=[.?!])\s/)[0].trim();
  return sentence.length > 90 ? sentence.slice(0, 87) + "..." : sentence;
}

function findBudget(text) {
  const match = text.match(/(?:₹|inr|rs\.?)\s*[\d,]+|[\d,]+\s*(?:inr|rupees)/i);
  return match ? match[0].replace(/\s+/g, " ") : "Not stated";
}

function findDue(text) {
  const match = text.match(/\bdue\s+([^.\n]*)/i);
  return match ? match[1].trim() : "Not stated";
}

function findBilling(text) {
  return /\b(a month|per month|monthly|\/month)\b/i.test(text) ? "Monthly" : "Once";
}
