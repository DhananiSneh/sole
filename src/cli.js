import { parseCommand } from "./args.js";
import { runCompany } from "./company.js";
import { createGrokTeams } from "./grok-teams.js";
import { localTeams } from "./local-teams.js";

const { line, lead } = parseCommand(process.argv);
if (!lead) {
  console.error('Give Sole a lead. Service: node src/cli.js service "A clinic needs a booking site. Budget 80000 INR. Due in 3 weeks."');
  console.error('Product: node src/cli.js product "Ship an invoicing tool for freelancers. Price 499 INR a month."');
  process.exit(1);
}

const grok = Boolean(process.env.XAI_API_KEY);
const result = await runCompany(lead, { teams: grok ? createGrokTeams() : localTeams(), line });
const names = line === "product" ? "Product, Engineering, and Accounts" : "Sales, Delivery, and Accounts";
console.log(grok ? `${names} are Grok.` : `${names} are the local teams.`);
console.log(line === "product" ? "Line: Product" : "Line: Service");
if (result.status === "declined") {
  console.log(`${line === "product" ? "Product" : "Sales"} declined ${result.lead.id}`);
  console.log(result.qualification.reason);
} else if (result.status === "sent") {
  console.log(`Review passed ${result.lead.id}`);
  console.log(line === "product" ? "The founder can ship the folder." : "The founder can send the folder.");
} else {
  console.log(`Review held ${result.lead.id}`);
  process.exitCode = 2;
}
console.log(result.dir);
