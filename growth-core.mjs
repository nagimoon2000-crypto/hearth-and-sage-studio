export const eventNames = new Set(['collection_view', 'specs_view', 'cta_click', 'marketplace_click', 'launch_interest_click', 'support_click', 'sample_download']);
const campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
const campaignCodes = {
  utm_source: new Set(['google','bing','reddit','youtube','newsletter','fab','unity','hearth_and_sage']),
  utm_medium: new Set(['organic','social','email','referral','cpc','studio_site']),
  utm_campaign: new Set(['cozy-cafe','mini-planet','studio-launch']),
  utm_content: new Set(['hero','collection','mini-planet','support','compatibility','tutorial','gallery']),
};
const placements = new Set(['hero', 'collection', 'mini-planet', 'support', 'compatibility']);
export function campaignFrom(url) {
  const query = new URL(url).searchParams;
  return Object.fromEntries(campaignKeys.flatMap(key => {
    const value = query.get(key);
    // No raw URLs, click IDs, email addresses, search terms or free text.
    return value && campaignCodes[key].has(value.toLowerCase()) ? [[key, value.toLowerCase()]] : [];
  }));
}
export function referrerChannel(referrer, currentOrigin) {
  try {
    const url = new URL(referrer);
    if (url.origin === currentOrigin) return 'internal';
    if (/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com)$/.test(url.hostname)) return 'search';
    if (/(^|\.)(youtube\.com|reddit\.com|facebook\.com|instagram\.com|t\.co)$/.test(url.hostname)) return 'social';
    return 'external';
  } catch { return 'direct'; }
}
export function publicListing(product, provider) {
  const listing = product?.[provider];
  if (!['fab', 'unity'].includes(provider) || listing?.status !== 'published' || !listing.public_verified_at) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(listing.public_verified_at) || !Number.isFinite(Date.parse(listing.public_verified_at))) return null;
  try {
    const url = new URL(listing.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    const allowed = provider === 'fab'
      ? url.hostname === 'www.fab.com' && /^\/listings\/[a-f0-9-]{36}$/.test(url.pathname)
      : url.hostname === 'assetstore.unity.com' && /^\/packages\/(?:slug\/\d+|[a-z0-9/-]+-\d+)$/.test(url.pathname);
    return allowed ? url : null;
  } catch { return null; }
}
export function marketplaceURL(product, provider, placement) {
  const url = publicListing(product, provider);
  if (!url || !placements.has(placement)) return null;
  url.search = new URLSearchParams({ utm_source: 'hearth_and_sage', utm_medium: 'studio_site', utm_campaign: product.id, utm_content: placement });
  return url.href;
}
export function verifiedSample(product) {
  const s = product?.sample;
  return s?.license_cleared === true && s.tested === true && /^[a-f0-9]{64}$/.test(s.sha256 ?? '') && /^downloads\/[a-zA-Z0-9_-]+\.zip$/.test(s.url ?? '') ? s : null;
}
export function createTracker({ catalog, landingURL, referrer = '', now = () => new Date(), send = () => {} }) {
  let enabled = false;
  let records = [];
  let attribution;
  let sequence = 0;
  const seen = new Set();
  const ids = new Set(catalog.map(p => p.id));
  return {
    enable() {
      enabled = true;
      attribution ??= { campaign: campaignFrom(landingURL), referrer_channel: referrerChannel(referrer, new URL(landingURL).origin) };
    },
    disable() { enabled = false; records = []; seen.clear(); attribution = undefined; sequence = 0; },
    get enabled() { return enabled; },
    track(name, { product_id, placement, provider } = {}) {
      if (!enabled || !eventNames.has(name) || !ids.has(product_id) || !placements.has(placement)) return false;
      const product = catalog.find(p => p.id === product_id);
      if (name === 'marketplace_click' && !publicListing(product, provider)) return false;
      if (name === 'sample_download' && !verifiedSample(product)) return false;
      const key = `${name}:${product_id}`;
      if (name.endsWith('_view') && seen.has(key)) return false;
      if (name.endsWith('_view')) seen.add(key);
      const event = { schema_version: 1, event_id: ++sequence, name, product_id, placement,
        at: now().toISOString(), attribution: structuredClone(attribution) };
      if (name === 'marketplace_click') event.provider = provider;
      // Bounded page-memory only. No user IDs, cookies, fingerprint, form fields or revenue.
      if (records.length >= 500) return false;
      records.push(event);
      try { Promise.resolve(send(structuredClone(event))).catch(() => {}); } catch { /* CTA must still work. */ }
      return true;
    },
    export() { return { schema_version: 1, scope: 'consented_page_session', events: structuredClone(records) }; },
  };
}
