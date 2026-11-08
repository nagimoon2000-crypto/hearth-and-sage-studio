import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { catalog } from '../catalog.mjs';
import { eventNames } from '../growth-core.mjs';

export function summarize({ sessions = [], ledger = null } = {}) {
  const products = new Set(catalog.map(p => p.id));
  const behavior = Object.fromEntries([...products].map(id => [id, Object.fromEntries([...eventNames].map(n => [n, 0]))]));
  const acquisition = new Map();
  for (const session of sessions) {
    if (session.schema_version !== 1 || session.scope !== 'consented_page_session' || !Array.isArray(session.events)) throw Error('Invalid consented event export');
    const seen = new Set();
    for (const e of session.events) {
      if (e.schema_version !== 1 || !products.has(e.product_id) || !eventNames.has(e.name) || !Number.isSafeInteger(e.event_id) || e.event_id < 1 || seen.has(e.event_id)) throw Error('Invalid or duplicate behavior event');
      seen.add(e.event_id); behavior[e.product_id][e.name]++;
      const campaign = e.attribution?.campaign ?? {};
      const key = JSON.stringify([e.product_id, campaign.utm_source ?? 'unattributed', campaign.utm_medium ?? 'unattributed', campaign.utm_campaign ?? 'unattributed', campaign.utm_content ?? 'unattributed']);
      const bucket = acquisition.get(key) ?? { product_id: e.product_id, source: campaign.utm_source ?? 'unattributed', medium: campaign.utm_medium ?? 'unattributed', campaign: campaign.utm_campaign ?? 'unattributed', content: campaign.utm_content ?? 'unattributed', events: {} };
      bucket.events[e.name] = (bucket.events[e.name] ?? 0) + 1; acquisition.set(key, bucket);
    }
  }
  const money = {};
  let transactions = 0;
  if (ledger) {
    if (ledger.schema_version !== 1 || !Array.isArray(ledger.records) || !Array.isArray(ledger.sources)) throw Error('Invalid ledger');
    const sources = new Map(ledger.sources.map(s => [s.id, s]));
    if (sources.size !== ledger.sources.length) throw Error('Duplicate statement source');
    const ids = new Set(); const sales = new Map(); const refunds = new Map();
    const amount = value => { if (!Number.isSafeInteger(value) || value <= 0) throw Error('Amount must be positive safe integer minor units'); return value; };
    for (const r of ledger.records) {
      const source = sources.get(r.source_id);
      if (!source || source.verified !== true || !/^[a-f0-9]{64}$/.test(source.sha256 ?? '') || !['fab', 'unity'].includes(source.provider)) throw Error('Unverified statement source');
      if (typeof r.id !== 'string' || !r.id || ids.has(`${source.provider}:${r.id}`)) throw Error('Missing or duplicate transaction');
      ids.add(`${source.provider}:${r.id}`);
      if (!['sale','refund','payout'].includes(r.kind) || !/^[A-Z]{3}$/.test(r.currency ?? '') || !Number.isFinite(Date.parse(r.at)) || !products.has(r.product_id)) throw Error('Invalid transaction fields');
      if (r.status !== 'settled') throw Error('Only settled transactions may be measured');
      const value = amount(r.amount_minor);
      const key = `${source.provider}:${r.product_id}:${r.currency}`;
      const b = money[key] ??= { provider: source.provider, product_id: r.product_id, currency: r.currency, gross_sales_minor: null, refunds_minor: null, sales_less_refunds_minor: null, actual_payout_minor: null, sales_count: 0, refund_count: 0 };
      if (r.kind === 'sale') {
        b.gross_sales_minor = (b.gross_sales_minor ?? 0) + value; b.sales_count++;
        sales.set(`${source.provider}:${r.id}`, { value, product_id: r.product_id, currency: r.currency });
      } else if (r.kind === 'refund') {
        if (typeof r.sale_id !== 'string') throw Error('Refund needs sale_id');
        const id = `${source.provider}:${r.sale_id}`;
        const previous = refunds.get(id) ?? { value: 0, product_id: r.product_id, currency: r.currency };
        if (previous.product_id !== r.product_id || previous.currency !== r.currency) throw Error('Refund mismatch');
        previous.value += value; refunds.set(id, previous);
        b.refunds_minor = (b.refunds_minor ?? 0) + value; b.refund_count++;
      } else { b.actual_payout_minor = (b.actual_payout_minor ?? 0) + value; }
      for (const field of ['gross_sales_minor','refunds_minor','actual_payout_minor']) if (b[field] !== null && !Number.isSafeInteger(b[field])) throw Error('Amount overflow');
      transactions++;
    }
    for (const [id, refund] of refunds) {
      const sale = sales.get(id);
      if (!sale || refund.value > sale.value || refund.currency !== sale.currency || refund.product_id !== sale.product_id) throw Error('Unmatched or excessive refund');
    }
    for (const b of Object.values(money)) if (b.gross_sales_minor !== null) b.sales_less_refunds_minor = b.gross_sales_minor - (b.refunds_minor ?? 0);
  }
  return { scope: 'provided_consented_sessions_only', session_exports: sessions.length, behavior, acquisition: [...acquisition.values()],
    revenue_status: transactions ? 'reconciled_statement_records' : 'unverified_no_transactions',
    money: transactions ? Object.values(money) : null,
    purchase_conversion_rate: null,
    limitations: ['Clicks are not sales; enquiries/download completion are not inferred.', 'No cross-device identity or session-to-sale attribution.', 'Amounts are minor units; currencies/providers remain separate. Gross less refunds excludes fees and taxes and is not payout.', 'Missing data is unknown, not zero. Statement authenticity and SKU mapping require operator reconciliation.'] };
}
export async function loadLedger(path) {
  const absolute = resolve(path); const ledger = JSON.parse(await readFile(absolute, 'utf8'));
  for (const source of ledger.sources ?? []) {
    if (source.verified !== true || typeof source.file !== 'string') throw Error('Source must be reviewed and verified');
    const actual = createHash('sha256').update(await readFile(resolve(dirname(absolute), source.file))).digest('hex');
    if (actual !== source.sha256) throw Error('Statement SHA256 mismatch');
  }
  return ledger;
}
async function main() {
  const args = process.argv.slice(2); const sessions = []; let ledger = null; let output = null;
  for (let i = 0; i < args.length; i += 2) {
    if (!args[i+1]) throw Error('Expected --events file, --ledger file, or --output file');
    if (args[i] === '--events') sessions.push(JSON.parse(await readFile(args[i+1], 'utf8')));
    else if (args[i] === '--ledger') { if (ledger) throw Error('Use one reconciled ledger'); ledger = await loadLedger(args[i+1]); }
    else if (args[i] === '--output') output = args[i+1];
    else throw Error('Unknown argument');
  }
  const report = JSON.stringify(summarize({ sessions, ledger }), null, 2);
  if (output) await writeFile(output, report); else process.stdout.write(report + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });
