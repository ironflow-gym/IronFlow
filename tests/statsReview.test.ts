import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nutritionReviewDays } from '../src/nutritionReview.ts';
import { strengthTrend } from '../src/strengthTrend.ts';
import { readStatsSections } from '../hooks/useStatsSections.ts';
import type { FuelLog, HistoricalLog } from '../types';
test('daily nutrition gaps remain null and future entries do not enter the seven-day review',()=>{
 const rows=[{date:'2026-11-09',calories:0},{date:'2026-11-08',calories:200},{date:'2026-11-08',calories:100},{date:'2026-11-10',calories:500}] as FuelLog[];
 const result=nutritionReviewDays(rows,'2026-11-09');assert.equal(result.length,7);assert.equal(result[0].calories,null);assert.equal(result[5].calories,300);assert.equal(result[6].calories,0);assert.equal(result[6].count,1);
});
test('strength chart compares consistent physical units and excludes future and warm-up rows',()=>{
 const rows=[{exercise:'Bench press',category:'Chest',date:'2026-11-08',weight:100,reps:8,unit:'lbs'},{exercise:'Bench press',category:'Chest',date:'2026-11-09',weight:45.359237,reps:8,unit:'kgs'},{exercise:'Bench press',category:'Chest',date:'2026-11-10',weight:500,reps:8,unit:'kgs'},{exercise:'Bench press',category:'Chest',date:'2026-11-09',weight:200,reps:8,unit:'kgs',isWarmup:true}] as HistoricalLog[];
 const metric=strengthTrend(rows,'Bench press',false,'2026-11-09'),imperial=strengthTrend(rows,'Bench press',true,'2026-11-09');assert.equal(metric.length,2);assert.equal(metric[0].e1rm,metric[1].e1rm);assert.equal(imperial[0].e1rm,imperial[1].e1rm);assert.ok(imperial[0].e1rm>metric[0].e1rm);
});
test('Stats preferences accept only boolean section values and tolerate unavailable storage',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 try {Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>'{"strength":false,"ai":true,"bad":"true"}'}});assert.deepEqual(readStatsSections(),{strength:false,ai:true});Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>{throw Error('Unavailable');}}});assert.deepEqual(readStatsSections(),{});}finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete (globalThis as any).localStorage;}
});
