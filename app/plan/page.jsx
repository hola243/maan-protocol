'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { buildWeek, applyCheckin } from '@/lib/engine';
import { videoUrlFor } from '@/lib/videos';

const DOT = { sport: 'var(--green)', lift: 'var(--yellow)', move: 'var(--move)', rest: 'var(--red)', off: '#9aa0a6' };

export default function PlanPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [plan, setPlan] = useState(null);
  const [showCheckin, setShowCheckin] = useState(false);
  const [ci, setCi] = useState({ weight: '', waist: '', energy: '', sleep: '', soreness: '', pain: '' });
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { router.replace('/'); return; }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', u.user.id).maybeSingle();
    if (!p) { router.replace('/onboard'); return; }
    const { data: cs } = await supabase.from('checkins').select('*').eq('user_id', u.user.id).order('created_at');
    setProfile(p);
    setCheckins(cs || []);
    setPlan(buildWeek(toEngineProfile(p), p.state || { week: 1 }));
  }, [router]);

  useEffect(() => { load(); }, [load]);

  function toEngineProfile(p) {
    return {
      name: p.name, age: p.age, sex: p.sex, weightLb: +p.weight_lb, objective: p.objective,
      daysPerWeek: p.days_per_week, sportPerWeek: p.sport_per_week, equipment: p.equipment, experience: p.experience || 'consistent', injuryText: p.injury_text,
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
    const newState = applyCheckin(profile.state || { week: 1 }, prevEntry, entry, profile.objective);
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

  if (!plan) return <header><h1>Loading</h1></header>;

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

  return (
    <>
      <header>
        <div className="kicker">Protocol by MAAN.life · {plan.name}</div>
        <h1>Week {plan.week}{plan.isDeload ? ' · DL' : ''}</h1>
        <div className="sub">{fmt(mon)} – {fmt(sun)}, {sun.getFullYear()} · {phase}</div>
        <div className="sub">
          Adjusts every week from your Sunday check-in.{profile.slack_daily && profile.slack_handle ? ` Daily plan to ${profile.slack_handle} on Slack.` : ''} {' '}
          <a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => router.push('/onboard')}>Edit profile</a>{' · '}
          <a style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={signOut}>Sign out</a>
        </div>
      </header>

      <div className="tiles">
        <div className="tile"><div className="label">Lifting</div><div className="value">{plan.lifts} {plan.lifts === 1 ? 'DAY' : 'DAYS'}</div><div className="hint">{liftDayNames}</div></div>
        <div className="tile"><div className="label">Sport</div><div className="value">{sportDays.length} {sportDays.length === 1 ? 'DAY' : 'DAYS'}</div><div className="hint">{sportDays.map(d => d.d).join(' · ') || 'add one anytime'}</div></div>
        <div className="tile"><div className="label">Full rest</div><div className="value">SUNDAY</div><div className="hint">{plan.isRebuild ? 'restorative yoga + check-in' : 'rest + check-in'}</div></div>
        <div className="tile"><div className="label">Target pace</div><div className="value">{paceTile[0]}</div><div className="hint">{paceTile[1]}</div></div>
      </div>

      {dW !== null && (
        <div className="tiles">
          <div className="tile"><div className="label">Weight change</div><div className={`value ${+dW <= 0 ? 'up' : 'down'}`}>{+dW > 0 ? '+' : ''}{dW} LB</div><div className="hint">since first check-in</div></div>
          <div className="tile"><div className="label">Waist change</div><div className={`value ${+dWa <= 0 ? 'up' : 'down'}`}>{+dWa > 0 ? '+' : ''}{dWa} IN</div><div className="hint">the honest scoreboard</div></div>
          <div className="tile"><div className="label">Check-ins</div><div className="value">{checkins.length}</div><div className="hint">weeks logged</div></div>
        </div>
      )}

      <div className="wkstrip">
        {plan.days.map(x => (
          <div key={x.d} className="wkday" onClick={() => document.getElementById(`day-${x.d}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            <div className="d">{x.d}</div>
            <div className="t">{plan.isDeload && x.type === 'lift' ? 'Deload' : x.type === 'lift' ? (plan.isRebuild ? `Lift ${x.i + 1}` : ['Lift A', 'Lift B', 'Lift C'][x.i]) : x.type === 'sport' ? 'Sport' : x.type === 'move' ? 'Move' : x.type === 'rest' ? (plan.isRebuild ? 'Restore' : 'Rest') : 'Off'}</div>
            <div className="dot" style={{ background: DOT[x.type] }} />
          </div>
        ))}
      </div>

      <div className="note">{plan.name}, here&apos;s Week {plan.week}. {plan.rirLine} Protein target: {plan.protein} g/day ({plan.palms.toLowerCase()}). {plan.steps}.</div>

      {plan.injuries.length > 0 && (
        <div className="card">
          <h3>Adjusted for your injuries</h3>
          <p className="muted">Working around: {plan.injuries.join(', ')}. Swapped movements are marked in orange. Pain-free range only; anything new goes in Sunday&apos;s check-in. Persistent pain is physician territory.</p>
        </div>
      )}

      {plan.days.map(x => (
        <div key={x.d} className="card day" id={`day-${x.d}`}>
          <div className="when"><div className="dow">{x.d}</div></div>
          <div className="body">
            <h3>{x.title} <span className="pill"><span className="pdot" style={{ background: DOT[x.type] }} />{x.tag} day</span></h3>
            <ul>{x.items.map((i, k) => {
              const vid = x.type === 'lift' ? videoUrlFor(i.t) : null;
              return <li key={k} className={i.swap ? 'swap' : ''}>{i.t}{vid && <> <a className="vid" href={vid} target="_blank" rel="noopener sponsored">Video</a></>}</li>;
            })}</ul>
          </div>
        </div>
      ))}

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
        <button className="btn ghost" style={{ marginLeft: 0 }} onClick={printGrocery}>Print / Save as PDF</button>
      </div>
      <div className="card line">
        <h3>How this plan adjusts</h3>
        <p className="muted">{plan.notes.join(' ')}</p>
      </div>

      {!showCheckin ? (
        <button className="btn accent" onClick={() => setShowCheckin(true)}>Sunday check-in</button>
      ) : (
        <div className="card">
          <h3>Sunday check-in: 2 minutes</h3>
          <div className="grid2">
            <div><label>Morning weight, 2–3 day avg (lb)</label><input type="number" step="0.1" value={ci.weight} onChange={e => setCi({ ...ci, weight: e.target.value })} /></div>
            <div><label>Waist at navel (in)</label><input type="number" step="0.1" value={ci.waist} onChange={e => setCi({ ...ci, waist: e.target.value })} /></div>
            <div><label>Energy (1–5)</label><select value={ci.energy} onChange={e => setCi({ ...ci, energy: e.target.value })}><option value="">–</option>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></div>
            <div><label>Sleep (1–5)</label><select value={ci.sleep} onChange={e => setCi({ ...ci, sleep: e.target.value })}><option value="">–</option>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></div>
            <div><label>Soreness (1–5)</label><select value={ci.soreness} onChange={e => setCi({ ...ci, soreness: e.target.value })}><option value="">–</option>{[1, 2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></div>
            <div><label>New pain this week?</label><input value={ci.pain} onChange={e => setCi({ ...ci, pain: e.target.value })} placeholder="blank if none" /></div>
          </div>
          <button className="btn accent" onClick={submitCheckin}>Generate next week</button>
          <button className="btn ghost" onClick={() => setShowCheckin(false)}>Cancel</button>
          {err && <div className="err">{err}</div>}
        </div>
      )}
    </>
  );
}
