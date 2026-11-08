import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { catalog, collector } from '../catalog.mjs';
import { publicListing, verifiedSample } from '../growth-core.mjs';
const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html',root),'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
if (new Set(ids).size !== ids.length) throw Error('Duplicate HTML IDs');
for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
  const value = match[1];
  if (value === '#' || /^(https:|mailto:)/.test(value)) continue;
  if (value.startsWith('#')) { if(!ids.includes(value.slice(1))) throw Error(`Missing anchor ${value}`); }
  else if ((await stat(new URL(value,root))).size === 0) throw Error(`Empty asset ${value}`);
}
if (!html.includes('name="viewport"') || !html.includes('@media(max-width:760px)') || !html.includes('<noscript>')) throw Error('Responsive/no-JS fallback missing');
for (const p of catalog) {
  for (const provider of ['fab','unity']) if (p[provider].status==='published' && !publicListing(p,provider)) throw Error('Published state requires a verified public URL');
  if (p.sample) {
    const sample=verifiedSample(p);if(!sample)throw Error('Invalid sample or missing license/test gate');
    const bytes=await readFile(new URL(sample.url,root));
    if(createHash('sha256').update(bytes).digest('hex')!==sample.sha256)throw Error('Sample hash mismatch');
  }
}
if (collector !== null && !/^\/api\/[a-z-]+$/.test(collector)) throw Error('Collector must be first-party /api path');
console.log('Site assets, internal links, unique IDs, responsive hooks, catalog and sample gates passed.');
