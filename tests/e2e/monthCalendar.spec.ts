import { test, expect, type Page } from '@playwright/test';
import { createBlock } from '../../src/trainingBlocks';
test.use({ timezoneId: 'Australia/Brisbane' });
const routine = { id:'month-a', name:'Month workout', exercises:[{name:'Squat',category:'Legs',suggestedSets:2,targetReps:'8',suggestedReps:8,suggestedWeight:20,rationale:''}] };
async function seed(page: Page) {
 const block=createBlock({name:'Month block',goal:'strength',daysPerWeek:3,workoutsPerRound:1,rounds:2,minutes:45,experience:'intermediate',returning:false,equipment:'',priorities:'',event:''},[routine],'double');
 await page.clock.install({time:new Date('2026-11-03T02:00:00Z')});
 await page.goto('/'); await page.getByRole('button',{name:/Skip for now/}).click();
 await page.evaluate(async data=>{const {storage}=await import(/* @vite-ignore */ String('/services/storageService.ts'));await storage.overwriteEverything(data);},{
  ironflow_templates:[routine], ironflow_blocks:[block], ironflow_schedule:{appointments:[
   {id:'missed',date:'2026-11-01',kind:'workout',templateId:routine.id},
   {id:'a',date:'2026-11-03',kind:'workout',templateId:block.sessions[0].template.id,blockId:block.id,blockSessionId:block.sessions[0].id},
   {id:'b',date:'2026-11-03',kind:'workout',templateId:routine.id},
   {id:'rest',date:'2026-11-08',kind:'rest'},
   {id:'weekly',date:'2026-11-05',kind:'workout',templateId:routine.id,repeat:'weekly'},
   {id:'moved',date:'2026-10-10',kind:'workout',templateId:routine.id},
  ],exceptions:{'moved@2026-10-10':{date:'2026-11-12'}},completions:[{sessionId:'actual',date:'2026-11-02',name:'Unscheduled strength',templateId:routine.id}]}
 });
 await page.reload(); await page.getByRole('button',{name:/Skip for now/}).click();
}
const modal=(page:Page)=>page.getByRole('dialog',{name:'Month calendar',exact:true});
for(const width of [320,1440]) test(`month view is full-screen and shows mixed statuses, selected details and navigation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900}); await seed(page);
 const opener=page.getByRole('button',{name:'Month view',exact:true}); await opener.click(); const month=modal(page);
 await expect(month.getByRole('heading',{name:'November 2026',exact:true})).toBeVisible();
 await expect(month.locator('[data-date]')).toHaveCount(42);
 await expect(month.locator('[data-date="2026-11-01"]')).toHaveAttribute('aria-label',/1 missed workout/);
 await expect(month.locator('[data-date="2026-11-02"]')).toHaveAttribute('aria-label',/1 completed workout/);
 await expect(month.locator('[data-date="2026-11-03"]')).toHaveAttribute('aria-label',/2 scheduled workouts/);
 await expect(month.locator('[data-date="2026-11-08"]')).toHaveAttribute('aria-label',/Planned rest/);
 await expect(month.locator('[data-date="2026-11-12"]')).toHaveAttribute('aria-label',/2 scheduled workouts/);
 const box=(await month.boundingBox())!; expect(box.width).toBe(width); expect(box.height).toBe(900); expect(box.x).toBe(0);expect(box.y).toBe(0);
 expect(await month.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
 await month.locator('[data-date="2026-11-02"]').click(); await expect(month.getByRole('region',{name:'Selected day'})).toContainText('Unscheduled strength');
 await month.getByRole('button',{name:'Next month',exact:true}).click(); await expect(month.getByRole('heading',{name:'December 2026'})).toBeVisible();
 await month.getByRole('button',{name:'Next month',exact:true}).click(); await expect(month.getByRole('heading',{name:'January 2027'})).toBeVisible();
 await month.getByRole('button',{name:'Previous month',exact:true}).click(); await expect(month.getByRole('heading',{name:'December 2026'})).toBeVisible();
 await month.getByRole('button',{name:'Today',exact:true}).click(); await expect(month.locator('[data-date="2026-11-03"]')).toHaveAttribute('aria-pressed','true');
 if(width===320) await page.screenshot({path:'/tmp/ironflow-month-implemented.png'});
 await page.keyboard.press('Escape'); await expect(month).toHaveCount(0); await expect(opener).toBeFocused();
});
test('month calendar preserves selection through appointment edits and assistant dialogs',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page);await page.getByRole('button',{name:'Month view',exact:true}).click();const month=modal(page);
 await month.locator('[data-date="2026-11-08"]').click();
 await month.getByRole('button',{name:'Schedule workout or rest',exact:true}).click();
 const editor=page.getByRole('dialog',{name:'Schedule appointment',exact:true}); await expect(editor.getByLabel('Date',{exact:true})).toHaveValue('2026-11-08');
 await editor.getByRole('button',{name:'Cancel',exact:true}).click(); await expect(month.locator('[data-date="2026-11-08"]')).toHaveAttribute('aria-pressed','true');
 await month.getByRole('button',{name:'Scheduling assistant',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Scheduling assistant',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cancel scheduling assistant',exact:true}).click();
 await expect(month).toBeVisible();await expect(month.locator('[data-date="2026-11-08"]')).toHaveAttribute('aria-pressed','true');
 await month.getByRole('button',{name:'Today',exact:true}).click();
 await month.getByRole('button',{name:'Preview',exact:true}).first().click();
 await expect(page.getByRole('dialog',{name:'Workout preview',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close preview',exact:true}).click();
 await expect(month).toBeVisible();
 await month.getByRole('button',{name:'Move block workouts',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Scheduling assistant',exact:true})).toBeVisible();
 await page.keyboard.press('Escape'); await expect(month).toBeVisible();
 await month.locator('[data-date="2026-11-03"]').focus(); await page.keyboard.press('ArrowRight');
 await expect(month.locator('[data-date="2026-11-04"]')).toBeFocused();
 await expect(month.getByRole('region',{name:'Selected day'})).toContainText('No workouts or rest planned');
});
