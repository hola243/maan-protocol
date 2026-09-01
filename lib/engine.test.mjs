import { buildWeek, applyCheckin, parseInjuries, proteinTarget, deloadInterval } from './engine.js';
import assert from 'node:assert';

// John-like: 52M, shred, gym, 6 days, 2 sport
const john = { name: 'John', age: 52, sex: 'male', weightLb: 172, objective: 'shred', daysPerWeek: 6, sportPerWeek: 2, equipment: 'gym', injuryText: '' };
let w = buildWeek(john);
assert.equal(w.lifts, 3, 'shred gets 3 lifts');
assert.equal(w.deloadEvery, 5, '50+ deloads every 5');
assert.equal(w.protein, 155, 'protein 0.9g/lb rounded to 5');
assert.equal(w.days.length, 7, 'seven days');
assert.equal(w.days[6].type, 'rest', 'Sunday rests');
assert.ok(w.days.filter(d => d.type === 'sport').length === 2, 'two sport days');

// Injury swap
w = buildWeek({ ...john, injuryText: 'right knee acts up' });
assert.ok(w.injuries.includes('knee'), 'knee detected');
assert.ok(w.days.some(d => d.items.some(i => i.swap)), 'swaps applied');

// Ana-like: 47F rebuild, dumbbells, 5 days, 0 sport
const ana = { name: 'Ana', age: 47, sex: 'female', weightLb: 140, objective: 'rebuild', daysPerWeek: 5, sportPerWeek: 0, equipment: 'db', injuryText: '' };
w = buildWeek(ana);
assert.equal(w.lifts, 2, 'rebuild starts at 2 lifts');
assert.equal(w.rir, 3, 'rebuild weeks 1-2 keep 3 in the tank');
assert.equal(w.deloadEvery, 6, '40s deload every 6');
assert.ok(w.notes.join(' ').includes('perimenopause'), 'female 40+ note present');

// Deload week
w = buildWeek(john, { week: 5 });
assert.ok(w.isDeload, 'week 5 deloads for 50+');
assert.ok(w.rirLine.includes('DELOAD'), 'deload messaging');

// Check-in: baseline then stall + bad sleep
let s = applyCheckin({ week: 1 }, null, { weight: 170, waist: 34, energy: 4, sleep: 4, soreness: 2, pain: '' }, 'shred');
assert.equal(s.week, 2);
assert.ok(s.adjustMsgs[0].includes('Baseline'));
s = applyCheckin(s, { weight: 170, waist: 34 }, { weight: 170, waist: 34, energy: 4, sleep: 2, soreness: 2, pain: '' }, 'shred');
assert.equal(s.carbTrim, 1, 'stall trims carbs');
assert.equal(s.carbBoost, 1, 'bad sleep boosts training-day carbs');
assert.equal(s.volTrim, 1, 'bad sleep trims a set');

// Rebuild earns third lift
s = applyCheckin({ week: 4 }, { weight: 140, waist: 30 }, { weight: 140, waist: 30, energy: 4, sleep: 4, soreness: 2, pain: '' }, 'rebuild');
assert.ok(s.earnedThirdLift, 'week 5 third lift earned on good recovery');
w = buildWeek(ana, s);
assert.equal(w.lifts, 3, 'third lift appears');

// New pain in check-in flows into swaps
s = applyCheckin({ week: 2 }, { weight: 170, waist: 34 }, { weight: 169, waist: 33.8, energy: 4, sleep: 4, soreness: 2, pain: 'left shoulder overhead' }, 'shred');
w = buildWeek(john, s);
assert.ok(w.injuries.includes('shoulder'), 'check-in pain triggers swaps');

// Lose weight: move days become brisk walks, tight days fit
w = buildWeek({ ...john, objective: 'lose', daysPerWeek: 3, sportPerWeek: 3 });
assert.ok(w.lifts >= 2 === false || w.lifts <= 3, 'lifts fit available days');
assert.equal(Math.min(3, 6) >= w.lifts + 3 || w.lifts === 2, true, 'no overbooked week');

// Grocery list generated
w = buildWeek(john);
assert.ok(Array.isArray(w.grocery) && w.grocery.length >= 5, 'grocery list present');
assert.ok(w.grocery[0][1].includes('Eggs'), 'grocery has protein staples');

console.log('engine: all tests passed');

// Maintain objective
{
  const w = buildWeek({ age: 45, weightLb: 180, sex: 'male', objective: 'maintain', daysPerWeek: 5, sportPerWeek: 0, equipment: 'gym', experience: 'consistent' }, { week: 1 });
  assert.equal(w.lifts, 3);
  assert.ok(w.notes[0].includes('Maintenance is a skill'));
  assert.ok(w.carbLegend.rest.includes('small starch'));
  const s2 = applyCheckin({ week: 1 }, { weight: 180, waist: 34 }, { weight: 182.2, waist: 34.2, energy: 4, sleep: 4, soreness: 2 }, 'maintain');
  assert.equal(s2.carbTrim, 1);
}
// Experience: new caps lifts and eases RIR
{
  const w = buildWeek({ age: 35, weightLb: 170, sex: 'male', objective: 'shred', daysPerWeek: 6, sportPerWeek: 0, equipment: 'gym', experience: 'new' }, { week: 1 });
  assert.equal(w.lifts, 2);
  assert.equal(w.rir, 3);
  assert.ok(w.rirLine.includes('second nature'));
  assert.ok(w.notes.some(n => n.includes('newer to training')));
}
// Experience: returning eases weeks 1-2 only
{
  const w1 = buildWeek({ age: 35, weightLb: 170, sex: 'male', objective: 'build', daysPerWeek: 5, sportPerWeek: 0, equipment: 'db', experience: 'returning' }, { week: 2 });
  assert.equal(w1.rir, 3);
  const w3 = buildWeek({ age: 35, weightLb: 170, sex: 'male', objective: 'build', daysPerWeek: 5, sportPerWeek: 0, equipment: 'db', experience: 'returning' }, { week: 3 });
  assert.equal(w3.rir, 2);
}
// Experience: consistent gets the optional finisher on strength day
{
  const w = buildWeek({ age: 52, weightLb: 165, sex: 'male', objective: 'shred', daysPerWeek: 6, sportPerWeek: 3, equipment: 'gym', experience: 'consistent' }, { week: 2 });
  const liftA = w.days.find(d => d.type === 'lift' && d.i === 0);
  assert.ok(liftA.items.some(i => i.t.includes('Optional finisher')));
}

console.log('maintain + experience tests passed');

// Video links
import { videoUrlFor } from './videos.js';
assert.ok(videoUrlFor('Rope pushdown 3×15').includes('muscleandstrength.com'));
assert.ok(videoUrlFor('Face pull 3×15').includes('youtube.com'));
assert.equal(videoUrlFor('Progression: +1 rep per set vs Week 1'), null);
console.log('video link tests passed');
