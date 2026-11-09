import { test, expect, type Page } from '@playwright/test';
import { expandTodaySection as expandStats } from './helpers/today';
test.use({timezoneId:'Australia/Brisbane'});
async function seed(page:Page, ai=false) {
 await page.clock.setFixedTime(new Date('2026-11-09T02:00:00Z'));
 await page.goto('/');await page.getByRole('button',{name:/Skip for now/}).click();
 await page.evaluate(async ai=>{const {storage}=await import(/* @vite-ignore */ String('/services/storageService.ts'));await storage.overwriteEverything({ironflow_history:[0,2,5,8,12,18,24].map((days,i)=>({date:`2026-11-${String(9).padStart(2,'0')}`,exercise:'Bench press',category:'Chest',weight:60+i,reps:8,unit:'kgs',sessionId:`s${i}`,templateName:'Upper A'})),ironflow_biometrics:['2026-10-28','2026-10-30','2026-11-01','2026-11-04','2026-11-06','2026-11-09'].map((date,i)=>({date,weight:82-i*.1,unit:'kgs',height:180,bodyFat:18,waist:85})),ironflow_fuel:[3,5,7,8,9].map(day=>({id:`f${day}`,date:`2026-11-0${day}`,name:'Recorded food',calories:2000,protein:130,carbs:200,fats:60,confidence:1})),ironflow_settings:{units:'metric',weeklyWorkoutGoal:3}});if(ai)localStorage.setItem('ironflow_gemini_key','mock-key-for-browser-test');},ai);
 await page.reload();if(!ai)await page.getByRole('button',{name:/Skip for now/}).click();await page.getByRole('button',{name:'Stats',exact:true}).click();
}
async function snapshot(page:Page){return page.evaluate(async()=>{const {storage}=await import(/* @vite-ignore */ String('/services/storageService.ts'));return storage.getEverything();});}
for(const width of [320,1440])test(`Stats uses consistent navigation, actions and truthful nutrition coverage at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await seed(page);
 await expect(page.getByRole('group',{name:'Stats areas'}).getByRole('button')).toHaveText(['Training','Body','Nutrition']);
 await expect(page.getByRole('region',{name:'Recent training progress'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Strength trend',exact:true}).locator(':scope > div > button[aria-expanded]')).toHaveAttribute('aria-expanded','true');
 for(const label of ['Session history','Training load & muscle volume','Consistency & milestones','AI progress review'])await expect(page.getByRole('region',{name:label,exact:true}).locator(':scope > div > button[aria-expanded]')).toHaveAttribute('aria-expanded','false');
 await page.screenshot({path:`/tmp/ironflow-stats-training-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Body',exact:true}).click();await expect(page.getByRole('button',{name:'Add measurement',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Body weight trend'})).toContainText('Last measured');
 await page.screenshot({path:`/tmp/ironflow-stats-body-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Nutrition',exact:true}).click();await expect(page.getByRole('region',{name:'Nutrition coverage'})).toContainText('5 of 7 days logged');
 await expect(page.getByRole('progressbar',{name:'Calories average'})).toHaveAttribute('aria-valuetext',/^2000 of /);
 await expect(page.getByRole('region',{name:'Daily intake',exact:true})).toContainText('No entries');
 await expect(page.getByRole('button',{name:'Open food log',exact:true})).toBeVisible();
 await page.screenshot({path:`/tmp/ironflow-stats-nutrition-${width}.png`,fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Stats folding and tab changes preserve recorded data and independent section preferences',async({page})=>{
 await seed(page);const before=await snapshot(page);
 await expandStats(page,'Training load & muscle volume');await expandStats(page,'Consistency & milestones');
 await page.getByRole('region',{name:'Strength trend',exact:true}).locator(':scope > div > button[aria-expanded]').click();
 await page.getByRole('button',{name:'Body',exact:true}).click();await expandStats(page,'Composition & indices');
 await page.getByRole('button',{name:'Nutrition',exact:true}).click();await expandStats(page,'Daily totals');
 expect(await snapshot(page)).toEqual(before);
 await page.reload();await page.getByRole('button',{name:/Skip for now/}).click();await page.getByRole('button',{name:'Stats',exact:true}).click();
 await expect(page.getByRole('region',{name:'Training load & muscle volume',exact:true}).locator(':scope > div > button[aria-expanded]')).toHaveAttribute('aria-expanded','true');
 await expect(page.getByRole('region',{name:'Consistency & milestones',exact:true}).locator(':scope > div > button[aria-expanded]')).toHaveAttribute('aria-expanded','true');
 await expect(page.getByRole('region',{name:'Strength trend',exact:true}).locator(':scope > div > button[aria-expanded]')).toHaveAttribute('aria-expanded','false');
});
test('AI review is requested only by Generate and reports the result',async({page})=>{
 let calls=0;await page.route('https://generativelanguage.googleapis.com/**',route=>{calls++;return route.fulfill({json:{candidates:[{content:{role:'model',parts:[{text:'Recorded progress reviewed.'}]},finishReason:'STOP'}]}});});
 await seed(page,true);await expandStats(page,'AI progress review');expect(calls).toBe(0);
 await page.getByRole('button',{name:'Generate AI review',exact:true}).click();
 await expect(page.getByRole('region',{name:'AI progress review',exact:true})).toContainText('Recorded progress reviewed.');expect(calls).toBe(1);
});
