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

test('presentation reagents are first and produce only white barium sulfate in either order', async () => {
  const { allReagentIds, DEMO_REAGENT_IDS } = await import('../src/data/reactions.js');
  const { pickShiftTask } = await import('../src/data/shiftTasks.js');
  assert.deepEqual(allReagentIds().slice(0,2), DEMO_REAGENT_IDS);
  for (const ids of [DEMO_REAGENT_IDS, [...DEMO_REAGENT_IDS].reverse()]) {
    const result=computeMixture(ids);
    assert.equal(result.aqueous,true);
    const precipitates=result.reactions.filter(r=>r.precipitate);
    assert.equal(precipitates.length,1);
    assert.equal(precipitates[0].formula,'BaSO4');
    assert.equal(precipitates[0].color,0xf2f2ee);
    assert.equal(result.hasGas,false);
    assert.equal(checkShiftGoal(pickShiftTask([]),result).ok,true);
  }
  for(const id of DEMO_REAGENT_IDS) assert.equal(computeMixture([id]).hasPrecipitate,false);
  assert.equal(pickShiftTask([]).id,'demo-baso4');
  assert.notEqual(pickShiftTask(['demo-baso4']).id,'demo-baso4');
});
test('metal-acid scenarios are limited to supported nonoxidizing acid', () => {
  for(const metal of ['mg','zn','fe']) {
    assert.ok(computeMixture([metal,'hcl']).reactions.some(r=>r.product==='H2'));
    assert.equal(computeMixture([metal,'hno3']).hasGas,false);
  }
  assert.equal(computeMixture(['cu','hcl']).hasGas,false);
  assert.equal(computeMixture(['water','mg']).hasGas,false);
});
test('metal displacement requires aqueous ions and is distinct from precipitation', () => {
  for(const metal of ['mg','zn','fe']) {
    const r=computeMixture([metal,'water','cuso4']);
    assert.ok(r.reactions.some(r=>r.deposit&&r.formula==='Cu'));
    assert.equal(r.hasPrecipitate,false);
    assert.equal(computeMixture([metal,'cuso4']).reactions.some(r=>r.deposit),false);
  }
  assert.ok(computeMixture(['cu','water','agno3']).reactions.some(r=>r.deposit&&r.formula==='Ag'));
  assert.equal(computeMixture([{id:'fe'}, {id:'water'}, {id:'cuso4',ions:['SO4']}]).reactions.some(r=>r.deposit),false);
});
test('iron and sulfur require heat; processed iron is not extracted as filings', () => {
  assert.equal(computeMixture(['fe','sulfur']).reactions.length,0);
  assert.equal(computeHeated(['fe','sulfur']).reactions[0].toFormula,'FeS');
  assert.equal(computeHeated(['fe']).changed,false);
  assert.equal(computeHeated(['sulfur']).changed,false);
  assert.equal(computeHeated(['water','fe','sulfur']).changed,false);
  assert.deepEqual(extractIron([{id:'fe',processed:true},{id:'fe'}]),[{id:'fe',processed:true}]);
});
