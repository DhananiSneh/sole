import { buildPage } from "./page.js";
import { policy } from "./policy.js";

export function localTeams() {
  return {
    name: "local",
    sales: {
      async qualify(lead) {
        const blocked = policy(lead);
        if (blocked) return blocked;
        if (lead.line === "product") {
          return { fit: true, reason: "The brief names a product this company can ship." };
        }
        return { fit: true, reason: "The lead names client work Sales can price." };
      },
      async offer(lead) {
        const price = lead.budget === "Not stated" ? (lead.line === "product" ? "Set a price" : "Quote on request") : lead.budget;
        if (lead.line === "product") {
          return {
            summary: lead.title,
            scope: [
              `Version one of: ${lead.title}`,
              "The brief quoted on the product page",
              "A customer price in the same folder",
            ],
            outOfScope: [
              "Features the brief did not name",
              "A sales team, and changes after the founder ships",
            ],
            price,
          };
        }
        return {
          summary: lead.title,
          scope: [
            `The client system named in the lead: ${lead.title}`,
            "The lead quoted on the delivery page",
            "This offer and a client invoice",
          ],
          outOfScope: [
            "Work the lead did not ask for",
            "Hosting, a domain, and changes after handover",
          ],
          price,
        };
      },
    },
    studio: {
      async build(lead, offer) {
        return buildPage(lead, offer);
      },
    },
    books: {
      async invoice(lead, offer) {
        return {
          number: `INV-${lead.id}`,
          line: offer.summary,
          total: offer.price,
          note: lead.line === "product" ? "Customers pay this when the founder ships." : "Payable when the founder sends the folder.",
        };
      },
    },
  };
}
