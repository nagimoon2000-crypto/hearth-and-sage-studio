import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../catalog.mjs';
import { createTracker, campaignFrom, referrerChannel, marketplaceURL, verifiedSample } from '../growth-core.mjs';
const product = { ...catalog[0], fab: { status: 'published', public_verified_at: '2026-11-08', url: 'https://www.fab.com/listings/b510e122-2636-4d86-920d-61d70352b35b' } };
function setup(options={}) { return createTracker({ catalog: [product], landingURL: 'https://studio.example/?utm_source=reddit&utm_campaign=cozy-cafe&email=secret', ...options }); }
const click={ product_id:'cozy-cafe', placement:'collection', provider:'fab' };
test('default and revoked consent cannot record or send events',()=>{
  const sent=[];const t=setup({send:e=>sent.push(e)});
  assert.equal(t.track('collection_view',click),false);assert.deepEqual(sent,[]);
  t.enable();assert.equal(t.track('collection_view',click),true);
  t.disable();assert.deepEqual(t.export().events,[]);assert.equal(t.track('cta_click',click),false);
});
test('only documented campaign codes survive, no URLs, emails, click IDs or arbitrary codes',()=>{
  assert.deepEqual(campaignFrom('https://example.com/?utm_source=reddit&utm_medium=social&utm_campaign=cozy-cafe&utm_content=tutorial&gclid=SECRET&email=person@example.com'),{utm_source:'reddit',utm_medium:'social',utm_campaign:'cozy-cafe',utm_content:'tutorial'});
  assert.deepEqual(campaignFrom('https://example.com/?utm_source=person&utm_campaign=alice_example_com&utm_content=https://x'),{});
});
test('referrer reduced to channel, never stores referrer path or search',()=>{
  assert.equal(referrerChannel('https://www.google.com/search?q=secret','https://site.example'),'search');
  assert.equal(referrerChannel('https://site.example/private','https://site.example'),'internal');
  assert.equal(referrerChannel('https://private.example/account?token=secret','https://site.example'),'external');
});
test('impressions deduplicate per product, real clicks remain separate and have no money fields',()=>{
  const t=setup();t.enable();t.track('collection_view',click);t.track('collection_view',click);
  t.track('marketplace_click',click);t.track('marketplace_click',click);
  const events=t.export().events;assert.equal(events.length,3);
  assert.equal(events[1].attribution.campaign.utm_source,'reddit');
  assert.equal('amount' in events[1],false);assert.equal('email' in events[1],false);
  assert.equal(t.track('purchase',click),false);assert.equal(t.track('cta_click',{...click,product_id:'imaginary'}),false);
});
test('unpublished approval and private publisher URLs can never produce a buy CTA',()=>{
  for(const p of catalog)assert.equal(marketplaceURL(p,'fab','collection'),null);
  assert.equal(marketplaceURL({...product,fab:{...product.fab,url:'https://www.fab.com/portal/listings/id/edit'}},'fab','collection'),null);
  assert.equal(marketplaceURL({...product,fab:{...product.fab,public_verified_at:null}},'fab','collection'),null);
  const url=new URL(marketplaceURL(product,'fab','collection'));
  assert.equal(url.searchParams.get('utm_campaign'),'cozy-cafe');assert.equal(url.searchParams.get('utm_content'),'collection');
});
test('fake sample/download events blocked; sample needs license, tests and SHA',()=>{
  assert.equal(verifiedSample(product),null);const t=setup();t.enable();assert.equal(t.track('sample_download',click),false);
  assert.equal(verifiedSample({...product,sample:{url:'downloads/sample.zip',tested:true,license_cleared:false,sha256:'a'.repeat(64)}}),null);
});
test('collector failure never throws or interrupts CTA; buffers bounded and exports isolated',async()=>{
  const t=setup({send:()=>Promise.reject(Error('offline'))});t.enable();
  for(let i=0;i<505;i++)t.track('cta_click',click);
  assert.equal(t.export().events.length,500);const snapshot=t.export();snapshot.events.length=0;
  assert.equal(t.export().events.length,500);await new Promise(resolve=>setImmediate(resolve));
});
