import { test, expect, type Page } from '@playwright/test';
import { expandFoodSection, openFoodOptions } from './helpers/food';
test.use({timezoneId:'Australia/Brisbane'});
async function setup(page:Page) {
 await page.clock.install({time:new Date('2026-11-09T02:00:00Z')});
 await page.goto('/');await page.getByRole('button',{name:/Skip for now/}).click();
 await page.evaluate(async()=>{const {storage}=await import(/* @vite-ignore */ String('/services/storageService.ts'));await storage.overwriteEverything({ironflow_fuel:[
  {id:'today',date:'2026-11-09',name:'Greek yoghurt',calories:120,protein:20,carbs:8,fats:0.8,confidence:1,nutritionSource:'label'},
  {id:'old',date:'2026-11-08',name:'Oats',calories:380,protein:13,carbs:60,fats:7,confidence:1}
 ]});});
 await page.reload();await page.getByRole('button',{name:/Skip for now/}).click();await page.getByRole('button',{name:'Food',exact:true}).click();
}
async function data(page:Page) {return page.evaluate(async()=>{const {storage}=await import(/* @vite-ignore */ String('/services/storageService.ts'));return storage.get('ironflow_fuel');});}
for(const width of [320,1440]) test(`Food logging stays first and secondary groups start closed at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:1000});await setup(page);
 const food=page.getByTestId('food-screen');const logging=food.getByRole('region',{name:'Add food',exact:true});
 for(const label of ['Log food manually','Scan barcode','Food pantry','Saved meal'])await expect(logging.getByRole('button',{name:label,exact:true})).toBeVisible();
 for(const label of ['Describe food with AI','Today’s food','Food targets','Food history']) await expect(food.getByRole('region',{name:label,exact:true}).locator(':scope > div > button[aria-expanded]')).toHaveAttribute('aria-expanded','false');
 await expect(food.getByRole('progressbar')).toHaveCount(4);
 const order=await food.locator(':scope > div > section').evaluateAll(elements=>elements.map(e=>e.getAttribute('aria-label')));
 expect(order).toEqual(['Add food','Today’s food totals','Today’s food','Food targets','Food history']);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 if(width===320)await page.screenshot({path:'/tmp/ironflow-food-reorganised.png',fullPage:true});
 await logging.getByRole('button',{name:'Saved meal',exact:true}).click();await expect(page.getByRole('dialog',{name:'Save meal',exact:true})).toBeVisible();
});
test('Food section choices persist without losing an AI draft or changing logged food',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);const before=await data(page);
 await expandFoodSection(page,'Describe food with AI');const input=page.getByRole('textbox',{name:'Describe food (AI)',exact:true});await input.fill('Breakfast draft to keep');
 await page.getByRole('region',{name:'Describe food with AI',exact:true}).locator(':scope > div > button[aria-expanded]').click();
 await expandFoodSection(page,'Describe food with AI');await expect(input).toHaveValue('Breakfast draft to keep');
 await expandFoodSection(page,'Today’s food');await expandFoodSection(page,'Food history');
 await page.getByRole('button',{name:'Stats',exact:true}).click();await page.getByRole('button',{name:'Food',exact:true}).click();await expect(input).toHaveValue('Breakfast draft to keep');
 expect(await data(page)).toEqual(before);
 await page.reload();await page.getByRole('button',{name:/Skip for now/}).click();await page.getByRole('button',{name:'Food',exact:true}).click();
 for(const label of ['Describe food with AI','Today’s food','Food history'])await expect(page.getByRole('region',{name:label,exact:true}).locator(':scope > div > button[aria-expanded]')).toHaveAttribute('aria-expanded','true');
 expect(await data(page)).toEqual(before);
});
test('compact entry options retain edit and confirmed deletion, with live progress updates',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);await expandFoodSection(page,'Today’s food');
 await expect(page.getByRole('button',{name:'Edit Greek yoghurt',exact:true})).toHaveCount(0);
 await openFoodOptions(page,'Greek yoghurt');await page.getByRole('button',{name:'Edit Greek yoghurt',exact:true}).click();
 const edit=page.getByRole('dialog',{name:'Edit food entry',exact:true});await edit.getByLabel('Calories (kcal)',{exact:true}).fill('150');await edit.getByRole('button',{name:'Save changes',exact:true}).click();
 await expect(page.getByRole('progressbar',{name:'Calories',exact:true})).toHaveAttribute('aria-valuetext',/^150 of /);
 await openFoodOptions(page,'Greek yoghurt');await page.getByRole('button',{name:'Delete Greek yoghurt',exact:true}).click();
 const confirmation=page.getByRole('dialog',{name:'Delete food entry',exact:true});await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();expect((await data(page)) as any[]).toHaveLength(2);
 await page.getByRole('button',{name:'Delete Greek yoghurt',exact:true}).click();await confirmation.getByRole('button',{name:'Delete entry',exact:true}).click();
 await expect(page.getByRole('progressbar',{name:'Calories',exact:true})).toHaveAttribute('aria-valuenow','0');
});
