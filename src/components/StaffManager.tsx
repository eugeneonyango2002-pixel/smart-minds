import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Search, RefreshCw, Users, XCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string; status?: string }
type Staff = {
  id: string; employee_number: string; first_name: string; middle_name: string | null; last_name: string;
  gender: string | null; phone: string | null; email: string | null; staff_role: string;
  employment_type: string; date_joined: string; status: string
}
const blank = {
  employee_number: '', first_name: '', middle_name: '', last_name: '', gender: '',
  phone: '', email: '', staff_role: 'teacher', employment_type: 'permanent',
  date_joined: new Date().toISOString().slice(0, 10), status: 'active'
}
const roleLabels: Record<string, string> = {
  teacher: 'Teacher', head_teacher: 'Head teacher', deputy_head_teacher: 'Deputy head teacher',
  bursar: 'Bursar', secretary: 'Secretary', support_staff: 'Support staff', other: 'Other'
}
export default function StaffManager({ schools }: { schools: School[] }) {
  const [schoolId, setSchoolId] = useState('')
  const [staff, setStaff] = useState<Staff[]>([])
  const [form, setForm] = useState(blank)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    if (!schoolId && schools.length) setSchoolId(schools.find(s => s.status === 'approved')?.id || schools[0].id)
  }, [schools, schoolId])
  useEffect(() => { if (schoolId) void load() }, [schoolId])
  async function load() {
    setError('')
    const { data, error } = await supabase.from('staff').select('*').eq('school_id', schoolId).order('last_name').order('first_name')
    if (error) setError(error.message)
    else setStaff((data || []) as Staff[])
  }
  const visible = useMemo(() => staff.filter(s =>
    (s.first_name + ' ' + (s.middle_name || '') + ' ' + s.last_name + ' ' + s.employee_number + ' ' + (s.phone || '') + ' ' + (s.email || '')).toLowerCase().includes(search.toLowerCase())
  ), [staff, search])
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!schoolId) return
    setBusy(true); setError(''); setNotice('')
    const payload = {
      ...form, school_id: schoolId, middle_name: form.middle_name || null,
      gender: form.gender || null, phone: form.phone || null, email: form.email || null
    }
    const { error } = await supabase.from('staff').insert(payload)
    if (error) setError(error.message)
    else {
      setNotice('Staff member added successfully.')
      setForm(blank); setAdding(false); await load()
    }
    setBusy(false)
  }
  return <section className="panel student-panel">
    <div className="academic-head"><div><p className="kicker">SCHOOL RECORDS</p><h2>Staff management</h2><p className="muted">Register teachers and employees, record their roles and contact details, and maintain the staff register.</p></div><button className="secondary" onClick={() => void load()}><RefreshCw /> Refresh</button></div>
    <label className="school-picker">Select school<select value={schoolId} onChange={e => { setSchoolId(e.target.value); setAdding(false) }}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <div className="student-toolbar"><div className="student-search"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, staff number, phone or email" /></div><button className="primary" disabled={!schoolId} onClick={() => { setAdding(!adding); setError(''); setNotice('') }}><Plus /> Add staff member</button></div>
    {error && <p className="alert error"><XCircle />{error}</p>}{notice && <p className="alert success"><CheckCircle2 />{notice}</p>}
    {adding && <form className="academic-form" onSubmit={save}>
      <label>Staff / employee number *<input required value={form.employee_number} onChange={e => setForm({ ...form, employee_number: e.target.value.trim() })} placeholder="e.g. SM-001" /></label>
      <label>First name *<input required value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></label>
      <label>Middle name<input value={form.middle_name} onChange={e => setForm({ ...form, middle_name: e.target.value })} /></label>
      <label>Last name *<input required value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></label>
      <label>Gender<select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="">Not specified</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label>
      <label>Phone number<input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+254…" /></label>
      <label>Email address<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      <label>Staff role *<select required value={form.staff_role} onChange={e => setForm({ ...form, staff_role: e.target.value })}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Employment type<select value={form.employment_type} onChange={e => setForm({ ...form, employment_type: e.target.value })}><option value="permanent">Permanent</option><option value="contract">Contract</option><option value="part_time">Part-time</option><option value="intern">Intern</option><option value="volunteer">Volunteer</option></select></label>
      <label>Date joined<input type="date" required value={form.date_joined} onChange={e => setForm({ ...form, date_joined: e.target.value })} /></label>
      <label>Employment status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option></select></label>
      <div className="academic-form-actions"><button type="button" className="secondary" onClick={() => setAdding(false)}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save staff member'}</button></div>
    </form>}
    <div className="student-count"><Users /> {visible.length} staff record(s)</div>
    {visible.length === 0 ? <div className="empty"><Users /><h3>No staff found</h3><p>Add your first teacher or employee to begin building the staff register.</p></div> : <div className="table-wrap"><table><thead><tr><th>Staff no.</th><th>Staff member</th><th>Role</th><th>Contact</th><th>Employment</th><th>Date joined</th><th>Status</th></tr></thead><tbody>{visible.map(s => <tr key={s.id}><td><b>{s.employee_number}</b></td><td><b>{s.first_name} {s.middle_name || ''} {s.last_name}</b><small>{s.gender || '—'}</small></td><td>{roleLabels[s.staff_role] || s.staff_role}</td><td>{s.phone || '—'}<small>{s.email || ''}</small></td><td>{s.employment_type.replace(/_/g, ' ')}</td><td>{s.date_joined}</td><td><span className={'status ' + (s.status === 'active' ? 'approved' : 'pending')}>{s.status.replace(/_/g, ' ')}</span></td></tr>)}</tbody></table></div>}
  </section>
}
