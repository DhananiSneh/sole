import { runCompany } from "./company.js";
import { createGrokTeams } from "./grok-teams.js";
import { localTeams } from "./local-teams.js";

const lead = process.argv.slice(2).join(" ").trim();
if (!lead) {
  console.error('Give Sole a lead. Example: node src/cli.js "A bakery needs a one-page website. Budget 40000 INR. Due Friday."');
  process.exit(1);
}

const grok = Boolean(process.env.XAI_API_KEY);
const result = await runCompany(lead, { teams: grok ? createGrokTeams() : localTeams() });
console.log(grok ? "Sales, Studio, and Books are Grok." : "Sales, Studio, and Books are the local teams.");
if (result.status === "declined") {
  console.log(`Sales declined ${result.lead.id}`);
  console.log(result.qualification.reason);
} else if (result.status === "sent") {
  console.log(`Review passed ${result.lead.id}`);
  console.log("The founder can send the folder.");
} else {
  console.log(`Review held ${result.lead.id}`);
  process.exitCode = 2;
}
console.log(result.dir);
