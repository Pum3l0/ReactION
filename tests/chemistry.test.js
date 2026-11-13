import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMixture, computeHeated, checkShiftGoal, describeResult } from '../src/core/chem/reactionEngine.js';
import { transferContents, removeIons, extractIron } from '../src/core/chem/operations.js';
import { REAGENTS } from '../src/data/reactions.js';
import { SHIFT_TASKS } from '../src/data/shiftTasks.js';

test('all stated tasks can be completed with their available reagents', () => {
  for (const task of SHIFT_TASKS) {
    const result = task.goal.kind === 'heat' ? computeHeated(task.reagents) : computeMixture(task.reagents);
    assert.equal(checkShiftGoal(task, result).ok, true, task.id);
  }
});
test('dry salts, metals and single reagents do not form fictitious precipitates', () => {
  for (const ids of [['pbno32','ki'], ['caco3'], ['caoh2'], ['fe','naoh'], ['zn','naoh'], ['cuo','naoh']]) {
    assert.equal(computeMixture(ids).hasPrecipitate, false, ids.join('+'));
  }
  assert.equal(computeMixture(['cuso4','hcl']).reactions.some(r=>r.neutral), false);
  assert.equal(computeMixture(['caco3','hcl']).hasGas, true);
});
test('repeated ions produce one precipitate rule', () => {
  const result = computeMixture(['cuso4','cucl2','naoh']);
  assert.equal(result.reactions.filter(r=>r.formula==='Cu(OH)2').length, 1);
});
test('acid plus base cannot establish equivalence without concentration', () => {
  const result = computeMixture(['hcl','naoh','litmus']);
  assert.equal(result.medium, 'unknown');
  assert.equal(result.reactions.find(r=>r.indicator).color, null);
  assert.match(describeResult(result, result.reagentIds).at(-1).text, /не определена/);
});
test('dry coloured salt alone cannot pass dissolution', () => {
  const task = SHIFT_TASKS.find(t=>t.id==='dissolve');
  assert.equal(checkShiftGoal(task,computeMixture(['cuso4'])).ok,false);
});
test('filtering removes all precipitate ions, preserves spectators and accepts new reagent', () => {
  const contents = ['water','bacl2','na2co3'].map(id=>({id,amount:5}));
  const result = computeMixture(contents);
  removeIons(contents,result.reactions.filter(r=>r.precipitate).flatMap(r=>r.pair),REAGENTS);
  assert.equal(computeMixture(contents).hasPrecipitate,false);
  contents.push({id:'agno3',amount:5});
  assert.equal(computeMixture(contents).reactions.some(r=>r.formula==='AgCl'),true);
});
test('partial transfer preserves volume, proportions and processed ion records', () => {
  const from={contents:[{id:'water',amount:20},{id:'bacl2',amount:20,ions:['Cl']}]};
  const to={capacity:30,contents:[{id:'water',amount:10}]};
  assert.equal(transferContents(from,to),20);
  assert.deepEqual(from.contents.map(c=>c.amount),[10,10]);
  assert.equal(to.contents.reduce((n,c)=>n+c.amount,0),30);
  assert.deepEqual(to.contents[2].ions,['Cl']);
  assert.equal(transferContents(from,to),0);
});
test('magnet extracts iron only, leaving zinc and dissolved iron salts', () => {
  assert.deepEqual(extractIron(['fe','zn','fecl2'].map(id=>({id}))).map(c=>c.id),['zn','fecl2']);
});
test('heating requires an existing precipitate or a specific thermal reagent', () => {
  assert.equal(computeHeated(['cuo']).changed,false);
  assert.equal(computeHeated(['zn','naoh']).changed,false);
  assert.equal(computeHeated(['cuso4','naoh']).reactions[0].toFormula,'CuO');
  assert.equal(computeHeated([{id:'kmno4',amount:5,processed:true,ions:[]}]).changed,false);
});

test('basic copper carbonate formation includes carbon dioxide', () => {
  const result = computeMixture(['water','cuso4','na2co3']);
  assert.equal(result.hasPrecipitate,true);
  assert.equal(result.hasGas,true);
});
test('uncertain acid/base competition does not promise a hydroxide precipitate', () => {
  assert.equal(computeMixture(['cuso4','naoh','hcl']).hasPrecipitate,false);
});
