// PROTOCOL rules engine, pure functions, no I/O.
// Ported from the validated prototype; the single source of truth for plan logic.

export const INJURY_RULES = [
  { area: 'knee',       rx: /knee/i,                          hit: /squat|lunge|step-up|jump|leg press|wall sit|sprint/i, sub: 'Knee swap → hip-dominant instead: glute bridge, hip thrust, or light RDL, pain-free range only' },
  { area: 'shoulder',   rx: /shoulder|rotator/i,              hit: /overhead|push press|shoulder press|pike|lateral raise|slam|dip|bench|chest press|push-up/i, sub: 'Shoulder swap → neutral-grip floor press or row, nothing overhead this block' },
  { area: 'lower back', rx: /\bback\b|spine|disc|lumbar/i,    hit: /deadlift|rdl|hinge|swing|slam|superman|good morning/i, sub: 'Back swap → glute bridge or hip thrust with braced core, no loaded hinge this block' },
  { area: 'elbow',      rx: /elbow|tennis|golfer/i,           hit: /curl|pushdown|extension|chin-up|pulldown|pull-up/i, sub: 'Elbow swap → band pull-aparts and neutral-grip rowing, light and high-rep' },
  { area: 'wrist',      rx: /wrist/i,                         hit: /push-up|press|curl/i, sub: 'Wrist swap → neutral-grip dumbbell version, or push-up handles' },
  { area: 'hip',        rx: /\bhip\b/i,                       hit: /squat|lunge|90\/90|couch/i, sub: 'Hip swap → shorten the range (box squat height), pain-free only' },
  { area: 'ankle',      rx: /ankle|achilles/i,                hit: /jump|sprint|slam|bear crawl/i, sub: 'Ankle swap → low-impact power: bike sprints seated, no jumping' },
  { area: 'neck',       rx: /neck/i,                          hit: /overhead|slam|shrug/i, sub: 'Neck swap → keep all loads in front, nothing overhead this block' },
];

export function parseInjuries(text) {
  return INJURY_RULES.filter(j => j.rx.test(text || ''));
}

export function applyInjuries(items, injuries) {
  const swapped = new Set();
  const out = items.map(it => {
    const j = injuries.find(j => j.hit.test(it));
    if (j) { swapped.add(j.area); return { t: `${j.sub} (was: ${it})`, swap: true }; }
    return { t: it, swap: false };
  });
  return { out, swapped: [...swapped] };
}

const EXERCISES = {
  gym: {
    A: ['Goblet or front squat 3×6–8', 'Chin-up or lat pulldown 3×6–8', 'Romanian deadlift 3×8', 'Incline DB press 3×8', 'Farmer carry 3×40 steps', 'Pallof press 3×10/side'],
    B: ['Chest press 3×10–12', 'Seated cable row 3×10–12', 'Split squat or leg press 3×10/leg', 'Lateral raise 3×12–15', 'Curl + pushdown superset 3×10–12', 'Hanging knee raise 3×10'],
    C: ['Med ball slam 4×5', 'Trap bar or KB deadlift 4×5, crisp', 'Push press 3×6', 'Suitcase carry 3×30 steps/side', 'Face pull 3×15', 'Hips: couch stretch + 90/90, 5 min'],
  },
  db: {
    A: ['Goblet squat 3×8', 'One-arm DB row 3×10/side', 'DB Romanian deadlift 3×10', 'DB floor or bench press 3×8–10', 'Suitcase carry 3×30 steps/side', 'Dead bug 3×8/side'],
    B: ['DB bench or push-up 3×10–12', 'Band or DB row 3×10–12', 'Reverse lunge 3×10/leg', 'DB lateral raise 3×12–15', 'Hammer curl + overhead extension 3×10–12', 'Side plank 3×25s/side'],
    C: ['DB swing or snatch 4×6', 'DB push press 3×6', 'Step-up, fast 3×6/leg', 'Farmer carry 3×40 steps', 'Band face pull 3×15', 'Hips: couch stretch + 90/90, 5 min'],
  },
  body: {
    A: ['Tempo squat 3×10–12', 'Doorframe or towel row 3×10', 'Single-leg hip hinge 3×8/side', 'Push-up 3×max-2', 'Wall sit 3×30–45s', 'Dead bug 3×8/side'],
    B: ['Split squat 3×10/leg', 'Pike push-up 3×8', 'Glute bridge march 3×10', 'Chair dip 3×10', 'Superman hold 3×20s', 'Side plank 3×25s/side'],
    C: ['Jump squat or fast step-up 3×6', 'Explosive push-up 3×5', 'Bear crawl 3×20 steps', 'Single-leg balance reach 3×8/side', 'Hollow hold 3×20s', 'Hips: couch stretch + 90/90, 5 min'],
  },
};

const CARBS = {
  shred:   { sport: '2–3 cupped hands of carbs, most after training', lift: '1–2 cupped hands, right after lifting', move: '1 cupped hand', rest: '0–1 cupped hand: vegetables + one fruit' },
  lose:    { sport: '2 cupped hands of carbs, after training only', lift: '1 cupped hand, right after lifting', move: '0–1 cupped hand: vegetables + one fruit', rest: '0–1 cupped hand: vegetables + one fruit' },
  build:   { sport: '3–4 cupped hands of carbs, most after training', lift: '2–3 cupped hands around lifting', move: '2 cupped hands', rest: '1–2 cupped hands' },
  maintain:{ sport: '2–3 cupped hands of carbs, most after training', lift: '1–2 cupped hands around lifting', move: '1–2 cupped hands wherever you like', rest: '1 cupped hand: vegetables, a fruit, a small starch at dinner' },
  rebuild: { sport: '2 cupped hands: one after training', lift: '2 cupped hands: one after lifting, one at dinner', move: '1–2 cupped hands wherever you like', rest: '1–2 cupped hands; a carb at dinner helps sleep' },
};

const PACE = {
  shred:   'Target pace: 0.5–1 lb down per week. The tape measure is the scoreboard, not the scale.',
  lose:    'Target pace: 1–1.5 lb down per week to start. Protein stays high so what you lose is fat, not muscle.',
  build:   'Target pace: about 0.5 lb up per week with a steady waist. If the waist climbs, carbs trim first.',
  maintain:'Target pace: weight steady within about 2 lb while strength holds or climbs. Maintenance is a skill, not a pause.',
  rebuild: 'No calorie deficit for at least 4–6 weeks, rebuild first. A third lift day gets earned around week 5.',
};

export function recoveryTier(age) { return age >= 50 ? 'high' : age >= 40 ? 'mid' : 'young'; }
export function deloadInterval(age) { const t = recoveryTier(age); return t === 'high' ? 5 : t === 'mid' ? 6 : 8; }
export function proteinTarget(weightLb) { return Math.round(Math.min(weightLb, 220) * 0.9 / 5) * 5; }

export function buildWeek(profile, state = {}) {
  const { age, weightLb, sex, objective, daysPerWeek, sportPerWeek, equipment, injuryText = '', name = '', experience = 'consistent', activity = '' } = profile;
  const week = state.week || 1;
  const female = sex === 'female';
  const isRb = objective === 'rebuild';
  const cutting = objective === 'shred' || objective === 'lose';
  const experienceEasing = profile.experience === 'new' || (profile.experience === 'returning' && (state.week || 1) <= 2);
  const rir = (isRb && week <= 2) || experienceEasing ? 3 : 2;
  const deloadEvery = deloadInterval(age);
  const isDeload = week > 1 && week % deloadEvery === 0;
  const protein = proteinTarget(weightLb);
  const palms = protein >= 140 ? '4 meals with a palm-plus each' : '3–4 meals with a palm each';

  let lifts = isRb ? (week >= 5 && state.earnedThirdLift ? 3 : 2) : 3;
  if (experience === 'new' && week <= 4) lifts = Math.min(lifts, 2);
  const maxTraining = Math.min(daysPerWeek, 6);
  if (sportPerWeek + lifts > maxTraining) lifts = Math.max(2, maxTraining - sportPerWeek);
  const moveDays = Math.max(0, maxTraining - sportPerWeek - lifts);

  const carb = { ...CARBS[objective] };
  if (state.carbTrim && cutting) carb.lift = '1 cupped hand, right after lifting only (trimmed after your check-in)';
  if (state.carbBoost) carb.sport += ', plus one extra cupped hand this week (recovery boost)';

  const EX = EXERCISES[equipment];
  const liftNames = isRb
    ? ['Lift 1: Full Body A', 'Lift 2: Full Body B', 'Lift 3: Full Body C']
    : ['Lift A: Strength', 'Lift B: Pump', 'Lift C: Power'];
  const liftKeys = ['A', 'B', 'C'];

  const sportSlots = sportPerWeek === 1 ? ['Sat'] : sportPerWeek === 2 ? ['Tue', 'Thu'] : sportPerWeek === 3 ? ['Tue', 'Thu', 'Sat'] : [];
  const liftSlots = ['Mon', 'Wed', 'Fri'].slice(0, lifts);
  const slots = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => {
    if (sportSlots.includes(d)) return { d, type: 'sport' };
    if (liftSlots.includes(d)) return { d, type: 'lift', i: liftSlots.indexOf(d) };
    return { d, type: 'free' };
  });
  let movesLeft = moveDays;
  slots.forEach(x => { if (x.type === 'free') { x.type = movesLeft > 0 ? 'move' : 'off'; if (movesLeft > 0) movesLeft--; } });
  slots.push({ d: 'Sun', type: 'rest' });

  const tag = { sport: isRb ? 'MOVE BIG' : 'GREEN', lift: isRb ? 'LIFT' : 'YELLOW', move: 'MOVE', rest: isRb ? 'RESTORE' : 'RED', off: 'OFF' };
  const injuries = parseInjuries(`${injuryText} ${state.painText || ''}`);
  const allSwapped = new Set();

  const days = slots.map(x => {
    let title, raw = [];
    if (x.type === 'sport') { title = { 'jiu jitsu': 'Jiu Jitsu', yoga: 'Yoga', swim: 'Swim', run: 'Run' }[activity] || 'Fitness Activity'; raw = ['Your ' + (title.toLowerCase()) + ' session', carb.sport, 'Water + electrolytes; protein within an hour after']; }
    else if (x.type === 'lift') {
      title = liftNames[x.i];
      raw = EX[liftKeys[x.i]].slice();
      if (isDeload) raw = raw.map(i => i.replace(/([34])×/g, '2×'));
      if (week > 1 && !isDeload) raw.unshift(`Progression: +${Math.min(week - 1 - Math.floor((week - 1) / deloadEvery), 3)} rep per set vs Week 1 (then weight goes up ~5%)`);
      if (state.volTrim && !isDeload) raw.unshift('This week: one fewer set on everything (recovery flag from your check-in)');
      if (experience === 'consistent' && x.i === 0 && !isDeload && !isRb) raw.push('Optional finisher: 6 × 20s hard bike sprints, 40s easy, only if you slept 6.5+ hours');
      raw.push(carb.lift);
    }
    else if (x.type === 'move') {
      title = objective === 'lose' ? 'Move: Brisk Walk / Zone 2' : 'Move: Walk / Zone 2 / Yoga';
      raw = [objective === 'lose' ? '40–60 min brisk walk or easy cardio, the quiet fat-loss engine' : '30–45 min easy: brisk walk, easy spin, or a flow class', '10 min mobility: hips, ankles, upper back', carb.move];
    }
    else if (x.type === 'rest') { title = isRb ? 'Restorative Yoga + Check-in' : 'Full Rest + Check-in'; raw = ['Genuinely gentle: restorative yoga or a stroll', carb.rest, '2-minute check-in, it steers next week']; }
    else { title = 'Off'; raw = ['No scheduled training, steps still count']; }
    const { out, swapped } = applyInjuries(raw, injuries);
    swapped.forEach(s => allSwapped.add(s));
    return { d: x.d, type: x.type, i: x.i, title, tag: tag[x.type], items: out };
  });

  const rirLine = isDeload
    ? `DELOAD WEEK: same movements, two sets each, weights feel easy. This is where the last ${deloadEvery - 1} weeks of work actually turn into results.`
    : isRb && week <= 2
      ? 'Leave 3 reps in the tank on every set. Almost too easy is exactly right after time away.'
      : experience === 'new'
        ? 'Leave 3 reps in the tank on every set while the movements become second nature. Easy reps now buy heavy reps later.'
        : experience === 'returning' && week <= 2
          ? 'Leave 3 reps in the tank these first two weeks. Almost too easy is exactly right after time off, the normal pace starts Week 3.'
          : `Leave 1–2 reps in the tank on every set, the last grinding rep costs more than it pays${age >= 50 ? ' at ' + age : ''}.`;

  const notes = [PACE[objective]];
  const EXP_NOTES = {
    new: 'You told us you are newer to training, so the block starts with 2 lifting days and 3 reps in reserve. The third lift day and tighter margins get earned around week 5.',
    returning: 'Coming back after time away: the first two weeks run at 3 reps in reserve on purpose, then normal progression kicks in from Week 3.',
    consistent: 'You train regularly, so progression runs at full speed and your strength day carries an optional finisher.',
  };
  if (EXP_NOTES[experience]) notes.push(EXP_NOTES[experience]);
  notes.push(`Deload every ${deloadEvery}th week${recoveryTier(age) === 'high' ? ', mandatory. Any joint that complains twice in a week gets swapped, not pushed through' : ''}.`);
  if (female && age >= 40) notes.push('Strength work is your bone and muscle insurance this decade. Evening carbs can help disrupted sleep, keep alcohol rare, and if perimenopause symptoms are in the picture, loop in a physician you like.');
  if (!female && age >= 50) notes.push('Skip habitual ibuprofen for soreness, it blunts the adaptations you train for.');
  if (state.adjustMsgs?.length) notes.unshift('Adjustments this week: ' + state.adjustMsgs.join(' '));

  const stack = ['Creatine 5 g daily', 'Vitamin D3', 'Omega-3 fish oil ~2 g EPA/DHA with food', 'Magnesium glycinate at night']
    .concat(sportPerWeek > 0 ? ['Collagen 10–15 g + vitamin C, 45–60 min before sport or lifting'] : [])
    .concat(['7–8 hours of sleep, the most powerful item on this list']);

  const grocery = [
    ['Protein', ['Eggs (a dozen and a half)', 'Chicken thighs or breasts', cutting ? 'Ground turkey or lean beef' : 'Ground beef', 'Canned tuna or salmon (3–4)', 'Fresh fish or shrimp for two dinners', 'Protein powder (egg, beef, or plant isolate)'].concat(isRb ? ['Greek yogurt or cottage cheese (big tub)'] : []).join(', ')],
    ['Produce', ['Salad greens (2–3 big bags)', 'Roasting vegetables: broccoli, zucchini, peppers', 'Onions and garlic', 'Avocados (4–5)', 'Lemons', sportPerWeek > 0 ? 'Bananas (post-training)' : 'Bananas', '2–3 other pieces of fruit', 'Sweet potatoes or potatoes'].join(', ')],
    ['Carbs', ['White rice', 'Oats (small container)'].concat(objective === 'build' ? ['Extra rice or pasta for the bigger carb days'] : []).join(', ')],
    ['Pantry', ['Olive oil', 'Mixed nuts'].concat(sportPerWeek > 0 ? ['Electrolyte packets'] : []).join(', ')],
    ['Supplement check', ['Creatine', 'Vitamin D3', 'Omega-3 fish oil', 'Magnesium glycinate'].concat(sportPerWeek > 0 ? ['Collagen + vitamin C'] : []).join(', ')],
  ];

  return {
    name: (name || '').split(' ')[0], week, isDeload, deloadEvery, protein, palms, lifts, rir, rirLine,
    grocery,
    steps: objective === 'lose' ? '10k steps daily, non-negotiable, it does half the work' : '8–10k steps daily',
    days, notes, stack, carbLegend: CARBS[objective], isRebuild: isRb,
    injuries: [...allSwapped],
    plate: `1–2 palms of protein + 1–2 fists of vegetables + 1 thumb of fat, every meal, no weighing, ever. Then add carbs by the day tag. Aim for ${protein} g of protein across ${palms.toLowerCase()}.`,
  };
}

export function applyCheckin(prevState, prevEntry, entry, objective) {
  const s = { week: (prevState.week || 1) + 1, carbTrim: 0, carbBoost: 0, volTrim: 0, adjustMsgs: [], painText: entry.pain || '', earnedThirdLift: prevState.earnedThirdLift || false };
  const cutting = objective === 'shred' || objective === 'lose';
  if (prevEntry) {
    const dWt = entry.weight - prevEntry.weight;
    const dWa = entry.waist - prevEntry.waist;
    if (cutting && dWt > -0.3 && dWa >= -0.05) { s.carbTrim = 1; s.adjustMsgs.push('Progress stalled, so one cupped hand of carbs comes off lifting days.'); }
    if (cutting && dWt <= -2) s.adjustMsgs.push('Dropping fast. If this repeats next week, carbs go UP to protect muscle and energy.');
    if (objective === 'build' && dWt > 1) s.adjustMsgs.push('Gaining quicker than planned. Carbs trim on MOVE days.');
    if (objective === 'maintain') {
      if (dWt > 1.5) { s.carbTrim = 1; s.adjustMsgs.push('Weight drifting up. One cupped hand of carbs comes off easy days until it settles.'); }
      else if (dWt < -1.5) { s.carbBoost = 1; s.adjustMsgs.push('Weight drifting down. One extra cupped hand at dinner this week, maintenance means holding the line both ways.'); }
      else s.adjustMsgs.push('Holding steady. That is exactly the job.');
    }
    if (cutting && (dWa < -0.1 || dWt < -0.3)) s.adjustMsgs.push('Scoreboard moved the right way. Stay the course.');
  } else {
    s.adjustMsgs.push('Baseline logged. From next check-in the numbers drive the changes.');
  }
  if (entry.energy <= 2 || entry.sleep <= 2) { s.carbBoost = 1; s.volTrim = 1; s.adjustMsgs.push('Energy/sleep flag: extra carbs on your hardest days and one fewer set per exercise this week.'); }
  else if (entry.soreness >= 4) { s.volTrim = 1; s.adjustMsgs.push('High soreness: one fewer set per exercise this week.'); }
  if (objective === 'rebuild' && s.week >= 5 && entry.energy >= 3 && entry.soreness <= 3) { s.earnedThirdLift = true; s.adjustMsgs.push('Recovery looks good. The third lift day is earned.'); }
  if (entry.pain) s.adjustMsgs.push(`New pain noted (${entry.pain}). Affected movements are swapped.`);
  return s;
}
