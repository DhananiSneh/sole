import { buildPage } from "./page.js";
import { policy } from "./policy.js";

export function localTeams() {
  return {
    name: "local",
    sales: {
      async qualify(lead) {
        return policy(lead) ?? { fit: true, reason: "The lead names a piece of work Sales can price." };
      },
      async offer(lead) {
        return {
          summary: lead.title,
          scope: [
            `A one-page website for: ${lead.title}`,
            "The lead quoted on that page",
            "This offer and an invoice in the same folder",
          ],
          outOfScope: [
            "Work the lead did not ask for",
            "A domain, hosting, and changes after handover",
          ],
          price: lead.budget === "Not stated" ? "Quote on request" : lead.budget,
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
          note: "Payable when the founder sends the folder.",
        };
      },
    },
  };
}
