import { expandTodaySection } from './helpers/today';
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
const calendar=(page:Page)=>page.getByRole('region',{name:'Training calendar',exact:true});
for(const width of [320,1440]) test(`inline month calendar shows statuses and shares the selected date with week view at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await seed(page);const view=calendar(page);
 await view.getByRole('button',{name:'Month',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(view.getByRole('heading',{name:'November 2026',exact:true})).toBeVisible();
 await expect(view.locator('[data-date]')).toHaveCount(42);
 await expect(view.locator('[data-date="2026-11-01"]')).toHaveAttribute('aria-label',/1 missed workout/);
 await expect(view.locator('[data-date="2026-11-02"]')).toHaveAttribute('aria-label',/1 completed workout/);
 await expect(view.locator('[data-date="2026-11-03"]')).toHaveAttribute('aria-label',/2 scheduled workouts/);
 await expect(view.locator('[data-date="2026-11-08"]')).toHaveAttribute('aria-label',/Planned rest/);
 await expect(view.locator('[data-date="2026-11-12"]')).toHaveAttribute('aria-label',/2 scheduled workouts/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await view.locator('[data-date="2026-11-02"]').click();await expect(view.getByRole('region',{name:'Selected day',exact:true})).toContainText('Unscheduled strength');
 await view.getByRole('button',{name:'Week',exact:true}).click();
 await expect(view.getByLabel('Select day',{exact:true}).getByRole('button',{name:/1 completed workout/})).toHaveAttribute('aria-pressed','true');
 await view.getByRole('button',{name:'Month',exact:true}).click();
 await expect(view.locator('[data-date="2026-11-02"]')).toHaveAttribute('aria-pressed','true');
 await view.getByRole('button',{name:'Next month',exact:true}).click();await expect(view.getByRole('heading',{name:'December 2026'})).toBeVisible();
 await view.getByRole('button',{name:'Next month',exact:true}).click();await expect(view.getByRole('heading',{name:'January 2027'})).toBeVisible();
 await view.getByRole('button',{name:'Previous month',exact:true}).click();await expect(view.getByRole('heading',{name:'December 2026'})).toBeVisible();
 await view.getByRole('button',{name:'Today',exact:true}).click();
 await expect(view.locator('[data-date="2026-11-03"]')).toHaveAttribute('aria-pressed','true');
});
test('Today defaults, section order and device preferences persist without hiding the primary action',async({page})=>{
 await page.setViewportSize({width:390,height:1000});await seed(page);
 for(const label of ['Missed sessions','Active training block','Weekly progress','Workout details','Selected day']) await expect(page.getByRole('region',{name:label,exact:true}).locator(':scope > div > button[aria-expanded]')).toHaveAttribute('aria-expanded','false');
 await expect(calendar(page).locator(':scope > div > button[aria-expanded]')).toHaveAttribute('aria-expanded','true');
 await expect(page.getByRole('region',{name:'Next workout',exact:true}).getByRole('button',{name:'Start workout',exact:true})).toBeVisible();
 const order=await page.getByTestId('today-screen').locator(':scope > section').evaluateAll(elements=>elements.map(e=>e.getAttribute('aria-label')));
 expect(order).toEqual(['Next workout','Missed sessions','Training calendar','Active training block','Weekly progress']);
 await page.screenshot({path:'/tmp/ironflow-today-collapsed-week.png',fullPage:true});
 await calendar(page).getByRole('button',{name:'Month',exact:true}).click();
 await page.screenshot({path:'/tmp/ironflow-today-collapsed-month.png',fullPage:true});
 await expandTodaySection(page,'Workout details');await expandTodaySection(page,'Weekly progress');
 await calendar(page).locator(':scope > div > button[aria-expanded]').click();
 await page.reload();await page.getByRole('button',{name:/Skip for now/}).click();
 await expect(calendar(page).locator(':scope > div > button[aria-expanded]')).toHaveAttribute('aria-expanded','false');
 await expect(page.getByRole('region',{name:'Workout details',exact:true}).locator(':scope > div > button[aria-expanded]')).toHaveAttribute('aria-expanded','true');
 await expect(page.getByRole('region',{name:'Weekly progress',exact:true}).locator(':scope > div > button[aria-expanded]')).toHaveAttribute('aria-expanded','true');
 await calendar(page).locator(':scope > div > button[aria-expanded]').click();
 await expect(calendar(page).getByRole('button',{name:'Month',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:'/tmp/ironflow-today-inline-month.png',fullPage:true});
});
test('inline calendar preserves selection through editing, previews and the scheduling assistant',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seed(page);const view=calendar(page);
 await view.getByRole('button',{name:'Month',exact:true}).click();await view.locator('[data-date="2026-11-08"]').click();
 await view.getByRole('button',{name:'Schedule workout or rest',exact:true}).click();
 const editor=page.getByRole('dialog',{name:'Schedule appointment',exact:true});await expect(editor.getByLabel('Date',{exact:true})).toHaveValue('2026-11-08');
 await editor.getByRole('button',{name:'Cancel',exact:true}).click();await expect(view.locator('[data-date="2026-11-08"]')).toHaveAttribute('aria-pressed','true');
 await view.getByRole('button',{name:'Scheduling assistant',exact:true}).click();await expect(page.getByRole('dialog',{name:'Scheduling assistant',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');await expect(view.locator('[data-date="2026-11-08"]')).toHaveAttribute('aria-pressed','true');
 await view.getByRole('button',{name:'Today',exact:true}).click();await expandTodaySection(page,'Selected day');
 await view.getByRole('button',{name:'Preview',exact:true}).first().click();await expect(page.getByRole('dialog',{name:'Workout preview',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close preview',exact:true}).click();
 await view.getByRole('button',{name:'Move block workouts',exact:true}).click();await expect(page.getByRole('dialog',{name:'Scheduling assistant',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');await view.locator('[data-date="2026-11-03"]').focus();await page.keyboard.press('ArrowRight');
 await expect(view.locator('[data-date="2026-11-04"]')).toBeFocused();await expect(view.getByRole('region',{name:'Selected day',exact:true})).toContainText('No workouts or rest planned');
});
