import { catalog, collector } from './catalog.mjs';
import { createTracker, marketplaceURL, verifiedSample } from './growth-core.mjs';

const tracker = createTracker({ catalog, landingURL: location.href, referrer: document.referrer,
  send(event) {
    if (!collector || !/^\/api\/[a-z-]+$/.test(collector)) return;
    return fetch(collector, { method: 'POST', credentials: 'omit', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(event) });
  },
});
// Purchase intent never records a purchase or a sale. Existing links work without JS.
for (const holder of document.querySelectorAll('[data-offer]')) {
  const product = catalog.find(p => p.id === holder.dataset.offer);
  if (!product) continue;
  let publishedProvider;
  for (const provider of ['fab', 'unity']) {
    const href = marketplaceURL(product, provider, holder.dataset.placement);
    if (!href) continue;
    const link = document.createElement('a');
    link.className = 'button'; link.href = href; link.rel = 'noopener';
    link.textContent = `View price & buy on ${provider === 'fab' ? 'Fab' : 'Unity Asset Store'} ↗`;
    Object.assign(link.dataset, { event: 'marketplace_click', product: product.id, placement: holder.dataset.placement, provider });
    holder.replaceChildren(link);
    publishedProvider = provider;
    break;
  }
  if (publishedProvider) {
    for (const label of document.querySelectorAll(`[data-availability="${product.id}"]`)) {
      label.textContent = `Available on ${publishedProvider === 'fab' ? 'Fab' : 'Unity Asset Store'}. Public listing verified ${product[publishedProvider].public_verified_at}. Check the marketplace for current price and license.`;
    }
  }
  const sample = verifiedSample(product);
  if (sample) {
    const link = document.createElement('a'); link.href = sample.url; link.download = ''; link.textContent = 'Download verified sample';
    Object.assign(link.dataset, { event: 'sample_download', product: product.id, placement: holder.dataset.placement });
    holder.append(link);
  }
}
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-event]');
  if (!link || event.defaultPrevented || !event.isTrusted) return;
  tracker.track(link.dataset.event, { product_id: link.dataset.product, placement: link.dataset.placement, provider: link.dataset.provider });
});
const observers = [];
function observeViews() {
  if (!('IntersectionObserver' in window)) return; // No unobserved/synthetic impressions.
  const sections = new WeakMap();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || entry.intersectionRatio < .35 || document.visibilityState !== 'visible') continue;
      const section = sections.get(entry.target);
      tracker.track(section.dataset.view, { product_id: section.dataset.product, placement: section.id });
    }
  }, { threshold: [.35] });
  document.querySelectorAll('[data-view]').forEach(el => {
    const target = el.querySelector('h2') ?? el;
    sections.set(target, el); observer.observe(target);
  });
  observers.push(observer);
}
const toggle = document.querySelector('#analytics-toggle');
const output = document.querySelector('#analytics-status');
const exportButton = document.querySelector('#export-events');
toggle.addEventListener('click', () => {
  if (tracker.enabled) {
    tracker.disable(); observers.splice(0).forEach(o => o.disconnect());
  } else { tracker.enable(); observeViews(); }
  toggle.setAttribute('aria-pressed', String(tracker.enabled));
  toggle.textContent = tracker.enabled ? 'Turn off & clear events' : 'Enable optional measurement';
  output.textContent = tracker.enabled ? 'On for this page only. Events stay in page memory; no collection server is configured.' : 'Off. No behavior events are being recorded.';
  if (tracker.enabled && collector) output.textContent = 'On for this page. Events are sent to our configured first-party collector. See privacy details.';
  exportButton.disabled = !tracker.enabled;
});
exportButton.addEventListener('click', event => {
  if (!event.isTrusted || !tracker.enabled) return;
  const blob = new Blob([JSON.stringify(tracker.export(), null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = href; link.download = 'hearth-and-sage-session.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
});
document.querySelector('#analytics-controls').hidden = false;
