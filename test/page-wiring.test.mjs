import test from 'node:test';
import assert from 'node:assert/strict';

test('page module wires consent, observed headings, trusted clicks and revocation (simulated DOM)',async()=>{
  // This tests module wiring without a browser; not a real-device/mobile claim.
  class Element {
    constructor(dataset={}) { this.dataset=dataset;this.listeners={};this.attributes={};this.hidden=true; }
    addEventListener(name,fn){this.listeners[name]=fn;}
    setAttribute(key,value){this.attributes[key]=value;}
    querySelector(){return this.heading;}
  }
  const toggle=new Element(),status=new Element(),exporter=new Element(),controls=new Element();
  const section=new Element({view:'collection_view',product:'cozy-cafe'});section.id='collection';section.heading=new Element();
  const controlsById={'#analytics-toggle':toggle,'#analytics-status':status,'#export-events':exporter,'#analytics-controls':controls};
  const handlers={};const observerInstances=[];let exportedBlob;
  const original={document:globalThis.document,window:globalThis.window,location:globalThis.location,IntersectionObserver:globalThis.IntersectionObserver,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
  try{
    globalThis.location={href:'https://studio.example/?utm_source=reddit&utm_campaign=cozy-cafe&secret=never-record'};
    globalThis.document={referrer:'https://www.google.com/search?q=secret',visibilityState:'visible',querySelector:s=>controlsById[s],querySelectorAll:s=>s==='[data-view]'?[section]:[],addEventListener:(n,f)=>handlers[n]=f,createElement:()=>({click(){}})};
    globalThis.window={IntersectionObserver:true};
    globalThis.IntersectionObserver=class {constructor(callback){this.callback=callback;observerInstances.push(this);}observe(target){this.target=target;}disconnect(){this.disconnected=true;}};
    URL.createObjectURL=blob=>{exportedBlob=blob;return 'blob:test-only';};URL.revokeObjectURL=()=>{};
    await import('../growth.mjs');
    assert.equal(controls.hidden,false);assert.equal(observerInstances.length,0);
    const link=new Element({event:'cta_click',product:'cozy-cafe',placement:'hero'});
    handlers.click({target:{closest:()=>link},isTrusted:true});
    await toggle.listeners.click();assert.equal(toggle.attributes['aria-pressed'],'true');
    assert.equal(observerInstances[0].target,section.heading); // Large mobile section cannot suppress an impression.
    observerInstances[0].callback([{target:section.heading,isIntersecting:true,intersectionRatio:1}]);
    observerInstances[0].callback([{target:section.heading,isIntersecting:true,intersectionRatio:1}]);
    handlers.click({target:{closest:()=>link},isTrusted:false});
    handlers.click({target:{closest:()=>link},isTrusted:true,defaultPrevented:true});
    handlers.click({target:{closest:()=>link},isTrusted:true});
    exporter.listeners.click({isTrusted:true});
    const result=JSON.parse(await exportedBlob.text());
    assert.deepEqual(result.events.map(e=>e.name),['collection_view','cta_click']);
    assert.equal(JSON.stringify(result).includes('secret'),false);
    await toggle.listeners.click();assert.equal(observerInstances[0].disconnected,true);assert.equal(exporter.disabled,true);assert.match(status.textContent,/Off/);
  }finally{
    globalThis.document=original.document;globalThis.window=original.window;globalThis.location=original.location;globalThis.IntersectionObserver=original.IntersectionObserver;URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;
  }
});
