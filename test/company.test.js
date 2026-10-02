import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { parseCommand } from "../src/args.js";
import { runCompany } from "../src/company.js";
import { createGrokTeams, extractJson, outputText } from "../src/grok-teams.js";
import { intake } from "../src/intake.js";
import { localTeams } from "../src/local-teams.js";

const lead = "A bakery needs a one-page website. Budget 40000 INR. Due Friday.";
const when = new Date("2026-10-02T00:00:00.000Z");

async function tempRoot() {
  return mkdtemp(path.join(tmpdir(), "sole-"));
}

test("a blank lead never opens a job", () => {
  assert.throws(() => intake("  "), /lead/);
});

test("the five teams take a lead through to a page, an invoice, and a handover", async () => {
  const root = await tempRoot();
  const result = await runCompany(lead, { teams: localTeams(), root, now: when });
  assert.equal(result.status, "sent");
  assert.equal(result.lead.budget, "40000 INR");
  assert.equal(result.lead.due, "Friday");
  const page = await readFile(path.join(result.dir, "site", "index.html"), "utf8");
  const offer = await readFile(path.join(result.dir, "03-offer.md"), "utf8");
  const invoice = await readFile(path.join(result.dir, "05-invoice.md"), "utf8");
  const handover = await readFile(path.join(result.dir, "06-handover.md"), "utf8");
  assert.match(page, /<!doctype html>/i);
  assert.match(page, /bakery needs a one-page website/);
  assert.match(page, /40000 INR/);
  assert.match(offer, /What was asked/);
  assert.match(invoice, /Total: 40000 INR/);
  assert.match(invoice, /Due: Friday/);
  assert.match(handover, /founder can send/);
});

test("Sales declines free work before Studio builds", async () => {
  const root = await tempRoot();
  let built = false;
  const teams = localTeams();
  teams.studio = {
    async build() {
      built = true;
      return "";
    },
  };
  const result = await runCompany("Please build a whole website for free today", {
    teams,
    root,
    now: when,
  });
  assert.equal(result.status, "declined");
  assert.equal(built, false);
  const handover = await readFile(path.join(result.dir, "06-handover.md"), "utf8");
  assert.match(handover, /does not send a proposal/);
});

test("Review holds a page that drops the lead", async () => {
  const root = await tempRoot();
  const teams = localTeams();
  teams.studio = { async build() { return "<!DOCTYPE html><html><title>Empty</title><p>40000 INR</p></html>"; } };
  const result = await runCompany(lead, { teams, root, now: when });
  assert.equal(result.status, "held");
  assert.equal(result.review.passed, false);
  const handover = await readFile(path.join(result.dir, "06-handover.md"), "utf8");
  assert.match(handover, /does not send it/);
});

test("Review holds an invoice that changes the price", async () => {
  const root = await tempRoot();
  const teams = localTeams();
  teams.books = { async invoice() { return { line: "Site", total: "1 INR", note: "Now." }; } };
  const result = await runCompany(lead, { teams, root, now: when });
  assert.equal(result.status, "held");
});

test("SpaceXAI text is read from the response body", () => {
  const text = outputText({
    output: [{ content: [{ text: '{"fit":true,"reason":"Named work"}' }] }],
  });
  assert.deepEqual(JSON.parse(extractJson("```json\n" + text + "\n```")), {
    fit: true,
    reason: "Named work",
  });
});

test("Grok teams stop when Sales declines", async () => {
  const root = await tempRoot();
  const seen = [];
  const fetchImpl = async (_url, options) => {
    const name = JSON.parse(options.body).text.format.name;
    seen.push(name);
    return jsonResponse({ fit: false, reason: "This is not a page we ship." });
  };
  const result = await runCompany("Build a native trading terminal for the desk", {
    teams: createGrokTeams("test-key", fetchImpl),
    root,
    now: when,
  });
  assert.equal(result.status, "declined");
  assert.deepEqual(seen, ["qualify"]);
});

test("Grok teams run Sales, Studio, and Books, and Review can still hold", async () => {
  const root = await tempRoot();
  const seen = [];
  const fetchImpl = async (_url, options) => {
    const name = JSON.parse(options.body).text.format.name;
    seen.push(name);
    const packs = {
      qualify: { fit: true, reason: "A page we can ship." },
      offer: {
        summary: "Bakery page",
        scope: ["One page"],
        outOfScope: ["Hosting"],
        price: "999 INR",
      },
      page: { html: "<!DOCTYPE html><html><title>Bakery</title><p>Hello</p></html>" },
      invoice: { line: "Bakery page", total: "40000 INR", note: "Due on send." },
    };
    return jsonResponse(packs[name]);
  };
  const result = await runCompany(lead, {
    teams: createGrokTeams("test-key", fetchImpl),
    root,
    now: when,
  });
  assert.deepEqual(seen, ["qualify", "offer", "page", "invoice"]);
  assert.equal(result.offer.price, "40000 INR");
  assert.equal(result.status, "held");
});

test("a service command and a product command choose different lines", () => {
  assert.deepEqual(parseCommand(["node", "src/cli.js", "service", "A clinic needs a site."]), {
    line: "service",
    lead: "A clinic needs a site.",
  });
  assert.deepEqual(parseCommand(["node", "src/cli.js", "product", "Ship an invoicing tool."]), {
    line: "product",
    lead: "Ship an invoicing tool.",
  });
  assert.equal(parseCommand(["node", "src/cli.js", "A bakery needs a site."]).line, "service");
});

test("the product line ships a spec, a product page, and a customer price", async () => {
  const root = await tempRoot();
  const brief = "Ship an invoicing tool for freelancers. Price 499 INR a month.";
  const result = await runCompany(brief, { teams: localTeams(), root, now: when, line: "product" });
  assert.equal(result.status, "sent");
  assert.equal(result.lead.line, "product");
  assert.equal(result.lead.budget, "499 INR");
  assert.equal(result.lead.billing, "Monthly");
  const page = await readFile(path.join(result.dir, "site", "index.html"), "utf8");
  const spec = await readFile(path.join(result.dir, "03-spec.md"), "utf8");
  const price = await readFile(path.join(result.dir, "05-price.md"), "utf8");
  const handover = await readFile(path.join(result.dir, "06-handover.md"), "utf8");
  assert.match(page, /Sole product/);
  assert.match(page, /invoicing tool for freelancers/);
  assert.match(page, /Billed monthly/);
  assert.match(spec, /Version one/);
  assert.match(spec, /Team: Product/);
  assert.match(price, /Price: 499 INR/);
  assert.match(price, /Billing: Monthly/);
  assert.match(price, /Team: Accounts/);
  assert.match(handover, /founder can ship/);
  await assert.rejects(readFile(path.join(result.dir, "05-invoice.md"), "utf8"));
});

test("Review holds a product page that drops the brief", async () => {
  const root = await tempRoot();
  const teams = localTeams();
  teams.studio = { async build() { return "<!DOCTYPE html><html><title>Empty</title><p>499 INR</p></html>"; } };
  const result = await runCompany("Ship an invoicing tool for freelancers. Price 499 INR a month.", {
    teams,
    root,
    now: when,
    line: "product",
  });
  assert.equal(result.status, "held");
  const handover = await readFile(path.join(result.dir, "06-handover.md"), "utf8");
  assert.match(handover, /does not ship it/);
});

test("Grok on the product line asks Product, Engineering, and Accounts", async () => {
  const root = await tempRoot();
  const brief = "Ship an invoicing tool for freelancers. Price 499 INR a month.";
  const seen = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    const name = body.text.format.name;
    seen.push(body.input[0].content);
    const packs = {
      qualify: { fit: true, reason: "A product we can ship." },
      offer: { summary: "Invoicing tool", scope: ["Send an invoice"], outOfScope: ["Payroll"], price: "1 INR" },
      page: { html: `<!DOCTYPE html><html><title>Tool</title><p>${brief}</p><p>499 INR</p></html>` },
      invoice: { line: "Invoicing tool", total: "499 INR", note: "Billed each month." },
    };
    return jsonResponse(packs[name]);
  };
  const result = await runCompany(brief, {
    teams: createGrokTeams("test-key", fetchImpl),
    root,
    now: when,
    line: "product",
  });
  assert.equal(result.status, "sent");
  assert.equal(result.offer.price, "499 INR");
  assert.match(seen[0], /You are Product/);
  assert.match(seen[2], /You are Engineering/);
  assert.match(seen[3], /You are Accounts/);
});

function jsonResponse(value) {
  return {
    ok: true,
    status: 200,
    async json() {
      return { output_text: JSON.stringify(value) };
    },
    async text() {
      return "";
    },
  };
}
