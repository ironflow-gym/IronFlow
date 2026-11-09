import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFoodPreferences } from '../hooks/useFoodPreferences.ts';
test('Food section preferences default closed and ignore malformed or unavailable storage', () => {
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 try {
  for(const raw of ['null','bad json','{"today":"yes"}']) {
   Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>raw}});
   assert.deepEqual(readFoodPreferences(),{ai:false,today:false,targets:false,history:false});
  }
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>'{"ai":true,"today":false,"targets":true,"history":true}'}});
  assert.deepEqual(readFoodPreferences(),{ai:true,today:false,targets:true,history:true});
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>{throw new Error('Unavailable');}}});
  assert.equal(readFoodPreferences().ai,false);
 } finally {if(original)Object.defineProperty(globalThis,'localStorage',original);else delete (globalThis as any).localStorage;}
});
