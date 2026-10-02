export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function leadNeedle(lead) {
  return escapeHtml(lead.lead.slice(0, 80));
}

export function buildPage(lead, offer) {
  const scope = offer.scope.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const outside = offer.outOfScope.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(offer.summary)}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #14110e;
      color: #f4ecdf;
      font: 18px/1.5 Georgia, "Iowan Old Style", serif;
    }
    main { max-width: 720px; margin: 0 auto; padding: 64px 24px 96px; }
    .eyebrow {
      letter-spacing: 0.16em;
      text-transform: uppercase;
      font: 12px/1 ui-sans-serif, system-ui, sans-serif;
      color: #d4894a;
    }
    h1 { font-size: 48px; line-height: 1.05; font-weight: 500; margin: 12px 0 24px; }
    blockquote {
      margin: 0 0 36px;
      padding-left: 16px;
      border-left: 2px solid #d4894a;
      color: #d9cbb8;
    }
    h2 {
      font: 13px/1 ui-sans-serif, system-ui, sans-serif;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #b7aa98;
      margin: 32px 0 8px;
    }
    ul { margin: 0; padding-left: 18px; }
    .price { font-size: 32px; margin: 8px 0; }
    footer { margin-top: 48px; color: #b7aa98; font: 14px/1.4 ui-sans-serif, system-ui, sans-serif; }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Prepared for you</p>
    <h1>${escapeHtml(offer.summary)}</h1>
    <blockquote>${escapeHtml(lead.lead)}</blockquote>
    <h2>Scope</h2>
    <ul>${scope}</ul>
    <h2>Outside this work</h2>
    <ul>${outside}</ul>
    <h2>Price</h2>
    <p class="price">${escapeHtml(offer.price)}</p>
    <p>Due ${escapeHtml(lead.due)}.</p>
    <footer>Studio built this page. The founder sends it.</footer>
  </main>
</body>
</html>
`;
}
