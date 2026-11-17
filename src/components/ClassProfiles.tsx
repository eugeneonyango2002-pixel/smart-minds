import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Save, Users, GraduationCap, XCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string; status?: string }
type ClassRow = { id: string; name: string; level: string }
type StaffRow = { id: string; first_name: string; middle_name: string | null; last_name: string; employee_number: string }
type StudentRow = { id: string; first_name: string; middle_name: string | null; last_name: string; admission_number: string; gender: string; class_id: string | null; status: string }
type ProfileRow = { id: string; class_id: string; class_teacher_id: string | null; boy_prefect_id: string | null; girl_prefect_id: string | null; class_motto: string | null; notes: string | null }
const fullName = (person: { first_name: string; middle_name?: string | null; last_name: string }) => [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ')

export default function ClassProfiles({ schools, canManage = true }: { schools: School[]; canManage?: boolean }) {
  const [schoolId, setSchoolId] = useState('')
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [boyId, setBoyId] = useState('')
  const [girlId, setGirlId] = useState('')
  const [motto, setMotto] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!schoolId && schools.length) setSchoolId(schools.find(s => s.status === 'approved')?.id || schools[0].id)
  }, [schools, schoolId])

  async function load() {
    if (!schoolId) return
    setError('')
    const [c, t, s, p] = await Promise.all([
      supabase.from('classes').select('id,name,level').eq('school_id', schoolId).order('sort_order'),
      supabase.from('staff').select('id,first_name,middle_name,last_name,employee_number').eq('school_id', schoolId).eq('staff_role', 'teacher').eq('status', 'active').order('last_name'),
      supabase.from('students').select('id,first_name,middle_name,last_name,admission_number,gender,class_id,status').eq('school_id', schoolId).eq('status', 'active').order('last_name'),
      supabase.from('class_profiles').select('*').eq('school_id', schoolId),
    ])
    const failed = [c.error, t.error, s.error, p.error].find(Boolean)
    if (failed) { setError(failed.message); return }
    setClasses((c.data || []) as ClassRow[])
    setStaff((t.data || []) as StaffRow[])
    setStudents((s.data || []) as StudentRow[])
    setProfiles((p.data || []) as ProfileRow[])
    const nextClasses = (c.data || []) as ClassRow[]
    setSelectedClassId(current => nextClasses.some(item => item.id === current) ? current : nextClasses[0]?.id || '')
  }

  useEffect(() => { if (schoolId) void load() }, [schoolId])

  const selectedClass = classes.find(item => item.id === selectedClassId)
  const profile = profiles.find(item => item.class_id === selectedClassId)
  const classStudents = useMemo(() => students.filter(item => item.class_id === selectedClassId), [students, selectedClassId])
  const boys = classStudents.filter(item => item.gender === 'male')
  const girls = classStudents.filter(item => item.gender === 'female')
  const selectedTeacher = staff.find(item => item.id === teacherId)
  const selectedBoy = boys.find(item => item.id === boyId)
  const selectedGirl = girls.find(item => item.id === girlId)

  useEffect(() => {
    setTeacherId(profile?.class_teacher_id || '')
    setBoyId(profile?.boy_prefect_id || '')
    setGirlId(profile?.girl_prefect_id || '')
    setMotto(profile?.class_motto || '')
    setNotes(profile?.notes || '')
  }, [selectedClassId, profile?.id, profile?.class_teacher_id, profile?.boy_prefect_id, profile?.girl_prefect_id, profile?.class_motto, profile?.notes])

  async function save() {
    if (!schoolId || !selectedClassId || !canManage) return
    setBusy(true); setError(''); setNotice('')
    const payload = {
      school_id: schoolId, class_id: selectedClassId,
      class_teacher_id: teacherId || null, boy_prefect_id: boyId || null,
      girl_prefect_id: girlId || null, class_motto: motto.trim() || null, notes: notes.trim() || null,
    }
    const result = profile
      ? await supabase.from('class_profiles').update(payload).eq('id', profile.id).eq('school_id', schoolId)
      : await supabase.from('class_profiles').insert(payload)
    if (result.error) setError(result.error.message)
    else { setNotice('Class profile saved successfully.'); await load() }
    setBusy(false)
  }

  return <section className="panel">
    <div className="academic-head">
      <div><p className="kicker">CLASS RECORDS</p><h2>Class profiles</h2><p className="muted">Assign one class teacher, one boy prefect and one girl prefect to each class.</p></div>
      <button className="secondary" onClick={() => void load()}><RefreshCw /> Refresh</button>
    </div>
    <label className="school-picker">Select school<select value={schoolId} onChange={e => setSchoolId(e.target.value)}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {error && <p className="alert error"><XCircle />{error}</p>}
    {notice && <p className="alert success"><CheckCircle2 />{notice}</p>}
    {!classes.length ? <div className="empty"><GraduationCap /><h3>No classes found</h3><p>Create your classes first under Academic setup.</p></div> : <>
      <label className="school-picker">Choose class<select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {selectedClass && <div style={{ marginTop: 22, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 13 }}>
          <div>
            <p className="kicker" style={{ marginBottom: 4 }}>CLASS OVERVIEW</p>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 750 }}>Learner snapshot</h3>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 999, background: '#ecfdf5', color: '#047857', fontSize: 12, fontWeight: 700 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} /> Live class count
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 13 }}>
          <div style={{ position: 'relative', overflow: 'hidden', padding: '18px 17px', borderRadius: 17, background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)', border: '1px solid #dbeafe', boxShadow: '0 5px 18px rgba(37,99,235,.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: '#1d4ed8', fontSize: 12, fontWeight: 750, letterSpacing: '.045em', textTransform: 'uppercase' }}>Active learners</span>
              <span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 12, background: '#dbeafe', color: '#1d4ed8' }}><Users size={19} /></span>
            </div>
            <div style={{ marginTop: 11, color: '#172554', fontSize: 34, lineHeight: 1, fontWeight: 800, letterSpacing: '-.04em' }}>{classStudents.length}</div>
            <div style={{ marginTop: 7, color: '#64748b', fontSize: 12 }}>Total enrolled in this class</div>
          </div>
          <div style={{ position: 'relative', overflow: 'hidden', padding: '18px 17px', borderRadius: 17, background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)', border: '1px solid #dbeafe', boxShadow: '0 5px 18px rgba(37,99,235,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: '#2563eb', fontSize: 12, fontWeight: 750, letterSpacing: '.045em', textTransform: 'uppercase' }}>Boys</span>
              <span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 12, background: '#dbeafe', color: '#2563eb', fontSize: 19, fontWeight: 800 }}>♂</span>
            </div>
            <div style={{ marginTop: 11, color: '#172554', fontSize: 34, lineHeight: 1, fontWeight: 800, letterSpacing: '-.04em' }}>{boys.length}</div>
            <div style={{ marginTop: 7, color: '#64748b', fontSize: 12 }}>Male learners</div>
          </div>
          <div style={{ position: 'relative', overflow: 'hidden', padding: '18px 17px', borderRadius: 17, background: 'linear-gradient(135deg, #fdf2f8 0%, #ffffff 100%)', border: '1px solid #fce7f3', boxShadow: '0 5px 18px rgba(219,39,119,.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: '#be185d', fontSize: 12, fontWeight: 750, letterSpacing: '.045em', textTransform: 'uppercase' }}>Girls</span>
              <span style={{ display: 'grid', placeItems: 'center', width: 36, height: 36, borderRadius: 12, background: '#fce7f3', color: '#be185d', fontSize: 19, fontWeight: 800 }}>♀</span>
            </div>
            <div style={{ marginTop: 11, color: '#831843', fontSize: 34, lineHeight: 1, fontWeight: 800, letterSpacing: '-.04em' }}>{girls.length}</div>
            <div style={{ marginTop: 7, color: '#64748b', fontSize: 12 }}>Female learners</div>
          </div>
        </div>
      </div>}
      <div className="panel" style={{ marginTop: 18 }}>
        <div className="academic-head"><div><p className="kicker">CLASS LEADERSHIP</p><h3>{selectedClass?.name || 'Class'} profile</h3></div><span className="status approved">{profile ? 'Profile saved' : 'Not yet set up'}</span></div>
        <div className="school-form">
          <label>Class teacher<select disabled={!canManage} value={teacherId} onChange={e => setTeacherId(e.target.value)}><option value="">Select class teacher</option>{staff.map(item => <option key={item.id} value={item.id}>{fullName(item)} · {item.employee_number}</option>)}</select></label>
          <label>Boy prefect<select disabled={!canManage} value={boyId} onChange={e => setBoyId(e.target.value)}><option value="">Select boy prefect</option>{boys.map(item => <option key={item.id} value={item.id}>{fullName(item)} · {item.admission_number}</option>)}</select></label>
          <label>Girl prefect<select disabled={!canManage} value={girlId} onChange={e => setGirlId(e.target.value)}><option value="">Select girl prefect</option>{girls.map(item => <option key={item.id} value={item.id}>{fullName(item)} · {item.admission_number}</option>)}</select></label>
          <label>Class motto<input disabled={!canManage} maxLength={180} value={motto} onChange={e => setMotto(e.target.value)} placeholder="Optional class motto" /></label>
          <label className="wide">Class notes<textarea disabled={!canManage} rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes about this class" /></label>
          {canManage && <button className="primary wide" disabled={busy} onClick={() => void save()}><Save />{busy ? 'Saving…' : 'Save class profile'}</button>}
        </div>
      </div>
      <div className="panel" style={{ marginTop: 18 }}>
        <p className="kicker">APPOINTED LEADERS</p><h3>Class leadership summary</h3>
        <div className="table-wrap"><table><thead><tr><th>Position</th><th>Name</th><th>Reference</th></tr></thead><tbody>
          <tr><td>Class teacher</td><td>{selectedTeacher ? fullName(selectedTeacher) : 'Not assigned'}</td><td>{selectedTeacher?.employee_number || '—'}</td></tr>
          <tr><td>Boy prefect</td><td>{selectedBoy ? fullName(selectedBoy) : 'Not assigned'}</td><td>{selectedBoy?.admission_number || '—'}</td></tr>
          <tr><td>Girl prefect</td><td>{selectedGirl ? fullName(selectedGirl) : 'Not assigned'}</td><td>{selectedGirl?.admission_number || '—'}</td></tr>
        </tbody></table></div>
      </div>
    </>}
  </section>
}
