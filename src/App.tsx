import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, ArrowRight, Building2, CheckCircle2, GraduationCap, LogOut, Mail, Lock, RefreshCw, ShieldCheck, Users, XCircle } from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'
import AcademicManager from './components/AcademicManager'
import StudentManager from './components/StudentManager'

type School = {
  id: string
  name: string
  school_type: string
  status: string
  application_number: string
  applicant_name?: string | null
  contact_email?: string | null
  county?: string | null
  created_at?: string
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [admin, setAdmin] = useState(false)
  const [schools, setSchools] = useState<School[]>([])
  const [page, setPage] = useState<'dashboard' | 'apply' | 'academic' | 'students'>('dashboard')
  const [schoolName, setSchoolName] = useState('')
  const [schoolType, setSchoolType] = useState('primary_secondary')
  const [applicant, setApplicant] = useState('')
  const [contact, setContact] = useState('')
  const [phone, setPhone] = useState('')
  const [county, setCounty] = useState('')
  const [subCounty, setSubCounty] = useState('')
  const [address, setAddress] = useState('')
  const [registration, setRegistration] = useState('')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) void loadSchools()
    else { setAdmin(false); setSchools([]) }
  }, [session])

  async function loadSchools() {
    setError('')
    const { data: adminResult, error: adminError } = await supabase.rpc('is_platform_admin')
    if (adminError) { setError(adminError.message); return }
    setAdmin(Boolean(adminResult))
    const { data, error: listError } = await supabase.from('schools').select('*').order('created_at', { ascending: false })
    if (listError) setError(listError.message)
    else setSchools((data || []) as School[])
  }

  async function authenticate(e: FormEvent) {
    e.preventDefault(); setError(''); setNotice('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
      if (error) setError(error.message)
      else setNotice('Account created. Check your email if confirmation is enabled, then sign in.')
    }
  }

  async function apply(e: FormEvent) {
    e.preventDefault(); setError(''); setNotice('')
    const { data, error } = await supabase.rpc('submit_school_application', {
      p_school_name: schoolName,
      p_school_type: schoolType,
      p_applicant_name: applicant,
      p_contact_email: contact,
      p_contact_phone: phone,
      p_county: county,
      p_sub_county: subCounty,
      p_address: address,
      p_registration_number: registration,
    })
    if (error) setError(error.message)
    else {
      setNotice('Application submitted. Your reference number is ' + String(data))
      setSchoolName(''); setApplicant(''); setContact(''); setPhone(''); setCounty(''); setSubCounty(''); setAddress(''); setRegistration('')
      setPage('dashboard'); await loadSchools()
    }
  }

  async function review(id: string, action: 'approve' | 'reject') {
    setBusy(id); setError(''); setNotice('')
    let result
    if (action === 'approve') result = await supabase.rpc('approve_school', { p_school_id: id })
    else {
      const reason = window.prompt('Reason for rejecting this application:')
      if (!reason?.trim()) { setBusy(''); return }
      result = await supabase.rpc('reject_school', { p_school_id: id, p_reason: reason })
    }
    if (result.error) setError(result.error.message)
    else setNotice(action === 'approve' ? 'School approved successfully.' : 'Application rejected.')
    await loadSchools(); setBusy('')
  }

  if (!supabaseConfigured) return <main className="setup"><div className="panel setup-panel"><div className="logo"><GraduationCap /></div><p className="kicker">SMART MINDS · SETUP</p><h1>Connect your Supabase project</h1><p>Your application files are ready. The next step is to add your Supabase project URL and publishable (anon) key to GitHub Actions secrets.</p><div className="notice"><ShieldCheck /> Never put your Supabase service-role key in the frontend or GitHub source files.</div></div></main>
  if (loading) return <main className="setup">Loading Smart Minds…</main>

  if (!session) return <main className="auth">
    <section className="hero"><div className="brand"><span className="logo"><GraduationCap /></span> SMART MINDS</div><div><p className="kicker">ONE PLATFORM · MANY SCHOOLS</p><h1>Every school.<br /><em>One smarter</em> system.</h1><p>School administration, learning and communication together in one secure place.</p></div><small>Built for Kenya · Currency: KES</small></section>
    <section className="auth-side"><div className="auth-card"><div className="mobile-brand"><span className="logo"><GraduationCap /></span> SMART MINDS</div><p className="kicker">{mode === 'login' ? 'WELCOME BACK' : 'GET STARTED'}</p><h2>{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</h2><p className="muted">Access your school workspace securely.</p>
      <form onSubmit={authenticate} className="form">
        {mode === 'signup' && <label>Full name<input required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" /></label>}
        <label>Email address<span className="input-icon"><Mail /><input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></span></label>
        <label>Password<span className="input-icon"><Lock /><input type="password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" /></span></label>
        <button className="primary" type="submit">{mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight /></button>
      </form>
      <p className="switch">{mode === 'login' ? "Don't have an account?" : 'Already registered?'} <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setNotice('') }}>{mode === 'login' ? 'Create account' : 'Sign in'}</button></p>
      {error && <p className="alert error"><XCircle />{error}</p>}{notice && <p className="alert success"><CheckCircle2 />{notice}</p>}
    </div></section>
  </main>

  const pending = schools.filter(s => s.status === 'pending').length
  const approved = schools.filter(s => s.status === 'approved').length
  return <div className="layout">
    <aside className="sidebar"><div className="brand"><span className="logo"><GraduationCap /></span><span>SMART MINDS<small>School management</small></span></div><p className="nav-title">WORKSPACE</p>
      <button className={page === 'dashboard' ? 'nav active' : 'nav'} onClick={() => setPage('dashboard')}><Activity /> Dashboard</button>
      <button className={page === 'apply' ? 'nav active' : 'nav'} onClick={() => setPage('apply')}><Building2 /> Register a school</button>
      {admin && <button className={page === 'academic' ? 'nav active' : 'nav'} onClick={() => setPage('academic')}><GraduationCap /> Academic setup</button>}
      {admin && <button className={page === 'students' ? 'nav active' : 'nav'} onClick={() => setPage('students')}><Users /> Students</button>}
      <div className="sidebar-bottom"><span><ShieldCheck /> Secure workspace</span><button className="nav" onClick={() => void supabase.auth.signOut()}><LogOut /> Sign out</button></div>
    </aside>
    <main className="main"><header><div><p className="kicker">SMART MINDS PLATFORM</p><h1>{page === 'apply' ? 'School registration' : page === 'academic' ? 'Academic setup' : page === 'students' ? 'Student management' : admin ? 'Platform overview' : 'My workspace'}</h1></div><span className="user-email">{session.user.email}</span></header>
      {error && <p className="alert error"><XCircle />{error}</p>}{notice && <p className="alert success"><CheckCircle2 />{notice}</p>}
      {page === 'academic' ? <AcademicManager schools={schools} /> : page === 'students' ? <StudentManager schools={schools} /> : page === 'apply' ? <section className="panel"><p className="kicker">JOIN SMART MINDS</p><h2>Apply to register your school</h2><p className="muted">Applications are reviewed by the central Smart Minds administrator.</p>
        <form className="school-form" onSubmit={apply}>
          <label>School name *<input required value={schoolName} onChange={e => setSchoolName(e.target.value)} /></label>
          <label>School type *<select value={schoolType} onChange={e => setSchoolType(e.target.value)}><option value="primary_secondary">Primary & Secondary</option><option value="primary">Primary</option><option value="secondary">Secondary</option></select></label>
          <label>Applicant full name *<input required value={applicant} onChange={e => setApplicant(e.target.value)} /></label>
          <label>Contact email *<input required type="email" value={contact} onChange={e => setContact(e.target.value)} /></label>
          <label>Phone number<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+254…" /></label>
          <label>County<input value={county} onChange={e => setCounty(e.target.value)} /></label>
          <label>Sub-county<input value={subCounty} onChange={e => setSubCounty(e.target.value)} /></label>
          <label>Registration number<input value={registration} onChange={e => setRegistration(e.target.value)} /></label>
          <label className="wide">Physical address<textarea rows={3} value={address} onChange={e => setAddress(e.target.value)} /></label>
          <button className="primary wide" type="submit">Submit application <ArrowRight /></button>
        </form>
      </section> : <div className="dashboard">
        <div className="welcome"><div><p className="kicker">{admin ? 'CENTRAL ADMINISTRATION' : 'SCHOOL ACCOUNT'}</p><h2>{admin ? 'Platform overview' : 'Welcome to Smart Minds'}</h2><p className="muted">{admin ? 'Review applications and manage registered schools.' : 'Your school applications and memberships will appear here.'}</p></div><button className="secondary" onClick={() => void loadSchools()}><RefreshCw /> Refresh</button></div>
        {admin ? <>
          <div className="stats"><article className="panel"><Building2 /><span>Total schools</span><b>{schools.length}</b></article><article className="panel"><Activity /><span>Pending applications</span><b>{pending}</b></article><article className="panel"><CheckCircle2 /><span>Approved schools</span><b>{approved}</b></article><article className="panel"><Users /><span>Platform role</span><b className="role">Super Admin</b></article></div>
          <section className="panel"><div className="panel-heading"><h2>School applications</h2><span>{schools.length} records</span></div>
            {schools.length === 0 ? <div className="empty"><Building2 /><h3>No applications yet</h3><p>New school applications will appear here for review.</p><button className="secondary" onClick={() => setPage('apply')}>Create a test application</button></div> : <div className="table-wrap"><table><thead><tr><th>School</th><th>Applicant</th><th>County</th><th>Reference</th><th>Status</th><th>Review</th></tr></thead><tbody>{schools.map(s => <tr key={s.id}><td><b>{s.name}</b><small>{s.school_type}</small></td><td>{s.applicant_name || '—'}<small>{s.contact_email}</small></td><td>{s.county || '—'}</td><td><code>{s.application_number}</code></td><td><span className={'status ' + s.status}>{s.status}</span></td><td>{s.status === 'pending' ? <div className="actions"><button disabled={busy === s.id} onClick={() => void review(s.id, 'approve')}>Approve</button><button disabled={busy === s.id} onClick={() => void review(s.id, 'reject')}>Reject</button></div> : '—'}</td></tr>)}</tbody></table></div>}
          </section>
        </> : <section className="panel empty"><Building2 /><h3>Welcome to your school workspace</h3><p>Apply to register a school or ask your school administrator for an invitation.</p><button className="primary" onClick={() => setPage('apply')}>Register a school <ArrowRight /></button></section>}
      </div>}
      <footer>© {new Date().getFullYear()} Smart Minds <span>One platform. Many possibilities.</span></footer>
    </main>
  </div>
}
