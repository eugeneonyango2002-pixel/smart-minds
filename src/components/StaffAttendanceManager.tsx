import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, CheckCircle2, RefreshCw, Save, Users, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string; status?: string }
type Staff = { id: string; first_name: string; last_name: string; employee_number: string; staff_role: string; status: string }
type AttendanceStatus = 'present' | 'absent' | 'late' | 'on_leave'
type Mark = { status: AttendanceStatus; notes: string }
type Leave = { id: string; staff_id: string; leave_type: string; start_date: string; end_date: string; reason: string | null; status: 'pending' | 'approved' | 'rejected'; decision_notes: string | null; created_at: string }
const today = new Date().toISOString().slice(0, 10)
const leaveLabels: Record<string, string> = { annual: 'Annual', sick: 'Sick', maternity: 'Maternity', paternity: 'Paternity', compassionate: 'Compassionate', unpaid: 'Unpaid', other: 'Other' }

export default function StaffAttendanceManager({ schools }: { schools: School[] }) {
  const [schoolId, setSchoolId] = useState('')
  const [date, setDate] = useState(today)
  const [staff, setStaff] = useState<Staff[]>([])
  const [marks, setMarks] = useState<Record<string, Mark>>({})
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [leaveForm, setLeaveForm] = useState({ staff_id: '', leave_type: 'annual', start_date: today, end_date: today, reason: '' })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [leaveSaving, setLeaveSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => { if (!schoolId && schools.length) setSchoolId(schools.find(s => s.status === 'approved')?.id || schools[0].id) }, [schools, schoolId])
  useEffect(() => { if (schoolId) void load() }, [schoolId, date])

  async function load() {
    setLoading(true); setError('')
    const [staffResult, attendanceResult, leaveResult] = await Promise.all([
      supabase.from('staff').select('id,first_name,last_name,employee_number,staff_role,status').eq('school_id', schoolId).order('last_name'),
      supabase.from('staff_attendance').select('staff_id,status,notes').eq('school_id', schoolId).eq('attendance_date', date),
      supabase.from('staff_leave_requests').select('id,staff_id,leave_type,start_date,end_date,reason,status,decision_notes,created_at').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(100)
    ])
    if (staffResult.error) setError(staffResult.error.message)
    else if (attendanceResult.error) setError(attendanceResult.error.message)
    else if (leaveResult.error) setError(leaveResult.error.message)
    else {
      setStaff(staffResult.data || [])
      const existing: Record<string, Mark> = {}
      for (const row of attendanceResult.data || []) existing[row.staff_id] = { status: row.status as AttendanceStatus, notes: row.notes || '' }
      const initial: Record<string, Mark> = {}
      for (const member of staffResult.data || []) if (member.status !== 'inactive') initial[member.id] = existing[member.id] || { status: 'present', notes: '' }
      setMarks(initial)
      setLeaves((leaveResult.data || []) as Leave[])
      setLeaveForm(current => ({ ...current, staff_id: current.staff_id || staffResult.data?.find(s => s.status === 'active')?.id || '' }))
    }
    setLoading(false)
  }

  const activeStaff = useMemo(() => staff.filter(member => member.status !== 'inactive'), [staff])
  const counts = useMemo(() => activeStaff.reduce((result, member) => { result[marks[member.id]?.status || 'present']++; return result }, { present: 0, absent: 0, late: 0, on_leave: 0 }), [activeStaff, marks])

  function updateMark(id: string, patch: Partial<Mark>) {
    setMarks(current => ({ ...current, [id]: { ...(current[id] || { status: 'present', notes: '' }), ...patch } }))
  }

  async function saveAttendance() {
    if (!schoolId || !activeStaff.length) return
    setSaving(true); setError(''); setNotice('')
    const { data: auth } = await supabase.auth.getUser()
    const rows = activeStaff.map(member => ({ school_id: schoolId, staff_id: member.id, attendance_date: date, status: marks[member.id]?.status || 'present', notes: marks[member.id]?.notes || null, marked_by: auth.user?.id || null }))
    const { error } = await supabase.from('staff_attendance').upsert(rows, { onConflict: 'school_id,staff_id,attendance_date' })
    if (error) setError(error.message)
    else setNotice('Staff attendance saved successfully.')
    setSaving(false)
  }

  async function submitLeave(e: React.FormEvent) {
    e.preventDefault()
    if (!schoolId || !leaveForm.staff_id) return
    setLeaveSaving(true); setError(''); setNotice('')
    const { data: auth } = await supabase.auth.getUser()
    const { error } = await supabase.from('staff_leave_requests').insert({ ...leaveForm, school_id: schoolId, reason: leaveForm.reason.trim() || null, submitted_by: auth.user?.id || null })
    if (error) setError(error.message)
    else { setNotice('Leave request recorded successfully.'); setLeaveForm(current => ({ ...current, start_date: today, end_date: today, reason: '' })); await load() }
    setLeaveSaving(false)
  }

  async function decideLeave(id: string, status: 'approved' | 'rejected') {
    setError(''); setNotice('')
    const { data: auth } = await supabase.auth.getUser()
    const { error } = await supabase.from('staff_leave_requests').update({ status, reviewed_by: auth.user?.id || null, reviewed_at: new Date().toISOString() }).eq('id', id).eq('school_id', schoolId).eq('status', 'pending')
    if (error) setError(error.message)
    else { setNotice('Leave request ' + status + '.'); await load() }
  }

  return <section className="panel student-panel">
    <div className="academic-head"><div><p className="kicker">STAFF RECORDS</p><h2>Staff attendance and leave</h2><p className="muted">Record daily staff attendance and track leave requests and decisions.</p></div><button type="button" className="secondary" onClick={() => void load()}><RefreshCw /> Refresh</button></div>
    <div className="school-picker"><label>School<select value={schoolId} onChange={e => setSchoolId(e.target.value)}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Attendance date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label></div>
    {error && <p className="alert error"><XCircle />{error}</p>}{notice && <p className="alert success"><CheckCircle2 />{notice}</p>}
    <section className="panel" style={{ marginTop: 18 }}><h3>Daily staff attendance</h3>
      <div className="stats attendance-stats"><article className="panel"><CheckCircle2/><span>Present</span><b>{counts.present}</b></article><article className="panel"><XCircle/><span>Absent</span><b>{counts.absent}</b></article><article className="panel"><CalendarCheck/><span>Late</span><b>{counts.late}</b></article><article className="panel"><Users/><span>On leave</span><b>{counts.on_leave}</b></article></div>
      {loading ? <p className="muted">Loading staff attendance…</p> : activeStaff.length === 0 ? <p className="muted">No active or on-leave staff records found.</p> : <div className="table-wrap"><table><thead><tr><th>Staff no.</th><th>Staff member</th><th>Role</th><th>Attendance</th><th>Notes</th></tr></thead><tbody>{activeStaff.map(member => <tr key={member.id}><td><b>{member.employee_number}</b></td><td>{member.first_name} {member.last_name}</td><td>{member.staff_role.replace(/_/g, ' ')}</td><td><select value={marks[member.id]?.status || 'present'} onChange={e => updateMark(member.id, { status: e.target.value as AttendanceStatus })}><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option><option value="on_leave">On leave</option></select></td><td><input value={marks[member.id]?.notes || ''} onChange={e => updateMark(member.id, { notes: e.target.value })} placeholder="Optional note" /></td></tr>)}</tbody></table></div>}
      <div className="academic-form-actions"><button type="button" className="primary" disabled={saving || loading || !activeStaff.length} onClick={() => void saveAttendance()}><Save /> {saving ? 'Saving…' : 'Save staff attendance'}</button></div>
    </section>
    <section className="panel" style={{ marginTop: 18 }}><h3>Record a leave request</h3><form className="academic-form" onSubmit={submitLeave}>
      <label>Staff member *<select required value={leaveForm.staff_id} onChange={e => setLeaveForm({ ...leaveForm, staff_id: e.target.value })}><option value="">Choose staff</option>{staff.map(member => <option key={member.id} value={member.id}>{member.first_name} {member.last_name} ({member.employee_number})</option>)}</select></label>
      <label>Leave type *<select value={leaveForm.leave_type} onChange={e => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}>{Object.entries(leaveLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Start date *<input required type="date" value={leaveForm.start_date} onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })} /></label>
      <label>End date *<input required min={leaveForm.start_date} type="date" value={leaveForm.end_date} onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })} /></label>
      <label className="wide">Reason / notes<textarea rows={2} value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} placeholder="Optional details" /></label>
      <button className="primary" disabled={leaveSaving || !staff.length}>{leaveSaving ? 'Saving…' : 'Save leave request'}</button>
    </form>
    <h3 style={{ marginTop: 22 }}>Leave requests</h3>
    {leaves.length === 0 ? <p className="muted">No leave requests recorded.</p> : <div className="table-wrap"><table><thead><tr><th>Staff member</th><th>Leave</th><th>Dates</th><th>Reason</th><th>Status / action</th></tr></thead><tbody>{leaves.map(leave => { const member = staff.find(s => s.id === leave.staff_id); return <tr key={leave.id}><td>{member ? member.first_name + ' ' + member.last_name : 'Staff member'}</td><td>{leaveLabels[leave.leave_type] || leave.leave_type}</td><td>{leave.start_date} – {leave.end_date}</td><td>{leave.reason || '—'}</td><td>{leave.status === 'pending' ? <div className="actions"><button type="button" className="secondary" onClick={() => void decideLeave(leave.id, 'approved')}>Approve</button><button type="button" className="secondary" onClick={() => void decideLeave(leave.id, 'rejected')}>Reject</button></div> : <span className={'status ' + (leave.status === 'approved' ? 'approved' : 'pending')}>{leave.status}</span>}</td></tr> })}</tbody></table></div>}
    </section>
  </section>
}
