import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, RefreshCw, Save, Users, XCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string }
type Student = { id: string; admission_number: string; first_name: string; middle_name: string | null; last_name: string; class_id: string | null; stream_id: string | null }
type ClassRow = { id: string; name: string }
type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
type Mark = { status: AttendanceStatus; notes: string }
const today = new Date().toISOString().slice(0, 10)

export default function AttendanceManager({ schools }: { schools: School[] }) {
  const [schoolId, setSchoolId] = useState('')
  const [date, setDate] = useState(today)
  const [classId, setClassId] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [marks, setMarks] = useState<Record<string, Mark>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!schoolId && schools.length) setSchoolId(schools.find(s => (s as any).status === 'approved')?.id || schools[0].id)
  }, [schools, schoolId])

  useEffect(() => { if (schoolId) void load() }, [schoolId, date])

  async function load() {
    setLoading(true); setError(''); setNotice('')
    const [studentResult, classResult, attendanceResult] = await Promise.all([
      supabase.from('students').select('id,admission_number,first_name,middle_name,last_name,class_id,stream_id').eq('school_id', schoolId).eq('status', 'active').order('admission_number'),
      supabase.from('classes').select('id,name').eq('school_id', schoolId).order('sort_order'),
      supabase.from('student_attendance').select('student_id,status,notes').eq('school_id', schoolId).eq('attendance_date', date)
    ])
    if (studentResult.error) setError(studentResult.error.message)
    else if (classResult.error) setError(classResult.error.message)
    else if (attendanceResult.error) setError(attendanceResult.error.message)
    else {
      setStudents(studentResult.data || [])
      setClasses(classResult.data || [])
      const existing: Record<string, Mark> = {}
      for (const row of attendanceResult.data || []) existing[row.student_id] = { status: row.status as AttendanceStatus, notes: row.notes || '' }
      const initial: Record<string, Mark> = {}
      for (const student of studentResult.data || []) initial[student.id] = existing[student.id] || { status: 'present', notes: '' }
      setMarks(initial)
    }
    setLoading(false)
  }

  const visible = useMemo(() => students.filter(s => !classId || s.class_id === classId), [students, classId])
  const counts = useMemo(() => visible.reduce((a, s) => { a[marks[s.id]?.status || 'present']++; return a }, { present: 0, absent: 0, late: 0, excused: 0 }), [visible, marks])

  function update(id: string, patch: Partial<Mark>) {
    setMarks(current => ({ ...current, [id]: { ...(current[id] || { status: 'present', notes: '' }), ...patch } }))
  }

  async function save() {
    if (!schoolId || !visible.length) return
    setSaving(true); setError(''); setNotice('')
    const { data: auth } = await supabase.auth.getUser()
    const rows = visible.map(student => ({
      school_id: schoolId, student_id: student.id, attendance_date: date,
      status: marks[student.id]?.status || 'present', notes: marks[student.id]?.notes || null,
      marked_by: auth.user?.id || null
    }))
    const { error: saveError } = await supabase.from('student_attendance').upsert(rows, { onConflict: 'school_id,student_id,attendance_date' })
    if (saveError) setError(saveError.message)
    else setNotice('Attendance saved successfully.')
    setSaving(false)
  }

  return <section className="panel student-panel">
    <div className="academic-head"><div><p className="kicker">DAILY SCHOOL REGISTER</p><h2>Student attendance</h2><p className="muted">Mark learners present, absent, late or excused for each school day.</p></div><button className="secondary" onClick={() => void load()}><RefreshCw /> Refresh</button></div>
    <div className="school-picker"><label>School<select value={schoolId} onChange={e => setSchoolId(e.target.value)}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Attendance date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label><label>Class filter<select value={classId} onChange={e => setClassId(e.target.value)}><option value="">All classes</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
    {error && <p className="alert error"><XCircle />{error}</p>}{notice && <p className="alert success"><CheckCircle2 />{notice}</p>}
    <div className="stats attendance-stats"><article className="panel"><CheckCircle2/><span>Present</span><b>{counts.present}</b></article><article className="panel"><XCircle/><span>Absent</span><b>{counts.absent}</b></article><article className="panel"><CalendarCheck/><span>Late</span><b>{counts.late}</b></article><article className="panel"><Users/><span>Excused</span><b>{counts.excused}</b></article></div>
    <div className="student-count"><Users/> {visible.length} learner(s) · {date}</div>
    {loading ? <p className="muted">Loading attendance…</p> : visible.length === 0 ? <div className="empty"><Users/><h3>No active learners found</h3><p>Register learners and assign them to this school first.</p></div> : <div className="table-wrap"><table><thead><tr><th>Admission no.</th><th>Learner</th><th>Class</th><th>Attendance</th><th>Notes</th></tr></thead><tbody>{visible.map(s => <tr key={s.id}><td><b>{s.admission_number}</b></td><td><b>{s.first_name} {s.middle_name || ''} {s.last_name}</b></td><td>{classes.find(c => c.id === s.class_id)?.name || '—'}</td><td><select aria-label={'Attendance for ' + s.first_name + ' ' + s.last_name} value={marks[s.id]?.status || 'present'} onChange={e => update(s.id, { status: e.target.value as AttendanceStatus })}><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="excused">Excused</option></select></td><td><input aria-label={'Notes for ' + s.first_name} value={marks[s.id]?.notes || ''} onChange={e => update(s.id, { notes: e.target.value })} placeholder="Optional note" /></td></tr>)}</tbody></table></div>}
    <div className="academic-form-actions"><button className="primary" disabled={saving || loading || !visible.length} onClick={() => void save()}><Save /> {saving ? 'Saving…' : 'Save attendance'}</button></div>
  </section>
}
