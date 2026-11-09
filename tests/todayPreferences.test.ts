import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readTodayPreferences } from '../hooks/useTodayPreferences.ts';
test('Today view defaults and malformed preferences never prevent training',()=>{
 const original = Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 try {
  for(const raw of ['null','bad json','{"view":"invalid","sections":{"calendar":"false","block":true}}']) {
   Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>raw}});
   const preferences=readTodayPreferences();assert.equal(preferences.view,'week');assert.equal(preferences.sections.calendar,true);assert.equal(preferences.sections.workout,false);
  }
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>'{"view":"month","sections":{"calendar":false,"weekly":true}}'}});
  const preferences=readTodayPreferences();assert.equal(preferences.view,'month');assert.equal(preferences.sections.calendar,false);assert.equal(preferences.sections.weekly,true);
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>{throw new Error('Unavailable');}}});
  assert.equal(readTodayPreferences().sections.calendar,true);
 } finally { if(original) Object.defineProperty(globalThis,'localStorage',original);else delete (globalThis as any).localStorage; }
});
