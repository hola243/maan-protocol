'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { recommendSchedule } from '@/lib/engine';

const OBJECTIVES = [['shred', 'Shred'], ['lose', 'Lose weight'], ['build', 'Build'], ['maintain', 'Maintain'], ['rebuild', 'Ease back']];
const EXPERIENCE = [['new', 'New to it'], ['returning', 'Been a while'], ['consistent', 'Train regularly']];
const EQUIPMENT = [['gym', 'Full gym'], ['db', 'DBs + bands'], ['body', 'Bodyweight']];
const DAYS = [['Mon', 'Monday'], ['Tue', 'Tuesday'], ['Wed', 'Wednesday'], ['Thu', 'Thursday'], ['Fri', 'Friday'], ['Sat', 'Saturday'], ['Sun', 'Sunday']];
const KINDS = [['rest', 'Rest'], ['lift', 'Lift'], ['jiu jitsu', 'Jiu Jitsu'], ['yoga', 'Yoga'], ['swim', 'Swim'], ['run', 'Run'], ['other', 'Other']];
const KIND_LABEL = Object.fromEntries(KINDS);
const ACTIVITY_KINDS = ['jiu jitsu', 'yoga', 'swim', 'run', 'other'];

export default function OnboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ age: '', ft: '', in: '', weight: '', sex: null, objective: null, equipment: null, experience: null, injuries: '' });
  const [schedule, setSchedule] = useState(null); // { days: {...} } once set; null means "use the recommendation"
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/'); return; }
      setUser(data.user);
      supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle().then(({ data: p }) => {
        if (p) {
          setF({
            age: p.age, ft: Math.floor(p.height_in / 12), in: p.height_in % 12, weight: p.weight_lb,
            sex: p.sex, objective: p.objective,
            equipment: p.equipment, experience: p.experience || null, injuries: p.injury_text || '',
          });
          if (p.schedule && p.schedule.days) setSchedule({ days: p.schedule.days });
        }
      });
    });
  }, [router]);

  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const setDay = (d, kind) => setSchedule(prev => ({ days: { ...(prev ? prev.days : rec.days), [d]: kind } }));

  const rec = f.age && f.objective ? recommendSchedule(+f.age, f.objective) : null;
  const days = schedule ? schedule.days : (rec ? rec.days : {});
  const trainingCount = DAYS.filter(([d]) => days[d] && days[d] !== 'rest').length;
  const liftCount = DAYS.filter(([d]) => days[d] === 'lift').length;
  const belowRec = rec && (liftCount < rec.lifts || trainingCount < rec.lifts + rec.activities);

  function goRecommendation() {
    setErr('');
    if (!f.age || !f.ft || !f.weight || !f.sex || !f.objective || !f.equipment || !f.experience) {
      setErr('Please fill every field so we can tailor the recommendation.');
      return;
    }
    setStep(2);
  }
  function goDays() { if (schedule == null && rec) setSchedule({ days: { ...rec.days } }); setStep(3); }
  function useRecommended() { if (rec) setSchedule({ days: { ...rec.days } }); }

  async function save() {
    setErr('');
    if (trainingCount < 2) { setErr('Pick at least two training days so we can build a real week for you.'); return; }
    setBusy(true);
    const activityCount = DAYS.filter(([d]) => ACTIVITY_KINDS.includes(days[d])).length;
    const firstActivity = (DAYS.map(([d]) => days[d]).find(k => ACTIVITY_KINDS.includes(k))) || null;
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      name: user.user_metadata?.name || 'Athlete',
      age: +f.age, sex: f.sex, height_in: (+f.ft) * 12 + (+f.in || 0), weight_lb: +f.weight,
      objective: f.objective,
      days_per_week: Math.min(6, Math.max(3, trainingCount)),
      sport_per_week: Math.min(3, activityCount),
      activity_type: firstActivity,
      schedule: { days },
      equipment: f.equipment, experience: f.experience, injury_text: f.injuries.trim(),
      slack_daily: user.user_metadata?.slack_daily || false,
      slack_handle: user.user_metadata?.slack_handle || '',
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    router.push('/plan');
  }

  const Stepper = () => (
    <div className="stepper">
      {[1, 2, 3].map(n => <span key={n} className={'dot' + (n === step ? ' on' : n < step ? ' done' : '')} />)}
      <span className="stepper-label">Step {step} of 3</span>
    </div>
  );

  return (
    <>
      <header>
        <div className="kicker">Protocol by MAAN.life</div>
        <h1>{step === 1 ? 'Your profile' : step === 2 ? 'Our recommendation' : 'Your week'}</h1>
        <div className="sub">{step === 1 ? 'Tell us about you and your goal.' : step === 2 ? 'Built for your age and your goal.' : 'Start from our plan, then make it yours.'}</div>
      </header>

      {step === 1 && (
        <div className="card">
          <Stepper />
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
          <div className="seg objgrid">
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
          <label>Equipment</label>
          <div className="seg">
            {EQUIPMENT.map(([v, l]) => (
              <button key={v} className={f.equipment === v ? 'on' : ''} onClick={() => set('equipment', v)}>{l}</button>
            ))}
          </div>
          <label>Injuries or cranky joints (optional)</label>
          <textarea value={f.injuries} onChange={e => set('injuries', e.target.value)} placeholder="e.g. right knee acts up on lunges" />
          <button className="btn accent" onClick={goRecommendation}>Next: your recommendation</button>
          {err && <div className="err">{err}</div>}
        </div>
      )}

      {step === 2 && rec && (
        <div className="card">
          <Stepper />
          <div className="rec-figure">
            <div><div className="rec-num">{rec.lifts}</div><div className="rec-cap">Strength days</div></div>
            <div className="rec-plus">+</div>
            <div><div className="rec-num">{rec.activities}</div><div className="rec-cap">Activity days</div></div>
          </div>
          <p className="muted" style={{ marginTop: 14 }}>{rec.note}</p>
          <p className="muted"><b>{rec.suggested}</b></p>
          <div className="meals-head" style={{ marginTop: 16 }}>The week we suggest</div>
          <div className="sched">
            {DAYS.map(([d, full]) => {
              const k = rec.days[d]; const on = k !== 'rest';
              return <div className="sched-row" key={d}><span className={'sched-day' + (on ? ' on' : '')}>{full}</span><span className={'kindtag' + (on ? ' on' : '')}>{KIND_LABEL[k]}</span></div>;
            })}
          </div>
          <button className="btn accent" onClick={goDays}>Set my days</button>
          <button className="btn ghost" onClick={() => setStep(1)}>Back</button>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <Stepper />
          <p className="small" style={{ margin: '0 0 8px' }}>These are pre-filled from our recommendation. Change any day to what you actually do. Leave the rest on Rest.</p>
          <div className="sched">
            {DAYS.map(([d, full]) => (
              <div className="sched-row" key={d}>
                <span className={'sched-day' + (days[d] !== 'rest' ? ' on' : '')}>{full}</span>
                <select value={days[d] || 'rest'} onChange={e => setDay(d, e.target.value)}>
                  {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            ))}
          </div>
          {belowRec && (
            <div className="warn">Heads up: for your age and goal we suggest at least {rec.lifts} strength days and {rec.lifts + rec.activities} training days a week. Fewer than that may slow your results. You can still proceed.</div>
          )}
          <button className="btn accent" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Generate my plan'}</button>
          <button className="btn ghost" onClick={useRecommended}>Use recommended week</button>
          <button className="btn ghost" onClick={() => setStep(2)}>Back</button>
          {err && <div className="err">{err}</div>}
        </div>
      )}
    </>
  );
}
