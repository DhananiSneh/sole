import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { intake } from "./intake.js";
import { review } from "./review.js";

export async function runCompany(leadText, { teams, root = "deliveries", now } = {}) {
  const lead = intake(leadText, now);
  const dir = path.join(root, lead.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "01-lead.md"), `# Lead\n\nOpened: ${lead.openedAt}\n\n${lead.lead}\n\nTeam: Desk\n`);

  const qualification = await teams.sales.qualify(lead);
  await writeFile(path.join(dir, "02-qualify.md"), qualifyNote(qualification));

  if (!qualification.fit) {
    const handover = `# Handover\n\nSales declined this lead.\n\n${qualification.reason}\n\nThe founder does not send a proposal.\n`;
    await writeFile(path.join(dir, "06-handover.md"), handover);
    return { status: "declined", lead, qualification, dir };
  }

  const offer = lockOffer(lead, await teams.sales.offer(lead, qualification));
  await writeFile(path.join(dir, "03-offer.md"), offerNote(lead, offer));

  const page = await teams.studio.build(lead, offer);
  await mkdir(path.join(dir, "site"), { recursive: true });
  await writeFile(path.join(dir, "site", "index.html"), page);

  const invoice = normalizeInvoice(lead, offer, await teams.books.invoice(lead, offer));
  await writeFile(path.join(dir, "05-invoice.md"), invoiceNote(lead, invoice));

  const verdict = review({ lead, offer, page, invoice });
  await writeFile(path.join(dir, "04-review.md"), reviewNote(verdict));
  await writeFile(path.join(dir, "06-handover.md"), handoverNote(verdict));

  return {
    status: verdict.passed ? "sent" : "held",
    lead,
    qualification,
    offer,
    invoice,
    review: verdict,
    dir,
  };
}

function lockOffer(lead, offer) {
  const price = lead.budget !== "Not stated" ? lead.budget : clean(offer.price) || "Quote on request";
  return {
    summary: clean(offer.summary) || lead.title,
    scope: asList(offer.scope),
    outOfScope: asList(offer.outOfScope),
    price,
  };
}

function normalizeInvoice(lead, offer, invoice) {
  return {
    number: `INV-${lead.id}`,
    line: clean(invoice.line) || offer.summary,
    total: clean(invoice.total),
    note: clean(invoice.note) || "Payable when the founder sends the folder.",
  };
}

function asList(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => String(item).trim()).filter(Boolean);
}

function clean(value) {
  return String(value || "").trim();
}

function qualifyNote(qualification) {
  return `# Qualify\n\nFit: ${qualification.fit ? "yes" : "no"}\n\n${qualification.reason}\n\nTeam: Sales\n`;
}

function offerNote(lead, offer) {
  const scope = offer.scope.map((item) => `- ${item}`).join("\n");
  const outside = offer.outOfScope.map((item) => `- ${item}`).join("\n");
  return `# Offer\n\n## What was asked\n\n${lead.lead}\n\n## What you get\n\n${offer.summary}\n\n## Scope\n\n${scope}\n\n## Out of scope\n\n${outside}\n\n## Price\n\n${offer.price}\n\nTeam: Sales\n`;
}

function invoiceNote(lead, invoice) {
  return `# Invoice\n\nNumber: ${invoice.number}\n\n- ${invoice.line} — ${invoice.total}\n\nTotal: ${invoice.total}\n\nDue: ${lead.due}\n\n${invoice.note}\n\nTeam: Books\n`;
}

function reviewNote(verdict) {
  const lines = verdict.checks.map((check) => `- [${check.ok ? "x" : " "}] ${check.name}`);
  const head = verdict.passed ? "Passed. Ready to send." : "Held. Do not send this yet.";
  return `# Review\n\n${head}\n\n${lines.join("\n")}\n\nTeam: Review\n`;
}

function handoverNote(verdict) {
  const line = verdict.passed
    ? "Review passed. The founder can send this folder: the offer, the page, and the invoice."
    : "Review held this folder. The founder does not send it.";
  return `# Handover\n\n${line}\n\nDesk recorded the lead. Sales wrote the offer. Studio built the page. Books wrote the invoice. Review checked the folder.\n`;
}
