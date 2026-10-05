'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { buildWeek, applyCheckin } from '@/lib/engine';
import { videoUrlFor } from '@/lib/videos';

const DOT = { sport: 'var(--green)', lift: 'var(--yellow)', move: 'var(--move)', rest: 'var(--red)', off: '#9aa0a6' };

// Program week anchored to a start date, so the dashboard tracks the calendar
// (same basis as the Slack feed) instead of only advancing on in-app check-ins.
function programWeekFrom(startISO) {
  if (!startISO) return null;
  const start = new Date(startISO);
  if (isNaN(start)) return null;
  const days = Math.floor((Date.now() - start.getTime()) / 86400000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

// Small, dependency-free line chart. One y-axis per chart (never dual-axis):
// series sharing this chart must share a scale. Renders on a white card.
function TrendChart({ series, unit, decimals = 1, height = 150 }) {
  const [hover, setHover] = useState(null);
  const W = 320, H = height, padL = 34, padR = 12, padT = 12, padB = 22;
  const n = series[0].data.length;
  const allV = series.flatMap(s => s.data.map(d => d.v));
  let lo = Math.min(...allV), hi = Math.max(...allV);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
  const x = i => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const fmt = v => v.toFixed(decimals);
  const ticks = [hi, (hi + lo) / 2, lo];

  return (
    <div style={{ marginTop: 6 }}>
      {series.length > 1 && (
        <div style={{ display: 'flex', gap: 16, margin: '2px 0 6px', flexWrap: 'wrap' }}>
          {series.map(s => (
            <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--card-ink2)', fontWeight: 700 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }} />{s.name}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let idx = 0, best = Infinity;
          for (let i = 0; i < n; i++) { const d = Math.abs(x(i) - px); if (d < best) { best = d; idx = i; } }
          setHover(idx);
        }}>
        {ticks.map((t, k) => (
          <g key={k}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--card-line)" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="9.5" fill="var(--card-ink3)">{fmt(t)}</text>
          </g>
        ))}
        {hover != null && n > 1 && (
          <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--card-ink3)" strokeWidth="1" strokeDasharray="3 3" />
        )}
        {series.map(s => {
          const path = s.data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.v)}`).join(' ');
          const lastI = n - 1;
          return (
            <g key={s.name}>
              <path d={path} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {s.data.map((d, i) => (
                <circle key={i} cx={x(i)} cy={y(d.v)} r={hover === i ? 4.5 : 3} fill={s.color}
                  stroke="#fff" strokeWidth={hover === i ? 1.5 : 1} />
              ))}
              <text x={x(lastI)} y={y(s.data[lastI].v) - 10} textAnchor="end" fontSize="10.5" fontWeight="800" fill={s.color}
                stroke="#fff" strokeWidth="3" style={{ paintOrder: 'stroke' }}>
                {fmt(s.data[lastI].v)}{unit ? ` ${unit}` : ''}
              </text>
            </g>
          );
        })}
        <text x={padL} y={H - 6} textAnchor="start" fontSize="9.5" fill="var(--card-ink3)">{series[0].data[0].label}</text>
        <text x={W - padR} y={H - 6} textAnchor="end" fontSize="9.5" fill="var(--card-ink3)">{series[0].data[n - 1].label}</text>
        {hover != null && (
          <text x={Math.min(Math.max(x(hover), padL + 30), W - padR - 30)} y={padT - 2} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--card-ink)"
            stroke="#fff" strokeWidth="3" style={{ paintOrder: 'stroke' }}>
            {series.map(s => `${series.length > 1 ? s.name[0] + ' ' : ''}${fmt(s.data[hover].v)}`).join('   ')}
          </text>
        )}
      </svg>
    </div>
  );
}

const ICON = {
  today: <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3.9" fill="currentColor" stroke="none" /><path d="M12 3.2v2.4M12 18.4v2.4M3.2 12h2.4M18.4 12h2.4M5.8 5.8l1.7 1.7M16.5 16.5l1.7 1.7M18.2 5.8l-1.7 1.7M7.5 16.5l-1.7 1.7" /></svg>,
  plan: <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="12" x2="22" y2="12" /><rect x="2.6" y="5" width="3" height="14" rx="1.2" fill="currentColor" stroke="none" /><rect x="6.3" y="7.3" width="2.3" height="9.4" rx="1" fill="currentColor" stroke="none" /><rect x="15.4" y="7.3" width="2.3" height="9.4" rx="1" fill="currentColor" stroke="none" /><rect x="18.4" y="5" width="3" height="14" rx="1.2" fill="currentColor" stroke="none" /></svg>,
  nutrition: <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 4v4M7.3 4v4M9.1 4v4" /><path d="M5.5 8h3.6" /><path d="M7.3 8V20" /><path d="M16 4C13.3 5.3 13.3 10.3 16 12Z" fill="currentColor" stroke="currentColor" /><path d="M16 12V20" /></svg>,
  progress: <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="3.2" y1="18.4" x2="20.8" y2="18.4" /><rect x="4.6" y="12.3" width="3.4" height="6.1" rx="1" fill="currentColor" stroke="none" /><rect x="10.3" y="8.7" width="3.4" height="9.7" rx="1" fill="currentColor" stroke="none" /><rect x="16" y="5.1" width="3.4" height="13.3" rx="1" fill="currentColor" stroke="none" /></svg>,
};
const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'plan', label: 'Plan' },
  { id: 'nutrition', label: 'Food' },
  { id: 'progress', label: 'Progress' },
];

export default function PlanPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [plan, setPlan] = useState(null);
  const [showCheckin, setShowCheckin] = useState(false);
  const [ci, setCi] = useState({ weight: '', waist: '', energy: '', sleep: '', soreness: '', pain: '' });
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('today');
  const [menu, setMenu] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { router.replace('/'); return; }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', u.user.id).maybeSingle();
    if (!p) { router.replace('/onboard'); return; }
    const { data: cs } = await supabase.from('checkins').select('*').eq('user_id', u.user.id).order('created_at');
    setProfile(p);
    setCheckins(cs || []);
    const wk = programWeekFrom(p.program_start || p.created_at) || (p.state?.week || 1);
    setPlan(buildWeek(toEngineProfile(p), { ...(p.state || {}), week: wk }));
  }, [router]);

  useEffect(() => { load(); }, [load]);

  function toEngineProfile(p) {
    return {
      name: p.name, age: p.age, sex: p.sex, weightLb: +p.weight_lb, objective: p.objective,
      daysPerWeek: p.days_per_week, sportPerWeek: p.sport_per_week, activity: p.activity_type || '', equipment: p.equipment, experience: p.experience || 'consistent', injuryText: p.injury_text,
      schedule: p.schedule || null,
    };
  }

  async function submitCheckin() {
    setErr('');
    if (!ci.weight || !ci.waist || !ci.energy || !ci.sleep || !ci.soreness) {
      setErr('Weight, waist, energy, sleep, and soreness are needed to adjust the plan.');
      return;
    }
    const entry = { weight: +ci.weight, waist: +ci.waist, energy: +ci.energy, sleep: +ci.sleep, soreness: +ci.soreness, pain: ci.pain.trim() };
    const prevEntry = checkins.length ? {
      weight: +checkins[checkins.length - 1].weight, waist: +checkins[checkins.length - 1].waist,
    } : null;
    const wk = programWeekFrom(profile.program_start || profile.created_at) || (profile.state?.week || 1);
    const newState = applyCheckin(profile.state || { week: 1 }, prevEntry, entry, profile.objective);
    newState.week = wk + 1; // keep state aligned with the calendar-anchored week
    const { error: e1 } = await supabase.from('checkins').insert({ user_id: profile.id, ...entry });
    const { error: e2 } = await supabase.from('profiles').update({ state: newState }).eq('id', profile.id);
    if (e1 || e2) { setErr((e1 || e2).message); return; }
    setCi({ weight: '', waist: '', energy: '', sleep: '', soreness: '', pain: '' });
    setShowCheckin(false);
    load();
  }

  async function signOut() { await supabase.auth.signOut(); router.replace('/'); }

  function printGrocery() {
    if (!plan?.grocery) return;
    const w = window.open('', '_blank');
    const rows = plan.grocery.map(g => '<h2>' + g[0] + '</h2><ul>' + g[1].split(', ').map(i => '<li><span class="box"></span>' + i + '</li>').join('') + '</ul>').join('');
    w.document.write('<html><head><title>Grocery list, Week ' + plan.week + '</title><style>'
      + 'body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;margin:40px;line-height:1.5}'
      + 'h1{font-size:22px;margin-bottom:2px} .sub{color:#666;font-size:13px;margin-bottom:20px}'
      + 'h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:#444;margin:18px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px}'
      + 'ul{list-style:none;margin:0;padding:0} li{font-size:14px;margin:5px 0;display:flex;align-items:center;gap:9px}'
      + '.box{display:inline-block;width:13px;height:13px;border:1.5px solid #555;border-radius:3px;flex:none}'
      + '.foot{margin-top:26px;color:#999;font-size:11px}'
      + '</style></head><body>'
      + '<h1>Grocery list</h1><div class="sub">PROTOCOL by MAAN.life · ' + plan.name + ' · Week ' + plan.week + '</div>'
      + rows
      + '<div class="foot">Covers one person for the week. Adjust to appetite; skip what is already in the kitchen.</div>'
      + '</body></html>');
    w.document.close();
    w.focus();
    w.print();
  }

  if (!plan) return <div className="planapp"><main className="screen"><h1 className="scr-h1" style={{ padding: '30px 0' }}>Loading…</h1></main></div>;

  const mon = new Date(); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = d => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const phase = plan.isDeload ? 'Deload: recover on purpose' : plan.week === 1 ? 'Base: learn the rhythm' : 'Build: one more rep';
  const liftDayNames = plan.days.filter(d => d.type === 'lift').map(d => d.d).join(' · ') || 'None';
  const sportDays = plan.days.filter(d => d.type === 'sport');
  const paceTile = { shred: ['0.5–1 LB', 'down per week'], lose: ['1–1.5 LB', 'down per week'], build: ['+0.5 LB', 'up per week, waist steady'], rebuild: ['REBUILD', 'strength before any deficit'] }[profile.objective];

  const first = checkins[0], last = checkins[checkins.length - 1];
  const dW = first && last && checkins.length > 1 ? (last.weight - first.weight).toFixed(1) : null;
  const dWa = first && last && checkins.length > 1 ? (last.waist - first.waist).toFixed(1) : null;

  const todayIdx = (new Date().getDay() + 6) % 7;
  const todayDay = plan.days[todayIdx] || plan.days[0];
  const isSunday = todayIdx === 6;
  const initials = (plan.name || 'You').slice(0, 1).toUpperCase();

  const wkLabel = x => plan.isDeload && x.type === 'lift' ? 'Deload' : x.type === 'lift' ? (plan.isRebuild ? `Lift ${x.i + 1}` : ['Lift A', 'Lift B', 'Lift C'][x.i]) : x.type === 'sport' ? 'Sport' : x.type === 'move' ? 'Move' : x.type === 'rest' ? (plan.isRebuild ? 'Restore' : 'Rest') : 'Off';

  const renderDay = (x, today = false) => (
    <div key={x.d} className={`card day${today ? ' istoday' : ''}`} id={`day-${x.d}`}>
      <div className="when"><div className="dow">{x.d}</div>{today && <span className="todaytag">Today</span>}</div>
      <div className="body">
        <h3>{x.title} <span className="pill"><span className="pdot" style={{ background: DOT[x.type] }} />{x.tag} day</span></h3>
        <ul>{x.items.map((i, k) => {
          const vid = x.type === 'lift' ? videoUrlFor(i.t) : null;
          return <li key={k} className={i.swap ? 'swap' : ''}>{i.t}{vid && <> <a className="vid" href={vid} target="_blank" rel="noopener sponsored">Video</a></>}</li>;
        })}</ul>
        {x.meals && (
          <div className="meals">
            <div className="meals-head">Meals</div>
            <div className="meal"><span className="ml">Breakfast</span><span>{x.meals.breakfast}</span></div>
            <div className="meal"><span className="ml">Lunch</span><span>{x.meals.lunch}</span></div>
            <div className="meal"><span className="ml">Dinner</span><span>{x.meals.dinner}</span></div>
            <div className="meal-carb">{x.meals.carbNote}</div>
          </div>
        )}
      </div>
    </div>
  );

  const wkStrip = (jump) => (
    <div className="wkstrip">
      {plan.days.map(x => (
        <div key={x.d} className={`wkday${x.d === todayDay.d ? ' now' : ''}`} onClick={() => jump(x.d)}>
          <div className="d">{x.d}</div>
          <div className="t">{wkLabel(x)}</div>
          <div className="dot" style={{ background: DOT[x.type] }} />
        </div>
      ))}
    </div>
  );

  const checkinCard = (
    <div className="card">
      <h3>Sunday check-in: 2 minutes</h3>
      <p className="small" style={{ marginTop: 0 }}>Waist and weight drive your plan and your progress charts. Same spot at the navel, relaxed, morning.</p>
      <div className="grid2">
        <div><label>Morning weight, 2–3 day avg (lb)</label><input type="number" step="0.1" value={ci.weight} onChange={e => setCi({ ...ci, weight: e.target.value })} /></div>
        <div><label>Waist at navel (in)</label><input type="number" step="0.1" value={ci.waist} onChange={e => setCi({ ...ci, waist: e.target.value })} /></div>
        <div><label>Energy (1–5)</label><select value={ci.energy} onChange={e => setCi({ ...ci, energy: e.target.value })}><option value="">–</option>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></div>
        <div><label>Sleep (1–5)</label><select value={ci.sleep} onChange={e => setCi({ ...ci, sleep: e.target.value })}><option value="">–</option>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></div>
        <div><label>Soreness (1–5)</label><select value={ci.soreness} onChange={e => setCi({ ...ci, soreness: e.target.value })}><option value="">–</option>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></div>
        <div><label>New pain this week?</label><input value={ci.pain} onChange={e => setCi({ ...ci, pain: e.target.value })} placeholder="blank if none" /></div>
      </div>
      <button className="btn accent block" onClick={submitCheckin}>Generate next week</button>
      <button className="btn ghost block" onClick={() => setShowCheckin(false)}>Cancel</button>
      {err && <div className="err">{err}</div>}
    </div>
  );

  const progressCard = (
    <div className="card">
      <h3>Your progress</h3>
      {checkins.length < 2 ? (
        <p className="muted">Log two Sunday check-ins and your trend lines show up here. Waist is the one that counts, so measure the same spot at the navel each week.</p>
      ) : (() => {
        const lab = c => new Date(c.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        const waist = [{ name: 'Waist', color: '#0d9488', data: checkins.map(c => ({ v: +c.waist, label: lab(c) })) }];
        const weight = [{ name: 'Weight', color: '#d97706', data: checkins.map(c => ({ v: +c.weight, label: lab(c) })) }];
        const feel = [
          { name: 'Energy', color: '#0d9488', data: checkins.map(c => ({ v: +c.energy, label: lab(c) })) },
          { name: 'Sleep', color: '#7c3aed', data: checkins.map(c => ({ v: +c.sleep, label: lab(c) })) },
        ];
        return (
          <>
            <div className="chart-block"><div className="chart-cap">Waist · inches <span>the honest scoreboard</span></div><TrendChart series={waist} unit="in" /></div>
            <div className="chart-block"><div className="chart-cap">Morning weight · lb</div><TrendChart series={weight} unit="lb" /></div>
            <div className="chart-block"><div className="chart-cap">How you felt · 1–5</div><TrendChart series={feel} decimals={0} height={130} /></div>
            <p className="small">Each point is a Sunday check-in. Hover a line to read the week&apos;s number.</p>
          </>
        );
      })()}
    </div>
  );

  return (
    <div className="planapp">
      <div className="appbar">
        <div className="ab-left">
          <span className="ab-brand">Protocol</span>
          <span className="ab-week">Week {plan.week}{plan.isDeload ? ' · DL' : ''}</span>
        </div>
        <button className="ab-avatar" onClick={() => setMenu(m => !m)} aria-label="Account menu">{initials}</button>
        {menu && (
          <div className="ab-menu" onMouseLeave={() => setMenu(false)}>
            <button onClick={() => { setMenu(false); router.push('/onboard'); }}>Edit profile</button>
            <button onClick={() => { setMenu(false); signOut(); }}>Sign out</button>
          </div>
        )}
      </div>

      <main className="screen">
        {tab === 'today' && (
          <>
            <div className="today-hero">
              <div className="kicker">{plan.name}, here&apos;s your week</div>
              <h1 className="scr-h1">Week {plan.week}{plan.isDeload ? ' · Deload' : ''}</h1>
              <div className="sub">{fmt(mon)} – {fmt(sun)}, {sun.getFullYear()}</div>
              <div className="sub accentline">{phase}</div>
            </div>

            {isSunday && !showCheckin && (
              <button className="btn accent block big" onClick={() => setShowCheckin(true)}>It&apos;s Sunday — do your 2-minute check-in</button>
            )}
            {showCheckin && checkinCard}

            <div className="sec-label">Today&apos;s session</div>
            {renderDay(todayDay, true)}

            <div className="note">{plan.rirLine} Protein target: {plan.protein} g/day ({plan.palms.toLowerCase()}). {plan.steps}.</div>

            <div className="sec-label">Your week</div>
            {wkStrip(d => { setTab('plan'); setTimeout(() => document.getElementById(`day-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); })}

            {!isSunday && !showCheckin && (
              <button className="btn ghost block" onClick={() => { setShowCheckin(true); setTab('progress'); }}>Log a check-in</button>
            )}
          </>
        )}

        {tab === 'plan' && (
          <>
            <div className="sec-label first">This week at a glance</div>
            <div className="tiles">
              <div className="tile"><div className="label">Lifting</div><div className="value">{plan.lifts} {plan.lifts === 1 ? 'DAY' : 'DAYS'}</div><div className="hint">{liftDayNames}</div></div>
              <div className="tile"><div className="label">Sport</div><div className="value">{sportDays.length} {sportDays.length === 1 ? 'DAY' : 'DAYS'}</div><div className="hint">{sportDays.map(d => d.d).join(' · ') || 'add one anytime'}</div></div>
              <div className="tile"><div className="label">Full rest</div><div className="value">SUN</div><div className="hint">{plan.isRebuild ? 'restorative yoga' : 'rest + check-in'}</div></div>
              <div className="tile"><div className="label">Target pace</div><div className="value">{paceTile[0]}</div><div className="hint">{paceTile[1]}</div></div>
            </div>

            {wkStrip(d => document.getElementById(`day-${d}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))}

            {plan.injuries.length > 0 && (
              <div className="card">
                <h3>Adjusted for your injuries</h3>
                <p className="muted">Working around: {plan.injuries.join(', ')}. Swapped movements are marked in orange. Pain-free range only; anything new goes in Sunday&apos;s check-in. Persistent pain is physician territory.</p>
              </div>
            )}

            <div className="sec-label">Daily sessions</div>
            {plan.days.map(x => renderDay(x, x.d === todayDay.d))}

            <div className="card line">
              <h3>How this plan adjusts</h3>
              <p className="muted">{plan.notes.join(' ')}</p>
            </div>
          </>
        )}

        {tab === 'nutrition' && (
          <>
            <div className="sec-label first">Eat with your hands</div>
            <div className="card">
              <h3>Your plate, every meal</h3>
              <p className="muted">{plan.plate}</p>
            </div>
            <div className="card">
              <h3>Hand portions, translated</h3>
              <p className="muted"><b>Palm of protein:</b> a piece the size and thickness of your palm, roughly 25 to 30 g of protein. Chicken, fish, lean beef, eggs, Greek yogurt, tofu.</p>
              <p className="muted"><b>Fist of vegetables:</b> about one cup. Broccoli, peppers, greens, zucchini, anything colorful.</p>
              <p className="muted"><b>Cupped hand of carbs:</b> what fits in one cupped hand, about half a cup cooked, or 20 to 30 g of carbs. Best picks: white or brown rice, potatoes, sweet potatoes, oats, quinoa, beans and lentils, and whole fruit. Save the starchy ones for the meal right after training, and skip liquid carbs like juice and soda.</p>
              <p className="muted"><b>Thumb of fat:</b> the size of your whole thumb, about one tablespoon. Olive oil, nuts and nut butter, avocado.</p>
              <p className="small">Your hand scales with your body, so portions scale automatically. No scale, no measuring cups. How-to videos link to Muscle &amp; Strength exercise guides; Protocol may earn a commission on purchases there.</p>
            </div>
            <div className="card">
              <h3>Daily stack</h3>
              <p className="muted">{plan.stack.join(' · ')}. Run new supplements past your physician.</p>
            </div>
            <div className="card">
              <h3>Grocery list for the week</h3>
              <p className="small">Built from your plan. Covers one person; adjust to appetite and skip what&apos;s already in the kitchen.</p>
              <p className="muted">{plan.grocery.map(g => g[0] + ': ' + g[1]).join('. ')}</p>
              <button className="btn ghost block" onClick={printGrocery}>Print / Save as PDF</button>
            </div>
          </>
        )}

        {tab === 'progress' && (
          <>
            <div className="sec-label first">Your numbers</div>
            {dW !== null ? (
              <div className="tiles">
                <div className="tile"><div className="label">Weight change</div><div className={`value ${+dW <= 0 ? 'up' : 'down'}`}>{+dW > 0 ? '+' : ''}{dW} LB</div><div className="hint">since first check-in</div></div>
                <div className="tile"><div className="label">Waist change</div><div className={`value ${+dWa <= 0 ? 'up' : 'down'}`}>{+dWa > 0 ? '+' : ''}{dWa} IN</div><div className="hint">the honest scoreboard</div></div>
                <div className="tile"><div className="label">Check-ins</div><div className="value">{checkins.length}</div><div className="hint">weeks logged</div></div>
              </div>
            ) : (
              <p className="muted small" style={{ marginTop: 4 }}>Log two check-ins to see your change since week one.</p>
            )}

            {progressCard}

            <div className="sec-label">Weekly check-in</div>
            {showCheckin ? checkinCard : (
              <button className="btn accent block big" onClick={() => setShowCheckin(true)}>{isSunday ? "It's Sunday — start your check-in" : 'Start a check-in'}</button>
            )}
          </>
        )}

        <div className="appfoot">PROTOCOL by MAAN.life · rules-based engine · not medical advice. Clear new programs with your physician.</div>
      </main>

      <nav className="tabbar">
        <div className="tabrow">
          {TABS.map(t => (
            <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => { setTab(t.id); window.scrollTo(0, 0); }}>
              <span className="tabicon">{ICON[t.id]}</span>
              <span className="tablabel">{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
