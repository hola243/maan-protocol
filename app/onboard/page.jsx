'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const OBJECTIVES = [['shred', 'Shred'], ['lose', 'Lose weight'], ['build', 'Build'], ['maintain', 'Maintain'], ['rebuild', 'Ease back']];
const EXPERIENCE = [['new', 'New to it'], ['returning', 'Been a while'], ['consistent', 'Train regularly']];
const EQUIPMENT = [['gym', 'Full gym'], ['db', 'DBs + bands'], ['body', 'Bodyweight']];
const ACTIVITIES = [['jiu jitsu', 'Jiu Jitsu'], ['yoga', 'Yoga'], ['swim', 'Swim'], ['run', 'Run']];

export default function OnboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [f, setF] = useState({ age: '', ft: '', in: '', weight: '', sex: null, objective: null, days: 6, sport: 2, activity: null, equipment: null, experience: null, injuries: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/'); return; }
      setUser(data.user);
      supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle().then(({ data: p }) => {
        if (p) setF({
          age: p.age, ft: Math.floor(p.height_in / 12), in: p.height_in % 12, weight: p.weight_lb,
          sex: p.sex, objective: p.objective, days: p.days_per_week, sport: p.sport_per_week,
          activity: p.activity_type || null,
          equipment: p.equipment, experience: p.experience || null, injuries: p.injury_text || '',
        });
      });
    });
  }, [router]);

  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  async function save() {
    setErr('');
    if (!f.age || !f.ft || !f.weight || !f.sex || !f.objective || !f.equipment || !f.experience) {
      setErr('Please fill every field (age, height, weight, sex, objective, experience, equipment).');
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      name: user.user_metadata?.name || 'Athlete',
      age: +f.age, sex: f.sex, height_in: (+f.ft) * 12 + (+f.in || 0), weight_lb: +f.weight,
      objective: f.objective, days_per_week: +f.days, sport_per_week: +f.sport,
      activity_type: f.activity || null,
      equipment: f.equipment, experience: f.experience, injury_text: f.injuries.trim(),
      slack_daily: user.user_metadata?.slack_daily || false,
      slack_handle: user.user_metadata?.slack_handle || '',
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    router.push('/plan');
  }

  return (
    <>
      <header>
        <div className="kicker">Protocol by MAAN.life</div>
        <h1>Profile</h1>
        <div className="sub">Tell us a little bit about you so we can tailor the plan specifically to your needs.</div>
      </header>
      <div className="card">
        <div className="grid3">
          <div><label>Age</label><input type="number" value={f.age} onChange={e => set('age', e.target.value)} placeholder="e.g. 45" /></div>
          <div>
            <label>Height</label>
            <div className="grid2" style={{ gap: 8 }}>
              <input type="number" value={f.ft} onChange={e => set('ft', e.target.value)} placeholder="ft" />
              <input type="number" value={f.in} onChange={e => set('in', e.target.value)} placeholder="in" />
            </div>
          </div>
          <div><label>Weight (lb)</label><input type="number" value={f.weight} onChange={e => set('weight', e.target.value)} placeholder="e.g. 170" /></div>
        </div>
        <label>Sex</label>
        <div className="seg">
          {[['male', 'Male'], ['female', 'Female']].map(([v, l]) => (
            <button key={v} className={f.sex === v ? 'on' : ''} onClick={() => set('sex', u)}>{l}</button>
          ))}
        </div>
        <label>Primary objective</label>
        <div className="seg">
          {OBJECTIVES.map(([v, l]) => (
            <button key={v} className={f.objective === v ? 'on' : ''} onClick={() => set('objective', v)}>{l}</button>
          ))}
        </div>
        <label>Previous workout experience</label>
        <div className="seg">
          {EXPERIENCE.map(([v, l]) => (
            <button key={v} className={f.experience === v ? 'on' : ''} onClick={() => set('experience', v)}>{l}</button>
          ))}
        </div>
        <div className="grid2">
          <div>
            <label>Days you can train per week</label>
            <select value={f.days} onChange={e => set('days', e.target.value)}>{[3, 4, 5, 6].map(n => <option key={n}>{n}</option>)}</select>
          </div>
          <div>
            <label>Other fitness activities per week</label>
            <select value={f.sport} onChange={e => set('sport', e.target.value)}>{[0, 1, 2, 3].map(n => <option key={n}>{n}</option>)}</select>
          </div>
        </div>
        <label>Other fitness activity</label>
        <select value={f.activity || ''} onChange={e => set('activity', e.target.value || null)}>
          <option value="">Select one</option>
          {ACTIVITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <label>Equipment</label>
        <div className="seg">
          {EQUIPMENT.map(([v, l]) => (
            <button key={v} className={f.equipment === v ? 'on' : ''} onClick={() => set('equipment', v)}>{l}</button>
          ))}
        </div>
        <label>Injuries or cranky joints (optional)</label>
        <textarea value={f.injuries} onChange={e => set('injuries', e.target.value)} placeholder="e.g. right knee acts up on lunges" />
        <button className="btn accent" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Generate my plan'}</button>
        {err && <div className="err">{err}</div>}
      </div>
    </>
  );
}
