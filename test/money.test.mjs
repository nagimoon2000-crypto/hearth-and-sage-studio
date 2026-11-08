// Synthetic records exist only in tests. No demo sales ship in the public page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { summarize, loadLedger } from '../scripts/report-growth.mjs';
const source={id:'statement',provider:'fab',verified:true,sha256:'a'.repeat(64)};
const sale={id:'TEST-ONLY-order',source_id:'statement',kind:'sale',status:'settled',product_id:'cozy-cafe',currency:'USD',amount_minor:1899,at:'2026-11-08T00:00:00Z'};
const ledger=(records,sources=[source])=>({schema_version:1,sources,records});
test('no payment data stays unknown, never displays made-up zero revenue',()=>{
  const r=summarize();assert.equal(r.money,null);assert.equal(r.revenue_status,'unverified_no_transactions');assert.equal(r.purchase_conversion_rate,null);
  assert.equal(summarize({ledger:ledger([])}).money,null);
});
test('verified sales/refunds/payouts kept separate, currencies never summed',()=>{
  const refund={...sale,id:'TEST-refund',kind:'refund',sale_id:sale.id,amount_minor:200};
  const payout={...sale,id:'TEST-payout',kind:'payout',amount_minor:1200};
  const eur={...sale,id:'TEST-eur',currency:'EUR',amount_minor:100};
  const r=summarize({ledger:ledger([sale,refund,payout,eur])});
  assert.equal(r.money.length,2);assert.equal(r.money[0].gross_sales_minor,1899);assert.equal(r.money[0].sales_less_refunds_minor,1699);assert.equal(r.money[0].actual_payout_minor,1200);assert.equal(r.money[1].actual_payout_minor,null);
});
test('pending payments, negative/fractional/unsafe amounts, unknown SKUs rejected',()=>{
  for(const patch of [{status:'pending'},{amount_minor:-1},{amount_minor:1.5},{amount_minor:Number.MAX_SAFE_INTEGER+1},{product_id:'invented'},{at:'bad'},{currency:'usd'}])assert.throws(()=>summarize({ledger:ledger([{...sale,...patch}])}));
});
test('duplicates and unreviewed sources rejected',()=>{
  assert.throws(()=>summarize({ledger:ledger([sale,sale])}),/duplicate/);
  assert.throws(()=>summarize({ledger:ledger([sale],[{...source,verified:false}])}),/Unverified/);
});
test('refunds require actual matched sales, cannot exceed sale or mix currency',()=>{
  for(const patch of [{amount_minor:1900},{sale_id:'missing'},{currency:'EUR'}]){
    const refund={...sale,id:'TEST-refund',kind:'refund',sale_id:sale.id,...patch};
    assert.throws(()=>summarize({ledger:ledger([sale,refund])}));
  }
});
test('click events and acquisition count intent only, without transaction attribution',()=>{
  const e={schema_version:1,event_id:1,name:'launch_interest_click',product_id:'cozy-cafe',attribution:{campaign:{utm_source:'reddit',utm_campaign:'cozy-cafe'}}};
  const r=summarize({sessions:[{schema_version:1,scope:'consented_page_session',events:[e]}]});
  assert.equal(r.behavior['cozy-cafe'].launch_interest_click,1);assert.equal(r.acquisition[0].source,'reddit');assert.equal(r.money,null);
  assert.throws(()=>summarize({sessions:[{schema_version:1,scope:'consented_page_session',events:[e,e]}]}),/duplicate/);
});
test('CLI ledger loader requires original source file digest and operator review',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'hs-ledger-test-'));
  try{
    const bytes='SYNTHETIC TEST STATEMENT, NOT A REAL PAYMENT';await writeFile(join(dir,'statement.csv'),bytes);
    const sha256=createHash('sha256').update(bytes).digest('hex');const file=join(dir,'ledger.json');
    await writeFile(file,JSON.stringify(ledger([sale],[{...source,file:'statement.csv',sha256}])));
    assert.equal((await loadLedger(file)).records.length,1);
    await writeFile(join(dir,'statement.csv'),'modified');await assert.rejects(()=>loadLedger(file),/SHA256/);
  }finally{await rm(dir,{recursive:true});}
});
