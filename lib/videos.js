// Exercise how-to video links. Partner: Muscle & Strength exercise guides
// (affiliate: 10% flat via Commission Junction, applied-for separately).
// Set AFFILIATE_PREFIX to the CJ deep-link prefix once approved and every
// link gets wrapped automatically. YouTube search is the fallback for
// movements without a verified partner page.
export const AFFILIATE_PREFIX = '';
const MS = 'https://www.muscleandstrength.com/exercises/';
const yt = q => 'https://www.youtube.com/results?search_query=how+to+' + q.replace(/[^a-z ]/gi, '').trim().replace(/ +/g, '+') + '+proper+form';
export const VIDS=[
  ['goblet',MS+'dumbbell-goblet-squat'],
  ['front squat',MS+'dumbbell-goblet-squat'],
  ['chin-up',MS+'chin-up.html'],
  ['lat pulldown',yt('lat pulldown')],
  ['band pulldown',yt('resistance band lat pulldown')],
  ['romanian deadlift',MS+'romanian-deadlift'],
  ['incline db press',MS+'incline-dumbbell-bench-press.html'],
  ['farmer carry',MS+'trap-bar-farmers-carry'],
  ['pallof',MS+'pallof-press'],
  ['chest press',MS+'dumbbell-bench-press.html'],
  ['bench press',MS+'dumbbell-bench-press.html'],
  ['seated cable row',MS+'seated-row.html'],
  ['db row',MS+'one-arm-dumbbell-row.html'],
  ['band or db row',MS+'one-arm-dumbbell-row.html'],
  ['split squat',MS+'one-leg-dumbbell-squat-aka-bulgarian-squat.html'],
  ['leg press',yt('leg press')],
  ['lateral raise',MS+'seated-dumbbell-lateral-raise.html'],
  ['hammer curl',MS+'standing-hammer-curl.html'],
  ['pushdown',MS+'rope-tricep-extension.html'],
  ['overhead extension',MS+'rope-tricep-extension.html'],
  ['hanging knee raise',MS+'hanging-leg-raise.html'],
  ['med ball slam',yt('medicine ball slam')],
  ['trap bar',MS+'trap-bar-deadlift'],
  ['push press',yt('dumbbell push press')],
  ['suitcase carry',yt('suitcase carry')],
  ['face pull',yt('cable face pull')],
  ['dead bug',MS+'dead-bug'],
  ['reverse lunge',MS+'dumbbell-lunge.html'],
  ['walking lunge',MS+'dumbbell-walking-lunge.html'],
  ['step-up',MS+'dumbbell-step-up.html'],
  ['pull-up',MS+'pull-up'],
  ['pike push-up',yt('pike push up')],
  ['push-up',yt('push up')],
  ['towel row',MS+'high-inverted-row.html'],
  ['inverted',MS+'high-inverted-row.html'],
  ['glute bridge',yt('glute bridge')],
  ['hip thrust',yt('hip thrust')],
  ['side plank',yt('side plank')],
  ['plank',yt('plank')],
  ['dip',yt('bench dip')],
  ['swing or snatch',yt('dumbbell swing')],
  ['single-leg hip hinge',yt('single leg romanian deadlift')],
  ['wall sit',yt('wall sit')],
  ['superman',yt('superman hold exercise')],
  ['hollow hold',yt('hollow body hold')],
  ['bear crawl',yt('bear crawl')],
  ['mountain climbers',yt('mountain climbers')],
  ['jump squat',yt('jump squat')],
  ['squat thrust',yt('squat thrust no jump')],
  ['tempo squat',yt('tempo bodyweight squat')],
  ['single-leg balance',yt('single leg balance reach')],
  ['bodyweight squat',yt('bodyweight squat')]
];
export function videoUrlFor(itemText) {
  const low = itemText.toLowerCase();
  if (low.startsWith('progression') || low.startsWith('this week') || low.startsWith('optional finisher')) return null;
  const hit = VIDS.find(v => low.includes(v[0]));
  if (!hit) return null;
  return AFFILIATE_PREFIX ? AFFILIATE_PREFIX + encodeURIComponent(hit[1]) : hit[1];
}
