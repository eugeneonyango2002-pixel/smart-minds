import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, RefreshCw, Users, XCircle, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string }
type Learner = { id: string; admission_number: string; first_name: string; middle_name: string | null; last_name: string; class_id: string | null; guardian_name: string | null; guardian_phone: string | null }
type ClassRow = { id: string; name: string }

export default function ParentManager({ schools }: { schools: School[] }) {
  const [schoolId, setSchoolId] = useState('')
  const [learners, setLearners] = useState<Learner[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [parentName, setParentName] = useState('')
  const [phone, setPhone] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [relationship, setRelationship] = useState('Parent')
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!schoolId && schools.length) setSchoolId(schools.find(s => (s as any).status === 'approved')?.id || schools[0].id)
  }, [schools, schoolId])

  useEffect(() => {
    if (schoolId) void load()
  }, [schoolId])

  async function load() {
    setError('')
    const [studentResult, classResult] = await Promise.all([
      supabase.from('students').select('id,admission_number,first_name,middle_name,last_name,class_id,guardian_name,guardian_phone').eq('school_id', schoolId).order('first_name'),
      supabase.from('classes').select('id,name').eq('school_id', schoolId).order('sort_order'),
    ])
    if (studentResult.error) { setError(studentResult.error.message); return }
    if (classResult.error) { setError(classResult.error.message); return }
    setLearners((studentResult.data || []) as Learner[])
    setClasses(classResult.data || [])
  }

  const visible = useMemo(() => learners.filter(s => {
    const name = [s.first_name, s.middle_name, s.last_name, s.admission_number, s.guardian_name, s.guardian_phone].filter(Boolean).join(' ').toLowerCase()
    return name.includes(search.toLowerCase())
  }), [learners, search])

  function toggleLearner(id: string) {
    setSelected(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id])
  }

  async function createParent(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await supabase.functions.invoke('create-parent-account', {
        body: { school_id: schoolId, parent_name: parentName.trim(), phone: phone.trim(), password: temporaryPassword, student_ids: selected, relationship },
      })
      if (result.error) throw new Error(result.error.message)
      if (result.data?.error) throw new Error(result.data.error)
      setNotice('Parent account created. Give the parent their phone number and temporary password securely.')
      setParentName(''); setPhone(''); setTemporaryPassword(''); setSelected([]); setRelationship('Parent')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the parent account.')
    } finally { setBusy(false) }
  }

  return <section className="panel">
    <div className="academic-head"><div><p className="kicker">FAMILY ACCESS</p><h2>Parent accounts</h2><p className="muted">Create a parent login and link it to one or more learners.</p></div><button className="secondary" onClick={() => void load()}><RefreshCw /> Refresh</button></div>
    <label className="school-picker">Select school<select value={schoolId} onChange={e => { setSchoolId(e.target.value); setSelected([]) }}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {error && <p className="alert error"><XCircle />{error}</p>}
    {notice && <p className="alert success"><CheckCircle2 />{notice}</p>}
    <form className="school-form" onSubmit={createParent}>
      <label>Parent / guardian full name *<input required value={parentName} onChange={e => setParentName(e.target.value)} placeholder="Enter full name" /></label>
      <label>Phone number *<input required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+2547XXXXXXXX" /></label>
      <label>Temporary password *<input required type="password" minLength={8} autoComplete="new-password" value={temporaryPassword} onChange={e => setTemporaryPassword(e.target.value)} placeholder="At least 8 characters" /></label>
      <label>Relationship to learner<select value={relationship} onChange={e => setRelationship(e.target.value)}><option>Parent</option><option>Mother</option><option>Father</option><option>Guardian</option><option>Other</option></select></label>
      <div className="wide">
        <h3><Users size={18} /> Link learners ({selected.length} selected)</h3>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search learner name or admission number" />
        <div className="table-wrap"><table><thead><tr><th>Select</th><th>Learner</th><th>Admission no.</th><th>Class</th><th>Guardian phone</th></tr></thead><tbody>
          {visible.map(s => <tr key={s.id}><td><input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleLearner(s.id)} /></td><td>{[s.first_name,s.middle_name,s.last_name].filter(Boolean).join(' ')}</td><td>{s.admission_number}</td><td>{classes.find(c => c.id === s.class_id)?.name || '—'}</td><td>{s.guardian_phone || '—'}</td></tr>)}
          {!visible.length && <tr><td colSpan={5}>No learners found.</td></tr>}
        </tbody></table></div>
        <p className="muted">Select every child this parent should be able to view. At least one learner is required.</p>
      </div>
      <button className="primary wide" type="submit" disabled={busy || !schoolId || !selected.length}><UserPlus size={16} />{busy ? 'Creating account…' : 'Create parent account'}</button>
    </form>
  </section>
}
