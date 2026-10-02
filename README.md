# Sole

![Five teams](images/preview.png)

One person runs the company. Five teams take a lead from the first reading through to a folder you can send.

| Team | What it does |
| --- | --- |
| Desk | Opens the lead and writes the handover |
| Sales | Decides if the work fits, then writes the offer |
| Studio | Builds the one-page site |
| Books | Writes the invoice for the offer price |
| Review | Checks the folder. Review can hold it |

You bring the lead. You send the folder. The teams do the work in between.

The studio ships three things for that lead: a written offer, a one-page website, and an invoice. A stated budget stays the price. Work asked for at no charge is declined before anyone builds.

Review does not ask the team that wrote the page whether the page is good. The checks are in code. If the page drops the lead, or the invoice changes the price, the folder is held.

## Run it

```bash
node src/cli.js "A bakery needs a one-page website. Budget 40000 INR. Due Friday."
```

That uses the local teams, so it runs with no key. The folder appears under `deliveries/`:

```text
01-lead.md
02-qualify.md
03-offer.md
04-review.md
05-invoice.md
06-handover.md
site/index.html
```

To have Grok run Sales, Studio, and Books, create a key at [console.x.ai](https://console.x.ai) and set it in the same terminal:

```bash
set XAI_API_KEY=your_key
node src/cli.js "A bakery needs a one-page website. Budget 40000 INR. Due Friday."
```

The model is `grok-4.7` on `https://api.x.ai/v1`. The key stays on your machine. It is not written into the repository. Desk and Review stay in code either way.

## Test

```bash
npm test
```

## Author

[Sneh Dhanani](https://github.com/DhananiSneh) · [snehdhanani1@gmail.com](mailto:snehdhanani1@gmail.com)
