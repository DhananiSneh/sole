import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { intake } from "./intake.js";
import { review } from "./review.js";

export async function runCompany(leadText, { teams, root = "deliveries", now, line = "service" } = {}) {
  const lead = intake(leadText, now, line);
  const roles = rolesFor(lead.line);
  const dir = path.join(root, lead.id);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "01-lead.md"), openNote(lead));

  const qualification = await teams.sales.qualify(lead);
  await writeFile(path.join(dir, "02-qualify.md"), qualifyNote(lead, qualification, roles));

  if (!qualification.fit) {
    await writeFile(path.join(dir, "06-handover.md"), declinedNote(lead, qualification, roles));
    return { status: "declined", lead, qualification, dir };
  }

  const offer = lockOffer(lead, await teams.sales.offer(lead, qualification));
  await writeFile(path.join(dir, roles.paperFile), paperNote(lead, offer, roles));

  const page = await teams.studio.build(lead, offer);
  await mkdir(path.join(dir, "site"), { recursive: true });
  await writeFile(path.join(dir, "site", "index.html"), page);

  const invoice = normalizeInvoice(lead, offer, await teams.books.invoice(lead, offer));
  await writeFile(path.join(dir, roles.billFile), billNote(lead, invoice, roles));

  const verdict = review({ lead, offer, page, invoice });
  await writeFile(path.join(dir, "04-review.md"), reviewNote(lead, verdict));
  await writeFile(path.join(dir, "06-handover.md"), handoverNote(lead, verdict, roles));

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

function rolesFor(line) {
  if (line === "product") {
    return {
      opener: "Product",
      builder: "Engineering",
      money: "Accounts",
      paper: "spec",
      paperFile: "03-spec.md",
      bill: "price",
      billFile: "05-price.md",
    };
  }
  return {
    opener: "Sales",
    builder: "Delivery",
    money: "Accounts",
    paper: "offer",
    paperFile: "03-offer.md",
    bill: "invoice",
    billFile: "05-invoice.md",
  };
}

function lockOffer(lead, offer) {
  const fallback = lead.line === "product" ? "Set a price" : "Quote on request";
  const price = lead.budget !== "Not stated" ? lead.budget : clean(offer.price) || fallback;
  return {
    summary: clean(offer.summary) || lead.title,
    scope: asList(offer.scope),
    outOfScope: asList(offer.outOfScope),
    price,
  };
}

function normalizeInvoice(lead, offer, invoice) {
  const prefix = lead.line === "product" ? "PRICE" : "INV";
  return {
    number: `${prefix}-${lead.id}`,
    line: clean(invoice.line) || offer.summary,
    total: clean(invoice.total),
    note: clean(invoice.note) || (lead.line === "product"
      ? "Customers pay this when the founder ships."
      : "Payable when the founder sends the folder."),
  };
}

function asList(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => String(item).trim()).filter(Boolean);
}

function clean(value) {
  return String(value || "").trim();
}

function openNote(lead) {
  const title = lead.line === "product" ? "Brief" : "Lead";
  const line = lead.line === "product" ? "Product" : "Service";
  return `# ${title}\n\nLine: ${line}\n\nOpened: ${lead.openedAt}\n\n${lead.lead}\n\nTeam: Desk\n`;
}

function qualifyNote(lead, qualification, roles) {
  return `# Qualify\n\nLine: ${lead.line === "product" ? "Product" : "Service"}\n\nFit: ${qualification.fit ? "yes" : "no"}\n\n${qualification.reason}\n\nTeam: ${roles.opener}\n`;
}

function declinedNote(lead, qualification, roles) {
  if (lead.line === "product") {
    return `# Handover\n\n${roles.opener} declined this brief.\n\n${qualification.reason}\n\nThe founder does not ship this.\n`;
  }
  return `# Handover\n\n${roles.opener} declined this lead.\n\n${qualification.reason}\n\nThe founder does not send a proposal.\n`;
}

function paperNote(lead, offer, roles) {
  const scope = offer.scope.map((item) => `- ${item}`).join("\n");
  const outside = offer.outOfScope.map((item) => `- ${item}`).join("\n");
  if (lead.line === "product") {
    return `# Spec\n\n## What we are shipping\n\n${lead.lead}\n\n## Version one\n\n${offer.summary}\n\n## In this version\n\n${scope}\n\n## Later\n\n${outside}\n\n## Price\n\n${offer.price}\n\nTeam: ${roles.opener}\n`;
  }
  return `# Offer\n\n## What was asked\n\n${lead.lead}\n\n## What you get\n\n${offer.summary}\n\n## Scope\n\n${scope}\n\n## Out of scope\n\n${outside}\n\n## Price\n\n${offer.price}\n\nTeam: ${roles.opener}\n`;
}

function billNote(lead, invoice, roles) {
  if (lead.line === "product") {
    return `# Price\n\nCode: ${invoice.number}\n\n- ${invoice.line} — ${invoice.total}\n\nPrice: ${invoice.total}\n\nBilling: ${lead.billing}\n\n${invoice.note}\n\nTeam: ${roles.money}\n`;
  }
  return `# Invoice\n\nNumber: ${invoice.number}\n\n- ${invoice.line} — ${invoice.total}\n\nTotal: ${invoice.total}\n\nDue: ${lead.due}\n\n${invoice.note}\n\nTeam: ${roles.money}\n`;
}

function reviewNote(lead, verdict) {
  const lines = verdict.checks.map((check) => `- [${check.ok ? "x" : " "}] ${check.name}`);
  const head = verdict.passed
    ? (lead.line === "product" ? "Passed. Ready to ship." : "Passed. Ready to send.")
    : (lead.line === "product" ? "Held. Do not ship this yet." : "Held. Do not send this yet.");
  return `# Review\n\n${head}\n\n${lines.join("\n")}\n\nTeam: Review\n`;
}

function handoverNote(lead, verdict, roles) {
  const line = verdict.passed
    ? (lead.line === "product"
      ? "Review passed. The founder can ship this folder: the spec, the product, and the price."
      : "Review passed. The founder can send this folder: the offer, the page, and the invoice.")
    : (lead.line === "product"
      ? "Review held this folder. The founder does not ship it."
      : "Review held this folder. The founder does not send it.");
  const who = lead.line === "product"
    ? `Desk recorded the brief. ${roles.opener} wrote the spec. ${roles.builder} built the product. ${roles.money} wrote the price. Review checked the folder.`
    : `Desk recorded the lead. ${roles.opener} wrote the offer. ${roles.builder} built the work. ${roles.money} wrote the invoice. Review checked the folder.`;
  return `# Handover\n\n${line}\n\n${who}\n`;
}
