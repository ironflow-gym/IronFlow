import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repeatMeal, scaleMealFood, saveMeal } from '../src/meals';

const food = { name: 'Oats', calories: 380, protein: 13, carbs: 60, fats: 7, confidence: 0.5, pantryItemId: 'oats' };

test('repeated foods retain their nutrition source and receive new identities and a local date', () => {
  const source = { ...food, id: 'original', date: '2026-01-01' };
  const logs = repeatMeal([source], [1], '2026-10-26', () => 'new');
  assert.deepEqual(logs, [{ ...food, id: 'new', date: '2026-10-26' }]);
  assert.equal(source.id, 'original');
  assert.equal(source.date, '2026-01-01');
});

test('quantity scales recorded calories and macros without deriving calories from macros', () => {
  assert.deepEqual(scaleMealFood(food, 0.5), { ...food, calories: 190, protein: 6.5, carbs: 30, fats: 3.5 });
  assert.deepEqual(scaleMealFood(food, 2), { ...food, calories: 760, protein: 26, carbs: 120, fats: 14 });
  assert.equal(food.calories, 380);
});

test('invalid quantities, nutrition and calendar dates cannot produce new logs', () => {
  for (const quantity of [0, -1, NaN, Infinity, 1001]) assert.throws(() => scaleMealFood(food, quantity));
  for (const date of ['2026-02-30', '2026-13-01', 'invalid']) assert.throws(() => repeatMeal([food], [1], date, () => 'id'));
  assert.throws(() => repeatMeal([], [], '2026-10-26', () => 'id'));
  assert.throws(() => repeatMeal([food], [], '2026-10-26', () => 'id'));
  assert.throws(() => scaleMealFood({ ...food, protein: -1 }, 1));
});


test('saved meals snapshot multiple foods and strip historical identity without mutating sources', () => {
  const source = { ...food, id: 'source', date: '2026-01-01' };
  const saved = saveMeal('saved', '  Breakfast  ', [source, { ...food, name: 'Coffee' }]);
  assert.equal(saved.name, 'Breakfast');
  assert.equal(saved.foods.length, 2);
  assert.equal('id' in saved.foods[0], false);
  source.calories = 999;
  assert.equal(saved.foods[0].calories, 380);
  saved.foods[1].protein = 100;
  assert.equal(food.protein, 13);
  assert.throws(() => saveMeal('saved', ' ', [food]));
  assert.throws(() => saveMeal('saved', 'Breakfast', []));
});
