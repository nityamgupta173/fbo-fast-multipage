# FedEx FAST (multi-page)

A multi-page version of the FedEx FAST (Funds Allocation and Settlement Tool) demo. Pure static HTML/CSS/JS, so there is no build step.

| Page | URL | Purpose |
|---|---|---|
| Sign in | `index.html` | Enter any account number |
| Allocate Funds | `dashboard.html` | Pick an EFT payment, select invoices, Smart Match, TDS / partial amounts |
| Make a Payment | `make-payment.html` | FBO, QR code and Import Tool options |
| Disputes | `disputes.html` | Invoices under inquiry after partial payments |
| Add My Payment | `add-payment.html` | Add a payment by transaction ID |
| Confirmation | `success.html` | Allocation receipt |

State (payments, invoices, disputes) is kept in `sessionStorage` (`js/store.js`) so it carries across pages.

## Google Analytics 4 setup

1. In GA4: **Admin → Data streams → Add stream → Web**. Enter your site URL (e.g. your Vercel / GitHub Pages URL) and copy the **Measurement ID** (`G-XXXXXXXXXX`).
2. Replace `G-XXXXXXXXXX` in all 6 HTML files (it appears twice per file):
   ```bash
   sed -i 's/G-XXXXXXXXXX/G-YOURID123/g' *.html
   ```
3. Deploy, then open **Reports → Realtime** and browse the site. Every HTML file sends its own `page_view` with its own `<title>`.

Note that GA4 only receives data from a **deployed, publicly reachable** site, or from `localhost` while you test. It doesn't track opening the file from disk (`file://`). Realtime can take a minute to show hits, and ad blockers will hide them.

### Custom events (`track()` in `js/store.js`)

`login`, `logout`, `switch_account_view`, `smart_match`, `bulk_csv_upload`, `allocate_funds`, `add_payment`, `qr_learn_more`, `outbound_fbo`, `outbound_import_tool`, `promo_switch_dashboard`.

Mark `allocate_funds` as a key event in GA4 (**Admin → Events**) to practise with conversions.

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000
```
