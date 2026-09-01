'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [slackOpt, setSlackOpt] = useState(false);
  const [slackName, setSlackName] = useState('#protocol');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/plan');
    });
  }, [router]);

  async function submit() {
    setErr('');
    if (!email.includes('@') || pass.length < 8 || (mode === 'signup' && !name.trim())) {
      setErr(mode === 'signup'
        ? 'Please add your name, a valid email, and a password of 8+ characters.'
        : 'Please enter your email and password (8+ characters).');
      return;
    }
    if (mode === 'signup' && slackOpt && !slackName.trim()) {
      setErr('Add your Slack channel (like #protocol) so we know where to send the daily plan.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password: pass, options: { data: { name: name.trim(), slack_daily: slackOpt, slack_handle: slackName.trim() } },
        });
        if (error) throw error;
        router.push('/onboard');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        router.push('/plan');
      }
    } catch (e) {
      setErr(e.message || 'Something went wrong, try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header>
        <div className="kicker">Protocol by MAAN.life</div>
        <h1>{mode === 'signup' ? 'Sign Up' : 'Log In'}</h1>
        <div className="sub">Rules-based coaching that adjusts to you every single week.</div>
      </header>
      <div className="card">
        <div className="seg" style={{ marginBottom: 14 }}>
          <button className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Sign up, I&apos;m new</button>
          <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>Log in, returning</button>
        </div>
        {mode === 'signup' && (
          <div>
            <label>First name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alex" />
          </div>
        )}
        <div className="grid2">
          <div>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="8+ characters" />
          </div>
        </div>
        {mode === 'signup' && (
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', marginTop: 16 }}>
              <input type="checkbox" checked={slackOpt} onChange={e => setSlackOpt(e.target.checked)} style={{ width: 'auto', accentColor: 'var(--accent)' }} />
              Send my plan to me daily via Slack
            </label>
            {slackOpt && (
              <div>
                <p className="small" style={{ margin: '8px 0 2px' }}>In your Slack, create a <b>private channel called #protocol</b> and we deliver your plan there every morning at 6am. Keeps your plan in one tidy place instead of buried in DMs.</p>
                <label>Your Slack channel</label>
                <input value={slackName} onChange={e => setSlackName(e.target.value)} placeholder="#protocol" />
              </div>
            )}
          </div>
        )}
        <button className="btn accent" onClick={submit} disabled={busy}>
          {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Log in'}
        </button>
        {err && <div className="err">{err}</div>}
      </div>
    </>
  );
}
