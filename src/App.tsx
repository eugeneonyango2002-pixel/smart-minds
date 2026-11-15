import { useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Activity, ArrowRight, Building2, CalendarCheck, CheckCircle2, ClipboardList, FileText, GraduationCap, LogOut, Mail, Lock, Menu, RefreshCw, ShieldCheck, Users, Wallet, XCircle } from 'lucide-react'
import { supabase, supabaseConfigured } from './lib/supabase'
import AcademicManager from './components/AcademicManager'
import ExaminationsManager from './components/ExaminationsManager'
import StudentManager from './components/StudentManager'
import AttendanceManager from './components/AttendanceManager'
import FeesManager from './components/FeesManager'
import FeeStatements from './components/FeeStatements'
import FeeReports from './components/FeeReports'
import StaffManager from './components/StaffManager'

const SUB_COUNTIES_BY_COUNTY: Record<string, string[]> = {
  "Uasin Gishu": [
    "Ainabkoi",
    "Kapseret",
    "Kesses",
    "Moiben",
    "Soy",
    "Turbo"
  ],
  "Kericho": [
    "Ainamoi",
    "Belgut",
    "Buret",
    "Kipkelion East",
    "Kipkelion West",
    "Sigowet/Soin"
  ],
  "Nandi": [
    "Aldai",
    "Chesumei",
    "Emgwen",
    "Mosop",
    "Nandi Hills",
    "Tinderet"
  ],
  "Siaya": [
    "Alego Usonga",
    "Bondo",
    "Gem",
    "Rarieda",
    "Ugenya",
    "Ugunja"
  ],
  "Migori": [
    "Awendo",
    "Kuria East",
    "Kuria West",
    "Nyatike",
    "Rongo",
    "Suna East",
    "Suna West",
    "Uriri"
  ],
  "Nakuru": [
    "Bahati",
    "Gilgil",
    "Kuresoi North",
    "Kuresoi South",
    "Molo",
    "Naivasha",
    "Nakuru Town East",
    "Nakuru Town West",
    "Njoro",
    "Rongai",
    "Subukia"
  ],
  "Garissa": [
    "Balambala",
    "Dadaab",
    "Dujis",
    "Fafi",
    "Ijara",
    "Lagdera"
  ],
  "Mandera": [
    "Banissa",
    "Lafey",
    "Mandera East",
    "Mandera North",
    "Mandera South",
    "Mandera West"
  ],
  "Baringo": [
    "Baringo Central",
    "Baringo North",
    "Baringo South",
    "Eldama Ravine",
    "Mogotio",
    "Tiaty"
  ],
  "Kisii": [
    "Bobasi",
    "Bomachoge Borabu",
    "Bomachoge Chache",
    "Bonchari",
    "Kitutu Chache North",
    "Kitutu Chache South",
    "Nyaribari Chache",
    "Nyaribari Masaba",
    "South Mugirango"
  ],
  "Bomet": [
    "Bomet Central",
    "Bomet East",
    "Chepalungu",
    "Konoin",
    "Sotik"
  ],
  "Nyamira": [
    "Borabu",
    "Kitutu Masaba",
    "North Mugirango",
    "West Mugirango"
  ],
  "Busia": [
    "Budalangi",
    "Butula",
    "Funyula",
    "Matayos",
    "Nambale",
    "Teso North",
    "Teso South"
  ],
  "Bungoma": [
    "Bumula",
    "Kabuchai",
    "Kanduyi",
    "Kimilili",
    "Mt. Elgon",
    "Sirisia",
    "Tongaren",
    "Webuye East",
    "Webuye West"
  ],
  "Tana River": [
    "Bura",
    "Galole",
    "Garsen"
  ],
  "Kakamega": [
    "Butere",
    "Ikolomani",
    "Khwisero",
    "Likuyani",
    "Lugari",
    "Lurambi",
    "Malava",
    "Matungu",
    "Mumias East",
    "Mumias West",
    "Navakholo",
    "Shinyalu"
  ],
  "Meru": [
    "Buuri",
    "Cental Imenti",
    "Igembe Central",
    "Igembe North",
    "Igembe South",
    "North Imenti",
    "South Imenti",
    "Tigania East",
    "Tigania West"
  ],
  "Mombasa": [
    "Changamwe",
    "Jomvu",
    "Kisauni",
    "Likoni",
    "Mvita",
    "Nyali"
  ],
  "Trans Nzoia": [
    "Cherangany",
    "Endebess",
    "Kiminini",
    "Kwanza",
    "Saboti"
  ],
  "Nairobi": [
    "Dagoretti",
    "Embakasi Central",
    "Embakasi East",
    "Embakasi North",
    "Embakasi South",
    "Embakasi West",
    "Kamukunji",
    "Kasarani",
    "Kibra",
    "Kilimani",
    "Langata",
    "Makadara",
    "Mathare",
    "Roysambu",
    "Ruaraka",
    "Starehe",
    "Westlands"
  ],
  "Wajir": [
    "Eldas",
    "Tarbaj",
    "Wajir East",
    "Wajir North",
    "Wajir South",
    "Wajir West"
  ],
  "Vihiga": [
    "Emuhaya",
    "Hamisi",
    "Luanda",
    "Sabatia",
    "Vihiga"
  ],
  "Narok": [
    "Emurua Dikirr",
    "Kilgoris",
    "Narok East",
    "Narok North",
    "Narok South",
    "Narok West"
  ],
  "Embu": [
    "Gachoka",
    "Manyatta",
    "Runyenjes",
    "Siakago"
  ],
  "Kilifi": [
    "Ganze",
    "Kaloleni",
    "Kilifi North",
    "Kilifi South",
    "Magarini",
    "Malindi",
    "Rabai"
  ],
  "Murang'a": [
    "Gatanga",
    "Kandara",
    "Kangema",
    "Kigumo",
    "Kiharu",
    "Maragwa",
    "Mathioya"
  ],
  "Kiambu": [
    "Gatundu North",
    "Gatundu South",
    "Githunguri",
    "Juja",
    "Kabete",
    "Kiambaa",
    "Kiambu",
    "Kikuyu",
    "Lari",
    "Limuru",
    "Ruiru",
    "Thika Town"
  ],
  "Kirinyaga": [
    "Gichugu",
    "Kirinyaga Central",
    "Mwea",
    "Ndia"
  ],
  "Homa Bay": [
    "Homa Bay",
    "Kabondo Kasipul",
    "Karachuonyo",
    "Kasipul",
    "Ndhiwa",
    "Rangwe",
    "Suba North",
    "Suba South"
  ],
  "Isiolo": [
    "Isiolo North",
    "Isiolo South"
  ],
  "West Pokot": [
    "Kacheliba",
    "Kapenguria",
    "Pokot South",
    "Sigor"
  ],
  "Makueni": [
    "Kaiti",
    "Kibwezi East",
    "Kibwezi West",
    "Kilome",
    "Makueni",
    "Mbooni"
  ],
  "Kajiado": [
    "Kajiado Central",
    "Kajiado East",
    "Kajiado North",
    "Kajiado South",
    "Kajiado West"
  ],
  "Machakos": [
    "Kangundo",
    "Kathiani",
    "Machakos Town",
    "Masinga",
    "Matungulu",
    "Mavoko",
    "Mwala",
    "Yatta"
  ],
  "Elgeyo-Marakwet": [
    "Keiyo North",
    "Keiyo South",
    "Marakwet East",
    "Marakwet West"
  ],
  "Nyeri": [
    "Kieni",
    "Mathira",
    "Mukurweni",
    "Nyeri Town",
    "Othaya",
    "Tetu"
  ],
  "Kwale": [
    "Kinango",
    "Lunga Lunga",
    "Matuga",
    "Msambweni"
  ],
  "Nyandarua": [
    "Kinangop",
    "Kipipiri",
    "Ndaragwa",
    "Ol Jorok",
    "Ol Kalou"
  ],
  "Kisumu": [
    "Kisumu Central",
    "Kisumu East",
    "Kisumu West",
    "Muhoroni",
    "Nyakach",
    "Nyando",
    "Seme"
  ],
  "Kitui": [
    "Kitui Central",
    "Kitui East",
    "Kitui Rural",
    "Kitui South",
    "Kitui West",
    "Mwingi East",
    "Mwingi North",
    "Mwingi West"
  ],
  "Laikipia": [
    "Laikipia East",
    "Laikipia North",
    "Laikipia West"
  ],
  "Marsabit": [
    "Laisamis",
    "Moyale",
    "North Horr",
    "Saku"
  ],
  "Lamu": [
    "Lamu East",
    "Lamu West"
  ],
  "Turkana": [
    "Loima",
    "Turkana Central",
    "Turkana East",
    "Turkana North",
    "Turkana South",
    "Turkana West"
  ],
  "Tharaka-Nithi": [
    "Maara",
    "Nithi",
    "Tharaka"
  ],
  "Taita Taveta": [
    "Mwatate",
    "Taveta",
    "Voi",
    "Wundanyi"
  ],
  "Samburu": [
    "Samburu East",
    "Samburu North",
    "Samburu West"
  ]
}
const KENYA_COUNTIES = Object.keys(SUB_COUNTIES_BY_COUNTY).sort((a, b) => a.localeCompare(b))

type School = {
  id: string
  name: string
  school_type: string
  status: string
  application_number: string
  applicant_name?: string | null
  contact_email?: string | null
  county?: string | null
  sub_county?: string | null
  contact_phone?: string | null
  address?: string | null
  registration_number?: string | null
  motto?: string | null
  logo_url?: string | null
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
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditSearch, setAuditSearch] = useState('')
  const [auditSchoolFilter, setAuditSchoolFilter] = useState('all')
  const [auditActionFilter, setAuditActionFilter] = useState('all')
  const [auditFromDate, setAuditFromDate] = useState('')
  const [auditToDate, setAuditToDate] = useState('')
  const [managedSchool, setManagedSchool] = useState<School | null>(null)
  const [editingSchool, setEditingSchool] = useState(false)
  const [schoolDraft, setSchoolDraft] = useState({ name: '', school_type: 'primary_secondary', applicant_name: '', contact_email: '', contact_phone: '', county: '', sub_county: '', address: '', registration_number: '' })
  const [profileDraft, setProfileDraft] = useState({ name: '', school_type: 'primary_secondary', applicant_name: '', contact_email: '', contact_phone: '', county: '', sub_county: '', address: '', registration_number: '' })
  const [profileMotto, setProfileMotto] = useState('')
  const [profileLogoUrl, setProfileLogoUrl] = useState('')
  const [profileLogoFile, setProfileLogoFile] = useState<File | null>(null)
  const [page, setPage] = useState<'dashboard' | 'apply' | 'academic' | 'examinations' | 'students' | 'attendance' | 'fees' | 'fee-statements' | 'fee-reports' | 'staff' | 'profile'>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = (nextPage: typeof page) => { setPage(nextPage); setSidebarOpen(false) }
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
  const [invitationCode, setInvitationCode] = useState('')
  const [claimingInvitation, setClaimingInvitation] = useState(false)
  const [staffAccount, setStaffAccount] = useState<{ role: string; school_id: string; staff_id: string } | null>(null)
  const rolePages: Record<string, string[]> = {
    school_admin: ['academic', 'examinations', 'students', 'staff', 'attendance', 'fees', 'fee-statements', 'fee-reports', 'profile'],
    head_teacher: ['academic', 'examinations', 'students', 'staff', 'attendance', 'fees', 'fee-statements', 'fee-reports', 'profile'],
    deputy_head_teacher: ['academic', 'examinations', 'students', 'attendance'],
    teacher: ['students', 'attendance', 'examinations'],
    bursar: ['fees', 'fee-statements', 'fee-reports'],
    secretary: ['students', 'attendance'],
    support_staff: [],
  }
  const role = staffAccount?.role || ''
  const canAccess = (target: string) => admin || rolePages[role]?.includes(target) === true

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) void loadSchools()
    else { setAdmin(false); setSchools([]) }
  }, [session])

  useEffect(() => {
    let cancelled = false
    async function loadStaffAccount() {
      setStaffAccount(null)
      if (!session) return
      const { data, error } = await supabase
        .from('staff_login_accounts')
        .select('role, school_id, staff_id')
        .eq('auth_user_id', session.user.id)
        .eq('status', 'active')
        .maybeSingle()
      if (!cancelled && !error && data) setStaffAccount(data)
    }
    void loadStaffAccount()
    return () => { cancelled = true }
  }, [session])

  useEffect(() => {
    if (!admin && page !== 'dashboard' && page !== 'apply' && !canAccess(page)) setPage('dashboard')
  }, [admin, page, staffAccount])

  async function loadSchools() {
    setError('')
    const { data: adminResult, error: adminError } = await supabase.rpc('is_platform_admin')
    if (adminError) { setError(adminError.message); return }
    setAdmin(Boolean(adminResult))
    const { data, error: listError } = await supabase.from('schools').select('*').order('created_at', { ascending: false })
    if (listError) setError(listError.message)
    else setSchools((data || []) as School[])
  }

  async function loadAuditLogs() {
    setAuditLoading(true); setError('')
    const { data, error } = await supabase.from('audit_logs')
      .select('id, school_id, actor_user_id, action, entity_table, entity_id, details, created_at')
      .order('created_at', { ascending: false }).limit(100)
    if (error) setError(error.message)
    else setAuditLogs(data || [])
    setAuditLoading(false)
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

  async function claimInvitation(e: FormEvent) {
    e.preventDefault()
    setError(''); setNotice('')
    if (!invitationCode.trim()) { setError('Enter the invitation code shared by your school.'); return }
    setClaimingInvitation(true)
    const { data, error } = await supabase.rpc('claim_staff_invitation', { p_token: invitationCode.trim() })
    if (error) setError(error.message)
    else {
      const account = data as { role?: string }
      setStaffAccount({ role: account.role || 'staff', school_id: String((data as { school_id?: string }).school_id || ''), staff_id: String((data as { staff_id?: string }).staff_id || '') })
      setInvitationCode('')
      setNotice('Your staff account has been linked successfully. Your role is ' + (account.role || 'staff').replace(/_/g, ' ') + '.')
    }
    setClaimingInvitation(false)
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

  function startSchoolEdit(s: School) {
    setManagedSchool(s)
    setSchoolDraft({
      name: s.name || '',
      school_type: s.school_type || 'primary_secondary',
      applicant_name: s.applicant_name || '',
      contact_email: s.contact_email || '',
      contact_phone: s.contact_phone || '',
      county: s.county || '',
      sub_county: s.sub_county || '',
      address: s.address || '',
      registration_number: s.registration_number || '',
    })
    setEditingSchool(true)
  }

  async function saveMySchoolProfile(e: FormEvent) {
    e.preventDefault()
    if (!staffAccount?.school_id) { setError('Your staff account is not linked to a school.'); return }
    setBusy('profile'); setError(''); setNotice('')
    const { error } = await supabase.rpc('update_my_school_profile', {
      p_name: profileDraft.name,
      p_school_type: profileDraft.school_type,
      p_applicant_name: profileDraft.applicant_name,
      p_contact_email: profileDraft.contact_email,
      p_contact_phone: profileDraft.contact_phone,
      p_county: profileDraft.county,
      p_sub_county: profileDraft.sub_county,
      p_address: profileDraft.address,
      p_registration_number: profileDraft.registration_number,
    })
    if (error) setError(error.message)
    else {
      setNotice('School profile updated successfully.')
      setSchools(current => current.map(s => s.id === staffAccount.school_id ? { ...s, ...profileDraft } : s))
    }
    setBusy('')
  }

  async function saveMySchoolBranding(e: FormEvent) {
    e.preventDefault()
    if (!staffAccount?.school_id) { setError('Your staff account is not linked to a school.'); return }
    setBusy('branding'); setError(''); setNotice('')
    let nextLogoUrl = profileLogoUrl
    if (profileLogoFile) {
      const allowed = ['image/png', 'image/jpeg', 'image/webp']
      if (!allowed.includes(profileLogoFile.type)) {
        setError('Please choose a PNG, JPG or WebP image.')
        setBusy('')
        return
      }
      if (profileLogoFile.size > 2 * 1024 * 1024) {
        setError('The logo must be 2 MB or smaller.')
        setBusy('')
        return
      }
      const extension = profileLogoFile.type === 'image/png' ? 'png' : profileLogoFile.type === 'image/webp' ? 'webp' : 'jpg'
      const path = staffAccount.school_id + '/logo-' + Date.now() + '.' + extension
      const upload = await supabase.storage.from('school-logos').upload(path, profileLogoFile, { contentType: profileLogoFile.type, upsert: false })
      if (upload.error) {
        setError(upload.error.message)
        setBusy('')
        return
      }
      nextLogoUrl = supabase.storage.from('school-logos').getPublicUrl(path).data.publicUrl
    }
    const { error } = await supabase.rpc('update_my_school_branding', {
      p_motto: profileMotto,
      p_logo_url: nextLogoUrl,
    })
    if (error) setError(error.message)
    else {
      setProfileLogoUrl(nextLogoUrl)
      setProfileLogoFile(null)
      setSchools(current => current.map(s => s.id === staffAccount.school_id ? { ...s, motto: profileMotto, logo_url: nextLogoUrl } : s))
      setNotice('School logo and motto saved successfully.')
    }
    setBusy('')
  }

  async function saveSchoolEdit(e: FormEvent) {
    e.preventDefault()
    if (!managedSchool) return
    setBusy(managedSchool.id); setError(''); setNotice('')
    const { error } = await supabase.rpc('admin_update_school', {
      p_school_id: managedSchool.id,
      p_name: schoolDraft.name,
      p_school_type: schoolDraft.school_type,
      p_applicant_name: schoolDraft.applicant_name,
      p_contact_email: schoolDraft.contact_email,
      p_contact_phone: schoolDraft.contact_phone,
      p_county: schoolDraft.county,
      p_sub_county: schoolDraft.sub_county,
      p_address: schoolDraft.address,
      p_registration_number: schoolDraft.registration_number,
    })
    if (error) setError(error.message)
    else { setNotice('School details updated successfully.'); setEditingSchool(false); setManagedSchool(null) }
    await loadSchools()
    setBusy('')
  }

  async function changeSchoolStatus(s: School, action: 'suspend' | 'activate') {
    const confirmed = window.confirm(action === 'suspend'
      ? 'Suspend ' + s.name + '? The school will be marked as suspended.'
      : 'Reactivate ' + s.name + '? The school will return to approved status.')
    if (!confirmed) return
    setBusy(s.id); setError(''); setNotice('')
    const { error } = await supabase.rpc(action === 'suspend' ? 'admin_suspend_school' : 'admin_activate_school', { p_school_id: s.id })
    if (error) setError(error.message)
    else setNotice(action === 'suspend' ? 'School suspended successfully.' : 'School activated successfully.')
    await loadSchools()
    if (managedSchool?.id === s.id) setManagedSchool({ ...s, status: action === 'suspend' ? 'suspended' : 'approved' })
    setBusy('')
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
  const rejected = schools.filter(s => s.status === 'rejected').length
  const suspended = schools.filter(s => s.status === 'suspended').length
  const countyCounts = Object.entries(schools.reduce<Record<string, number>>((acc, school) => {
    const key = school.county?.trim() || 'County not specified'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const registrationMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date()
    date.setDate(1)
    date.setMonth(date.getMonth() - (5 - index))
    const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0')
    return { key, label: date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), count: schools.filter(s => s.created_at?.slice(0, 7) === key).length }
  })
  const maxMonthlyRegistrations = Math.max(1, ...registrationMonths.map(month => month.count))
  const maxCountyRegistrations = Math.max(1, ...countyCounts.map(([, count]) => count))
  const auditActions = Array.from(new Set(auditLogs.map(log => String(log.action || '').trim()).filter(Boolean))).sort()
  const filteredAuditLogs = auditLogs.filter(log => {
    const schoolMatch = auditSchoolFilter === 'all' || log.school_id === auditSchoolFilter
    const actionMatch = auditActionFilter === 'all' || log.action === auditActionFilter
    const logDate = new Date(log.created_at)
    const fromMatch = !auditFromDate || logDate >= new Date(auditFromDate + 'T00:00:00')
    const toExclusive = auditToDate ? new Date(auditToDate + 'T00:00:00') : null
    if (toExclusive) toExclusive.setDate(toExclusive.getDate() + 1)
    const toMatch = !toExclusive || logDate < toExclusive
    const detailsText = typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {})
    const schoolName = schools.find(s => s.id === log.school_id)?.name || ''
    const haystack = [log.action, log.entity_table, log.actor_user_id, detailsText, schoolName].join(' ').toLowerCase()
    const searchMatch = !auditSearch.trim() || haystack.includes(auditSearch.trim().toLowerCase())
    return schoolMatch && actionMatch && fromMatch && toMatch && searchMatch
  })
  return <div className="layout">
    <aside className={sidebarOpen ? "sidebar drawer-open" : "sidebar"}><div className="brand"><span className="logo"><GraduationCap /></span><span>SMART MINDS<small>School management</small></span></div><p className="nav-title">WORKSPACE</p>
      <button className={page === 'dashboard' ? 'nav active' : 'nav'} onClick={() => navigate('dashboard')}><Activity /> Dashboard</button>
      <button className={page === 'apply' ? 'nav active' : 'nav'} onClick={() => navigate('apply')}><Building2 /> Register a school</button>
      {canAccess('profile') && !admin && <button className={page === 'profile' ? 'nav active' : 'nav'} onClick={() => { const s = schools.find(item => item.id === staffAccount?.school_id); if (s) { setProfileDraft({ name: s.name || '', school_type: s.school_type || 'primary_secondary', applicant_name: s.applicant_name || '', contact_email: s.contact_email || '', contact_phone: s.contact_phone || '', county: s.county || '', sub_county: s.sub_county || '', address: s.address || '', registration_number: s.registration_number || '' }); setProfileMotto(s.motto || ''); setProfileLogoUrl(s.logo_url || ''); setProfileLogoFile(null) } navigate('profile') }}><Building2 /> School profile & settings</button>}
      {canAccess('academic') && <button className={page === 'academic' ? 'nav active' : 'nav'} onClick={() => navigate('academic')}><GraduationCap /> Academic setup</button>}
      {canAccess('examinations') && <button className={page === 'examinations' ? 'nav active' : 'nav'} onClick={() => navigate('examinations')}><ClipboardList /> Examinations & report cards</button>}
      {canAccess('students') && <button className={page === 'students' ? 'nav active' : 'nav'} onClick={() => navigate('students')}><Users /> Students</button>}
      {canAccess('staff') && <button className={page === 'staff' ? 'nav active' : 'nav'} onClick={() => navigate('staff')}><Users /> Staff management</button>}
      {canAccess('attendance') && <button className={page === 'attendance' ? 'nav active' : 'nav'} onClick={() => navigate('attendance')}><CalendarCheck /> Attendance</button>}
      {canAccess('fees') && <button className={page === 'fees' ? 'nav active' : 'nav'} onClick={() => navigate('fees')}><Wallet /> Fees</button>}
      {canAccess('fee-statements') && <button className={page === 'fee-statements' ? 'nav active' : 'nav'} onClick={() => navigate('fee-statements')}><FileText /> Fee balances & statements</button>}
      {canAccess('fee-reports') && <button className={page === 'fee-reports' ? 'nav active' : 'nav'} onClick={() => navigate('fee-reports')}><Activity /> Fee reports</button>}
      <div className="sidebar-bottom"><button className="nav" onClick={() => void supabase.auth.signOut()}><LogOut /> Sign out</button><div className="developer-credit">Developed by <b>Eugene Media Graphix</b></div><span><ShieldCheck /> Secure workspace</span></div>
    </aside>
    <button className={sidebarOpen ? "drawer-backdrop visible" : "drawer-backdrop"} aria-label="Close navigation" onClick={() => setSidebarOpen(false)} /><main className="main"><header><button className="menu-toggle" aria-label="Open navigation menu" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)}><Menu /></button><div><p className="kicker">SMART MINDS PLATFORM</p><h1>{page === 'apply' ? 'School registration' : page === 'academic' ? 'Academic setup' : page === 'students' ? 'Student management' : page === 'attendance' ? 'Student attendance' : page === 'fees' ? 'Fees management' : page === 'fee-statements' ? 'Fee balances & statements' : page === 'fee-reports' ? 'Fee collection reports' : page === 'staff' ? 'Staff management' : page === 'profile' ? 'School profile & settings' : admin ? 'Platform overview' : 'My workspace'}</h1></div><span className="user-email">{session.user.email}</span></header>
      {error && <p className="alert error"><XCircle />{error}</p>}{notice && <p className="alert success"><CheckCircle2 />{notice}</p>}
      {page !== 'dashboard' && page !== 'apply' && !canAccess(page) ? <section className="panel"><h2>Access restricted</h2><p className="muted">Your assigned role ({role.replace(/_/g, ' ') || 'unassigned'}) does not have permission to open this module.</p><button className="secondary" onClick={() => navigate('dashboard')}>Return to dashboard</button></section> : page === 'profile' ? <section className="panel"><p className="kicker">SCHOOL SETTINGS</p><h2>School profile</h2><p className="muted">Update the information displayed for your school. Only your school's Headteacher and School Admin can save changes.</p>{!schools.some(s => s.id === staffAccount?.school_id) ? <p className="muted">Your school record is loading or your staff account is not linked to a school.</p> : <form className="school-form" onSubmit={saveMySchoolProfile}><label>School name *<input required value={profileDraft.name} onChange={e => setProfileDraft({ ...profileDraft, name: e.target.value })} /></label><label>School type *<select value={profileDraft.school_type} onChange={e => setProfileDraft({ ...profileDraft, school_type: e.target.value })}><option value="primary_secondary">Primary & Secondary</option><option value="primary">Primary</option><option value="secondary">Secondary</option></select></label><label>Applicant / contact person<input value={profileDraft.applicant_name} onChange={e => setProfileDraft({ ...profileDraft, applicant_name: e.target.value })} /></label><label>Contact email<input type="email" value={profileDraft.contact_email} onChange={e => setProfileDraft({ ...profileDraft, contact_email: e.target.value })} /></label><label>Phone number<input value={profileDraft.contact_phone} onChange={e => setProfileDraft({ ...profileDraft, contact_phone: e.target.value })} /></label><label>County *<select required value={profileDraft.county} onChange={e => setProfileDraft({ ...profileDraft, county: e.target.value, sub_county: '' })}><option value="">Select county</option>{KENYA_COUNTIES.map(name => <option key={name} value={name}>{name}</option>)}</select></label><label>Sub-county *<select required value={profileDraft.sub_county} onChange={e => setProfileDraft({ ...profileDraft, sub_county: e.target.value })} disabled={!profileDraft.county}><option value="">Select sub-county</option>{(SUB_COUNTIES_BY_COUNTY[profileDraft.county] || []).map(name => <option key={name} value={name}>{name}</option>)}</select></label><label>Registration number<input value={profileDraft.registration_number} onChange={e => setProfileDraft({ ...profileDraft, registration_number: e.target.value })} /></label><label className="wide">Physical address<textarea rows={3} value={profileDraft.address} onChange={e => setProfileDraft({ ...profileDraft, address: e.target.value })} /></label><button className="primary wide" type="submit" disabled={busy === 'profile'}>{busy === 'profile' ? 'Saving…' : 'Save school profile'} <ArrowRight /></button></form>}<div className="divider" /><h3>School branding</h3><p className="muted">Add your school motto and upload its logo (PNG, JPG or WebP, maximum 2 MB).</p><form className="school-form" onSubmit={saveMySchoolBranding}><label className="wide">School motto<input value={profileMotto} onChange={e => setProfileMotto(e.target.value)} placeholder="Enter your school motto" maxLength={180} /></label><label className="wide">School logo<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setProfileLogoFile(e.target.files?.[0] || null)} /></label>{profileLogoUrl && <div className="wide"><p className="muted">Current school logo</p><img src={profileLogoUrl} alt="Current school logo" style={{ maxWidth: 160, maxHeight: 160, objectFit: "contain", borderRadius: 8 }} /></div>}{profileLogoFile && <p className="muted wide">Selected: {profileLogoFile.name}</p>}<button className="primary wide" type="submit" disabled={busy === 'branding'}>{busy === 'branding' ? 'Saving branding…' : 'Save logo and motto'} <ArrowRight /></button></form></section> : page === 'academic' ? <AcademicManager schools={schools} /> : page === 'examinations' ? <ExaminationsManager schools={schools} /> : page === 'students' ? <StudentManager schools={schools} canManage={admin || ['school_admin', 'head_teacher', 'secretary'].includes(role)} /> : page === 'attendance' ? <AttendanceManager schools={schools} /> : page === 'fees' ? <FeesManager schools={schools} /> : page === 'fee-statements' ? <FeeStatements schools={schools} /> : page === 'fee-reports' ? <FeeReports schools={schools} /> : page === 'staff' ? <StaffManager schools={schools} /> : page === 'apply' ? <section className="panel"><p className="kicker">JOIN SMART MINDS</p><h2>Apply to register your school</h2><p className="muted">Applications are reviewed by the central Smart Minds administrator.</p>
        <form className="school-form" onSubmit={apply}>
          <label>School name *<input required value={schoolName} onChange={e => setSchoolName(e.target.value)} /></label>
          <label>School type *<select value={schoolType} onChange={e => setSchoolType(e.target.value)}><option value="primary_secondary">Primary & Secondary</option><option value="primary">Primary</option><option value="secondary">Secondary</option></select></label>
          <label>Applicant full name *<input required value={applicant} onChange={e => setApplicant(e.target.value)} /></label>
          <label>Contact email *<input required type="email" value={contact} onChange={e => setContact(e.target.value)} /></label>
          <label>Phone number<input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+254…" /></label>
          <label>County *<select required value={county} onChange={e => { setCounty(e.target.value); setSubCounty('') }}><option value="">Select county</option>{KENYA_COUNTIES.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <label>Sub-county *<select required value={subCounty} onChange={e => setSubCounty(e.target.value)} disabled={!county}><option value="">Select sub-county</option>{(SUB_COUNTIES_BY_COUNTY[county] || []).map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          <label>Registration number<input value={registration} onChange={e => setRegistration(e.target.value)} /></label>
          <label className="wide">Physical address<textarea rows={3} value={address} onChange={e => setAddress(e.target.value)} /></label>
          <button className="primary wide" type="submit">Submit application <ArrowRight /></button>
        </form>
      </section> : <div className="dashboard">
        <div className="welcome"><div><p className="kicker">{admin ? 'CENTRAL ADMINISTRATION' : 'SCHOOL ACCOUNT'}</p><h2>{admin ? 'Platform overview' : 'Welcome to Smart Minds'}</h2><p className="muted">{admin ? 'Review applications and manage registered schools.' : 'Your school applications and memberships will appear here.'}</p></div><button className="secondary" onClick={() => void loadSchools()}><RefreshCw /> Refresh</button></div>
        {admin ? <>
          <div className="stats"><article className="panel"><Building2 /><span>Total schools</span><b>{schools.length}</b></article><article className="panel"><Activity /><span>Pending applications</span><b>{pending}</b></article><article className="panel"><CheckCircle2 /><span>Approved schools</span><b>{approved}</b></article><article className="panel"><Users /><span>Platform role</span><b className="role">Super Admin</b></article></div>
          <section className="panel">
            <div className="panel-heading"><div><h2>Platform analytics</h2><p className="muted">Live overview calculated from registered school records.</p></div><span>{schools.length} total schools</span></div>
            <div className="stats">
              <article className="panel"><Building2 /><span>Total schools</span><b>{schools.length}</b></article>
              <article className="panel"><Activity /><span>Pending</span><b>{pending}</b></article>
              <article className="panel"><CheckCircle2 /><span>Approved</span><b>{approved}</b></article>
              <article className="panel"><XCircle /><span>Rejected</span><b>{rejected}</b></article>
              <article className="panel"><ShieldCheck /><span>Suspended</span><b>{suspended}</b></article>
            </div>
            <div className="school-form" style={{ marginTop: 18, alignItems: 'start' }}>
              <div className="panel" style={{ minWidth: 0 }}>
                <h3>School registrations · Last 6 months</h3>
                {registrationMonths.map(month => <div key={month.key} style={{ display: 'grid', gridTemplateColumns: '64px 1fr 28px', gap: 10, alignItems: 'center', margin: '13px 0' }}>
                  <small>{month.label}</small><div style={{ height: 12, background: 'var(--border, #e5e7eb)', borderRadius: 20, overflow: 'hidden' }}><div style={{ height: '100%', width: (month.count / maxMonthlyRegistrations * 100) + '%', background: 'var(--primary, #2563eb)', borderRadius: 20, minWidth: month.count ? 4 : 0 }} /></div><b>{month.count}</b>
                </div>)}
              </div>
              <div className="panel" style={{ minWidth: 0 }}>
                <h3>Schools by county</h3>
                {countyCounts.length === 0 ? <p className="muted">County information will appear when schools are registered.</p> : countyCounts.map(([name, count]) => <div key={name} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) 1.2fr 24px', gap: 10, alignItems: 'center', margin: '13px 0' }}>
                  <small>{name}</small><div style={{ height: 12, background: 'var(--border, #e5e7eb)', borderRadius: 20, overflow: 'hidden' }}><div style={{ height: '100%', width: (count / maxCountyRegistrations * 100) + '%', background: 'var(--primary, #2563eb)', borderRadius: 20 }} /></div><b>{count}</b>
                </div>)}
              </div>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>Registration trend uses the latest six calendar months. County chart shows up to eight counties with the most registered schools.</p>
          </section>
          <section className="panel"><div className="panel-heading"><h2>School applications & administration</h2><span>{schools.length} records</span></div>
            {schools.length === 0 ? <div className="empty"><Building2 /><h3>No applications yet</h3><p>New school applications will appear here for review.</p><button className="secondary" onClick={() => setPage('apply')}>Create a test application</button></div> : <div className="table-wrap"><table><thead><tr><th>School</th><th>Applicant</th><th>County</th><th>Reference</th><th>Status</th><th>Actions</th></tr></thead><tbody>{schools.map(s => <tr key={s.id}><td><b>{s.name}</b><small>{s.school_type}</small></td><td>{s.applicant_name || '—'}<small>{s.contact_email}</small></td><td>{s.county || '—'}</td><td><code>{s.application_number}</code></td><td><span className={'status ' + s.status}>{s.status}</span></td><td><div className="actions"><button disabled={busy === s.id} onClick={() => { setManagedSchool(s); setEditingSchool(false) }}>View</button>{s.status !== 'pending' && <button disabled={busy === s.id} onClick={() => startSchoolEdit(s)}>Edit</button>}{s.status === 'pending' ? <><button disabled={busy === s.id} onClick={() => void review(s.id, 'approve')}>Approve</button><button disabled={busy === s.id} onClick={() => void review(s.id, 'reject')}>Reject</button></> : s.status === 'approved' ? <button disabled={busy === s.id} onClick={() => void changeSchoolStatus(s, 'suspend')}>Suspend</button> : s.status === 'suspended' ? <button disabled={busy === s.id} onClick={() => void changeSchoolStatus(s, 'activate')}>Activate</button> : null}</div></td></tr>)}</tbody></table></div>}
            {managedSchool && <div className="panel" style={{ marginTop: 20 }}>
              <div className="panel-heading"><h2>{editingSchool ? 'Edit school details' : 'School details'}</h2><button className="secondary" onClick={() => { setManagedSchool(null); setEditingSchool(false) }}>Close</button></div>
              {editingSchool ? <form className="school-form" onSubmit={saveSchoolEdit}>
                <label>School name *<input required value={schoolDraft.name} onChange={e => setSchoolDraft({ ...schoolDraft, name: e.target.value })} /></label>
                <label>School type *<select value={schoolDraft.school_type} onChange={e => setSchoolDraft({ ...schoolDraft, school_type: e.target.value })}><option value="primary_secondary">Primary & Secondary</option><option value="primary">Primary</option><option value="secondary">Secondary</option></select></label>
                <label>Applicant name<input value={schoolDraft.applicant_name} onChange={e => setSchoolDraft({ ...schoolDraft, applicant_name: e.target.value })} /></label>
                <label>Contact email<input type="email" value={schoolDraft.contact_email} onChange={e => setSchoolDraft({ ...schoolDraft, contact_email: e.target.value })} /></label>
                <label>Contact phone<input value={schoolDraft.contact_phone} onChange={e => setSchoolDraft({ ...schoolDraft, contact_phone: e.target.value })} /></label>
                <label>County *<select required value={schoolDraft.county} onChange={e => setSchoolDraft({ ...schoolDraft, county: e.target.value, sub_county: '' })}><option value="">Select county</option>{KENYA_COUNTIES.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
                <label>Sub-county *<select required value={schoolDraft.sub_county} onChange={e => setSchoolDraft({ ...schoolDraft, sub_county: e.target.value })} disabled={!schoolDraft.county}><option value="">Select sub-county</option>{(SUB_COUNTIES_BY_COUNTY[schoolDraft.county] || []).map(name => <option key={name} value={name}>{name}</option>)}</select></label>
                <label>Registration number<input value={schoolDraft.registration_number} onChange={e => setSchoolDraft({ ...schoolDraft, registration_number: e.target.value })} /></label>
                <label className="wide">Physical address<textarea rows={3} value={schoolDraft.address} onChange={e => setSchoolDraft({ ...schoolDraft, address: e.target.value })} /></label>
                <button className="primary wide" type="submit" disabled={busy === managedSchool.id}>{busy === managedSchool.id ? 'Saving…' : 'Save school details'}</button>
              </form> : <div className="school-details">
                <p><b>School:</b> {managedSchool.name}</p><p><b>Type:</b> {managedSchool.school_type.replace(/_/g, ' ')}</p><p><b>Status:</b> {managedSchool.status}</p><p><b>Applicant:</b> {managedSchool.applicant_name || '—'}</p><p><b>Email:</b> {managedSchool.contact_email || '—'}</p><p><b>Phone:</b> {managedSchool.contact_phone || '—'}</p><p><b>County:</b> {managedSchool.county || '—'}</p><p><b>Sub-county:</b> {managedSchool.sub_county || '—'}</p><p><b>Registration:</b> {managedSchool.registration_number || '—'}</p><p><b>Address:</b> {managedSchool.address || '—'}</p><p><b>Application reference:</b> {managedSchool.application_number}</p>
              </div>}
            </div>}
          </section>
          <section className="panel">
            <div className="panel-heading"><div><h2>Audit log</h2><p className="muted">Recent platform administration activity (latest 100 records).</p></div><button className="secondary" onClick={() => void loadAuditLogs()} disabled={auditLoading}><RefreshCw /> {auditLoading ? "Loading…" : "Load audit log"}</button></div>
            {auditLogs.length === 0 ? <div className="empty"><FileText /><h3>No audit records loaded</h3><p>Select “Load audit log” to view recorded administration activity.</p></div> : <>
              <div className="school-form" style={{ margin: '18px 0', alignItems: 'end' }}>
                <label className="wide">Search audit records<input value={auditSearch} onChange={e => setAuditSearch(e.target.value)} placeholder="Search school, action, user ID or details…" /></label>
                <label>Filter by school<select value={auditSchoolFilter} onChange={e => setAuditSchoolFilter(e.target.value)}><option value="all">All schools</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <label>Filter by action<select value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)}><option value="all">All actions</option>{auditActions.map(action => <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>)}</select></label>
                <label>From date<input type="date" value={auditFromDate} onChange={e => setAuditFromDate(e.target.value)} /></label>
                <label>To date<input type="date" min={auditFromDate || undefined} value={auditToDate} onChange={e => setAuditToDate(e.target.value)} /></label>
                <button className="secondary" type="button" onClick={() => { setAuditSearch(''); setAuditSchoolFilter('all'); setAuditActionFilter('all'); setAuditFromDate(''); setAuditToDate('') }}>Clear filters</button>
              </div>
              <p className="muted">Showing {filteredAuditLogs.length} of {auditLogs.length} loaded records.</p>
              {filteredAuditLogs.length === 0 ? <div className="empty"><FileText /><h3>No matching records</h3><p>Try changing or clearing your filters.</p></div> : <div className="table-wrap"><table><thead><tr><th>Date & time</th><th>Action</th><th>School</th><th>Performed by (user ID)</th><th>Details</th></tr></thead><tbody>{filteredAuditLogs.map(log => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString()}</td><td><b>{String(log.action || "").replace(/_/g, " ")}</b><small>{log.entity_table || "—"}</small></td><td>{schools.find(s => s.id === log.school_id)?.name || (log.school_id ? log.school_id.slice(0, 8) + "…" : "—")}</td><td><code>{log.actor_user_id || "—"}</code></td><td><small>{typeof log.details === "string" ? log.details : JSON.stringify(log.details || {})}</small></td></tr>)}</tbody></table></div>}
            </>}
          </section>
        </> : <section className="panel">
          {staffAccount && (() => { const school = schools.find(s => s.id === staffAccount.school_id); return school ? <div className="school-branding-banner" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 18, marginBottom: 18, border: '1px solid var(--border, #e5e7eb)', borderRadius: 12 }}>
            {school.logo_url ? <img src={school.logo_url} alt={school.name + ' logo'} style={{ width: 76, height: 76, objectFit: 'contain', borderRadius: 8 }} /> : <Building2 size={42} />}
            <div><h2 style={{ margin: 0 }}>{school.name}</h2>{school.motto && <p className="muted" style={{ margin: '6px 0 0' }}>{school.motto}</p>}<p className="muted" style={{ margin: '5px 0 0' }}>{school.county || ''}{school.sub_county ? ' · ' + school.sub_county : ''}</p></div>
          </div> : null })()}
          <div className="empty"><Building2 /><h3>Welcome to Smart Minds</h3><p>Use the invitation code from your school to link your staff account. Make sure you are signed in with the email address registered by your school.</p></div>
          {staffAccount ? <div className="notice"><ShieldCheck /> Staff account linked. Assigned role: <b>{staffAccount.role.replace(/_/g, ' ')}</b>. Your school workspace access will be enabled as the role-based modules are completed.</div> : <form className="school-form" onSubmit={claimInvitation}>
            <label className="wide">Staff invitation code<input required value={invitationCode} onChange={e => setInvitationCode(e.target.value)} placeholder="Paste your one-time invitation code" autoComplete="off" /></label>
            <button className="primary wide" type="submit" disabled={claimingInvitation}>{claimingInvitation ? 'Verifying code…' : 'Activate staff account'} <ArrowRight /></button>
          </form>}
          <p className="muted">Invitation codes expire one hour after they are created and can only be used once.</p>
          <button className="secondary" onClick={() => setPage('apply')}>Register a school <ArrowRight /></button>
        </section>}
      </div>}
      <footer>© {new Date().getFullYear()} Smart Minds <span>One platform. Many possibilities.</span></footer>
    </main>
  </div>
}
