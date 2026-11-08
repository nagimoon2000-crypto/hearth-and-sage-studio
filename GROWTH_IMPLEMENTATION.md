# Offer → Leads → Money Model implementation

## Offer and verified scope

The page keeps its original café renders, inventory, support links, compatibility
table and responsive design. It adds outcome-focused copy, an exact-version check
CTA and an availability enquiry for the real Mini Planet collection.

Evidence available in the asset-production workspace (not secret customer data):

- Cozy Café: 40 original meshes, 8,952 triangles, 10 URP materials, 40 prefabs,
  2 Unity scenes; Unity 6000.6.7f1 / URP 17.6.0 and Windows Player tests recorded.
- Mini Planet: 25 original meshes, 7,159 triangles, 12 materials; Unity Editor
  imports and MeshCollider tests passed; Player and Unreal untested.
- On 2026-11-03 the authenticated Fab publisher list showed both products Approved,
  with manual publication. Unity showed both Pending. Local evidence files were
  `reports/fab_status_2026-11-03.png`, `reports/unity_status_2026-11-03.png` and
  `reports/submission_status.json` in the production workspace.
- These are **dated observations**, not a claim that the same status was checked
  today. On 2026-11-08 the public listing URLs could not be verified by the web tool.

No public checkout is configured. `catalog.mjs` is the availability gate. Approval
alone cannot enable a purchase link. A product/provider requires `status: 'published'`,
its real public URL and a `public_verified_at` date. Private publisher URLs and
unrelated hosts are rejected. The CTA then becomes a UTM-tagged marketplace link,
and dated availability labels update from the same product configuration.
Keep the static/no-JS status copy current when changing publication state.

The two collections exist; no hypothetical expansion, bundle or customer quote was
added. There is no fake checkout, claimed sale, invented scarcity or guarantee.
Sample links remain absent. An internal sample ZIP is not a public licensed lead
magnet: enabling a sample requires actual `downloads/<name>.zip`, tested and
license-cleared flags and SHA256. The site check verifies the real file hash.

## Leads and actual behavior

Measurement is **off by default**. Visitors can enable it for this page only and
revoke it, which clears its buffer. No cookies, localStorage, identity, fingerprint,
email message content or full referring URL is stored. The 500-event buffer lives
only in page memory. Refreshing the page clears events and consent.

Events:

| Event | Exact meaning |
| --- | --- |
| `collection_view` | At least 35% of a collection heading was actually observed while visible; once per product/page consent period |
| `specs_view` | The café compatibility heading was observed; once per product |
| `cta_click` | A real trusted click on a marked internal CTA |
| `launch_interest_click` | A marked mailto link was clicked; **not** a sent email or captured lead |
| `support_click` | Support email link clicked, not a support case created |
| `marketplace_click` | Click on a configured verified public marketplace listing; **not** a purchase |
| `sample_download` | Click requesting an actual configured, verified sample; **not** proof download completed |

Click handlers ignore synthetic dispatches and prevented clicks. Observers watch
small headings, so a tall mobile collection does not fail the visibility threshold.
Network errors never block navigation. With JavaScript disabled, the static content,
internal links and email links continue to work; analytics controls stay hidden.

Attribution is the page's incoming campaign, copied to every recorded event. No
cross-page/session stitching or first/last-touch identity attribution is claimed.
Documented UTM codes (case-insensitive; unknown values are discarded):

- source: google, bing, reddit, youtube, newsletter, fab, unity, hearth_and_sage
- medium: organic, social, email, referral, cpc, studio_site
- campaign: cozy-cafe, mini-planet, studio-launch
- content: hero, collection, mini-planet, support, compatibility, tutorial, gallery

`utm_term`, click IDs, arbitrary text and raw URLs are never exported. Referrer is
reduced to search/social/internal/external/direct. Add new non-personal campaign
codes deliberately in `growth-core.mjs` and tests.

### Collection infrastructure is deliberately explicit

GitHub Pages has no event receiver. `collector` is `null`: consented events can
actually be exported by the visitor using **Export my page events**, but are **not
silently stored on a nonexistent server**. This release does not claim site-wide
analytics, lead capture or persistent conversion dashboards.

For production-wide measurement, deploy an owned first-party receiver, then set
`collector` to its `/api/<name>` path and update the privacy text. Keep the schema
allowlist, consent requirement, request size/rate limits, retention policy and
server-side event IDs/deduplication. Do not log IP addresses or raw request bodies
by default. Add receiver integration tests and run a trusted real-click smoke test
before enabling it. Browser-originated events are untrusted and must never create
payments. No receiver infrastructure or paid analytics service is provisioned here.

## Money: statement-backed reconciliation, never click-backed revenue

Run Node 24 (no dependencies or npm installation required):

```sh
node --test
node scripts/check-site.mjs
node scripts/report-growth.mjs
node scripts/report-growth.mjs --events private/session.json --ledger private/reconciled.json --output private/report.json
```

Without transactions, `money: null`, `revenue_status: unverified_no_transactions`
and `purchase_conversion_rate: null`. Behavior zeros describe only the supplied
consented page exports, not total site traffic. A click never populates a money
field. No actual transaction data was available or imported during this work.

Keep statements, ledgers and reports in ignored `private/`, outside the deployed
artifact. Never publish customer/order records, tokens or payment documents.

Normalized ledger contract (no fictional example sales file is shipped):

- Top level: `schema_version: 1`, `sources: []`, `records: []`.
- Each source: unique `id`, provider `fab` or `unity`, relative original statement
  `file`, lowercase SHA256 `sha256`, and `verified: true` **only after the operator
  reconciles that file against an actual official marketplace export**.
- Every record: unique provider transaction `id`, `source_id`, kind `sale`, `refund`
  or `payout`, `status: 'settled'`, ISO `at`, catalog `product_id`, uppercase
  three-letter currency and **positive integer** `amount_minor` in the currency's
  own minor units. JPY/KRW and USD do not share a universal /100 display scale.
- A refund also requires the original `sale_id`. Include the original sale in the
  ledger even for a refund from a later reporting period; this report is a ledger
  aggregate, not an accounting-period revenue statement.
- Only use product-specific payout records when the official statement actually
  provides that breakdown. Do not invent SKU allocation for provider-wide payouts.

The CLI reads the referenced original files and verifies their hashes. It rejects
unreviewed sources, pending payments, duplicate transactions, unsafe/fractional or
negative amounts, unknown SKUs and unmatched/excess/cross-currency refunds.
The operator still needs to verify **authenticity and mapping**: a digest proves
file integrity, not that a third party paid. This is a reconciliation tool, not a
payment gateway, automatic official-CSV parser or cryptographic payment verifier.

The report separates provider, product and currency. Gross sales, refunds, sales
less refunds and actual payout are distinct; fees, taxes, exchange rates and an
estimated platform share are **not invented**. Missing payout is null. There is
no site-session/order identity bridge, so purchase conversion rate and campaign
revenue attribution stay unknown. Synthetic amounts are isolated in test code.

## Validation and deployment

1. `node --test`: tracking consent/gates, privacy, failure isolation, financial
   integrity and simulated DOM event wiring. Simulated DOM is not browser proof.
2. `node scripts/check-site.mjs`: assets, internal anchors, IDs, sample hashes,
   catalog gates and responsive hooks.
3. `git diff --check`: whitespace. GitHub Actions runs these checks without deploy.
4. **Browser QA remains required:** Work settings disabled local browser control
   in this session. No actual desktop/mobile visual check or trusted real-click
   export was completed. No headless substitute or made-up screenshot is reported.
5. Before merge: serve `node scripts/preview.mjs` and inspect desktop, 390px and
   320px widths for overflow, nav/CTA focus, readable specs and image sizing.
   Check no-JS behavior. Enable measurement, actually scroll through headings,
   click the internal CTA, export events and verify campaign and deduplication.
   Before enabling measurement there must be no events. Revoke and confirm clear.
   Test mailto interaction without actually sending a message.
6. Before enabling Buy: verify the published marketplace listing, price, license,
   file formats and product identity; change the catalog gate and static fallback
   labels. Before enabling a sample, review its real license and test the ZIP.
7. Merge the reviewed Draft PR to the branch configured for GitHub Pages (currently
   main) through the owner's normal deployment procedure. Deploy the static page,
   CSS, three `.mjs` modules and existing PNGs. Exclude `private/`, tests, Git and
   tooling from a custom artifact. Serve `.mjs` with JavaScript MIME type.
8. This PR does **not** merge, publish products or deploy the production site.
   Rollback: revert the PR; no database migration, billing or old-feature removal.
