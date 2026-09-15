'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const OBJECTIVES = [['shred', 'Shred'], ['lose', 'Lose weight'], ['build', 'Build'], ['maintain', 'Maintain'], ['rebuild', 'Ease back']];
const EXPERIENCE = [['new', 'New to it'], ['returning', 'Been a while'], ['consistent', 'Train regularly']];
const EQUIPMENT = [['gym', 'Full gym'], ['db', 'DBs + bands'], ['body', 'Bodyweight']];
const TIMES = [['morning', 'Morning'], ['afternoon', 'Afternoon'], ['evening', 'Evening']];
const DAYS = [['Mon', 'Monday'], ['Tue', 'Tuesday'], ['Wed', 'Wednesday'], ['Thu', 'Thursday'], ['Fri', 'Friday'], ['Sat', 'Saturday'], ['Sun', 'Sunday']];
const KINDS = [['rest', 'Rest'], ['lift', 'Lift'], ['jiu jitsu', 'Jiu Jitsu'], ['yoga', 'Yoga'], ['swim', 'Swim'], ['run', 'Run'], ['other', 'Other']];
const ACTIVITY_KINDS = ['jiu jitsu', 'yoga', 'swim', 'run', 'other'];

const DEFAULT_SCHEDULE = { time: 'morning', days: { Mon: 'lift', Tue: 'rest', Wed: 'lift', Thu: 'rest', Fri: 'lift', Sat: 'rest', Sun: 'rest' } };

export default function OnboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [f, setF] = useState({ age: '', ft: '', in: '', weight: '', sex: null, objective: null, equipment: null, experience: null, injuries: '', schedule: DEFAULT_SCHEDULE });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/'); return; }
      setUser(data.user);
      supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle().then(({ data: p }) => {
        if (p) setF({
          age: p.age, ft: Math.floor(p.height_in / 12), in: p.height_in % 12, weight: p.weight_lb,
          sex: p.sex, objective: p.objective,
          equipment: p.equipment, experience: p.experience || null, injuries: p.injury_text || '',
          schedule: (p.schedule && p.schedule.days) ? p.schedule : DEFAULT_SCHEDULE,
        });
      });
    });
  }, [router]);

  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const setDay = (d, kind) => setF(prev => ({ ...prev, schedule: { ...prev.schedule, days: { ...prev.schedule.days, [d]: kind } } }));
  const setTime = (t) => setF(prev => ({ ...prev, schedule: { ...prev.schedule, time: t } }));

  const trainingDays = DAYS.filter(([d]) => f.schedule.days[d] && f.schedule.days[d] !== 'rest');

  async function save() {
    setErr('');
    if (!f.age || !f.ft || !f.weight || !f.sex || !f.objective || !f.equipment || !f.experience) {
      setErr('Please fill every field (age, height, weight, sex, objective, experience, equipment).');
      return;
    }
    if (trainingDays.length < 2) {
      setErr('Pick at least two training days so we can build a real week for you.');
      return;
    }
    setBusy(true);
    // Legacy columns kept in sync for backward compatibility (the schedule now drives the plan).
    const nonRest = trainingDays.length;
    const activityCount = DAYS.filter(([d]) => ACTIVITY_KINDS.includes(f.schedule.days[d])).length;
    const firstActivity = (DAYS.map(([d]) => f.schedule.days[d]).find(k => ACTIVITY_KINDS.includes(k))) || null;
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      name: user.user_metadata?.name || 'Athlete',
      age: +f.age, sex: f.sex, height_in: (+f.ft) * 12 + (+f.in || 0), weight_lb: +f.weight,
      objective: f.objective,
      days_per_week: Math.min(6, Math.max(3, nonRest)),
      sport_per_week: Math.min(3, activityCount),
      activity_type: firstActivity,
      schedule: f.schedule,
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
            <button key={v} className={f.sex === v ? 'on' : ''} onClick={() => set('sex', v)}>{l}</button>
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

        <div className="section-head">
          <label style={{ margin: '18px 0 2px' }}>Your training week</label>
          <p className="small" style={{ margin: '0 0 6px' }}>Set what you do each day. Pick Lift for a gym session, or the activity you actually do. Leave the rest on Rest.</p>
        </div>
        <div className="sched">
          {DAYS.map(([d, full]) => (
            <div className="sched-row" key={d}>
              <span className={'sched-day' + (f.schedule.days[d] !== 'rest' ? ' on' : '')}>{full}</span>
              <select value={f.schedule.days[d] || 'rest'} onChange={e => setDay(d, e.target.value)}>
                {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          ))}
        </div>

        <label>Preferred time to train</label>
        <div className="seg">
          {TIMES.map(([v, l]) => (
            <button key={v} className={f.schedule.time === v ? 'on' : ''} onClick={() => setTime(v)}>{l}</button>
          ))}
        </div>

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
