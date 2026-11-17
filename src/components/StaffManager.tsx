import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Search, RefreshCw, Users, XCircle, CheckCircle2, UserPlus, Copy, Upload, FileSpreadsheet } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string; status?: string }
type ClassRow = { id: string; name: string }
type SubjectRow = { id: string; name: string; is_examinable: boolean }
type Allocation = { id: string; subject_id: string; teacher_id: string | null; lessons_per_week: number | null }
type WorkloadAllocation = { id: string; class_id: string; subject_id: string; teacher_id: string | null; lessons_per_week: number | null }
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [invitation, setInvitation] = useState<{ code: string; name: string } | null>(null)
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [copyNotice, setCopyNotice] = useState('')
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [workloadAllocations, setWorkloadAllocations] = useState<WorkloadAllocation[]>([])
  const [allocationBusy, setAllocationBusy] = useState(false)
  const [balancingBusy, setBalancingBusy] = useState<string | null>(null)
  const [allocationLoading, setAllocationLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  useEffect(() => {
    if (!schoolId && schools.length) setSchoolId(schools.find(s => s.status === 'approved')?.id || schools[0].id)
  }, [schools, schoolId])
  useEffect(() => { if (schoolId) { void load(); void loadAllocationSetup() } }, [schoolId])
  async function loadAllocationSetup() {
    setAllocationLoading(true)
    const [{ data: classRows, error: classError }, { data: subjectRows, error: subjectError }] = await Promise.all([
      supabase.from('classes').select('id,name').eq('school_id', schoolId).order('sort_order'),
      supabase.from('subjects').select('id,name,is_examinable').eq('school_id', schoolId).order('name'),
    ])
    if (classError) setError(classError.message)
    else {
      const nextClasses = (classRows || []) as ClassRow[]
      setClasses(nextClasses)
      setSelectedClassId(current => nextClasses.some(row => row.id === current) ? current : nextClasses[0]?.id || '')
    }
    if (subjectError) setError(subjectError.message)
    else setSubjects((subjectRows || []) as SubjectRow[])
    setAllocationLoading(false)
  }
  async function loadWorkload() {
    if (!schoolId) { setWorkloadAllocations([]); return }
    const { data, error } = await supabase.from('class_subjects').select('id,class_id,subject_id,teacher_id,lessons_per_week').eq('school_id', schoolId)
    if (error) setError(error.message)
    else setWorkloadAllocations((data || []) as WorkloadAllocation[])
  }
  async function loadAllocations(classId: string) {
    if (!schoolId || !classId) { setAllocations([]); return }
    setAllocationLoading(true)
    const { data, error } = await supabase.from('class_subjects')
      .select('id,subject_id,teacher_id,lessons_per_week')
      .eq('school_id', schoolId).eq('class_id', classId)
    if (error) setError(error.message)
    else setAllocations((data || []) as Allocation[])
    setAllocationLoading(false)
  }
  useEffect(() => { if (selectedClassId) void loadAllocations(selectedClassId) }, [selectedClassId, schoolId])
  useEffect(() => { if (schoolId) void loadWorkload() }, [schoolId])
  async function saveTeacherAssignment(allocationId: string, teacherId: string) {
    setAllocationBusy(true); setError(''); setNotice('')
    const { error } = await supabase.from('class_subjects').update({ teacher_id: teacherId || null })
      .eq('id', allocationId).eq('school_id', schoolId)
    if (error) setError(error.message)
    else {
      setAllocations(current => current.map(row => row.id === allocationId ? { ...row, teacher_id: teacherId || null } : row))
      setNotice('Teacher assignment saved successfully.')
    }
    setAllocationBusy(false)
  }
  async function rebalanceTeacherAssignment(allocationId: string, teacherId: string) {
    setBalancingBusy(allocationId); setError(''); setNotice('')
    const { error } = await supabase.from('class_subjects')
      .update({ teacher_id: teacherId || null })
      .eq('id', allocationId).eq('school_id', schoolId)
    if (error) setError(error.message)
    else {
      setWorkloadAllocations(current => current.map(row => row.id === allocationId ? { ...row, teacher_id: teacherId || null } : row))
      setAllocations(current => current.map(row => row.id === allocationId ? { ...row, teacher_id: teacherId || null } : row))
      setNotice('Teaching assignment updated. Teacher workloads have been recalculated.')
    }
    setBalancingBusy(null)
  }
  async function load() {
    setError('')
    const { data, error } = await supabase.from('staff').select('*').eq('school_id', schoolId).order('last_name').order('first_name')
    if (error) setError(error.message)
    else setStaff((data || []) as Staff[])
  }
  const teacherWorkloads = useMemo(() => {
    const teachers = staff.filter(member => member.staff_role === 'teacher' && member.status === 'active')
    const rows = teachers.map(teacher => {
      const assigned = workloadAllocations.filter(row => row.teacher_id === teacher.id)
      const lessons = assigned.reduce((total, row) => total + (Number(row.lessons_per_week) || 0), 0)
      const classIds = [...new Set(assigned.map(row => row.class_id))]
      const subjectIds = [...new Set(assigned.map(row => row.subject_id))]
      return { teacher, lessons, classes: classIds.map(id => classes.find(item => item.id === id)?.name || 'Class'), subjects: subjectIds.map(id => subjects.find(item => item.id === id)?.name || 'Subject') }
    })
    const average = rows.length ? rows.reduce((total, row) => total + row.lessons, 0) / rows.length : 0
    return rows.map(row => ({ ...row, comparison: row.lessons === 0 ? 'No lessons assigned' : row.lessons > average ? 'Above school average' : row.lessons < average ? 'Below school average' : 'At school average' }))
  }, [staff, workloadAllocations, classes, subjects])
  const visible = useMemo(() => staff.filter(s =>
    (s.first_name + ' ' + (s.middle_name || '') + ' ' + s.last_name + ' ' + s.employee_number + ' ' + (s.phone || '') + ' ' + (s.email || '')).toLowerCase().includes(search.toLowerCase())
  ), [staff, search])
  async function createInvitation(member: Staff) {
    setInvitingId(member.id); setError(''); setNotice(''); setInvitation(null); setCopyNotice('')
    const role = member.staff_role === 'other' ? 'support_staff' : member.staff_role
    const { data, error } = await supabase.rpc('create_staff_invitation', { p_staff_id: member.id, p_role: role })
    if (error) setError(error.message)
    else {
      setInvitation({ code: String(data), name: member.first_name + ' ' + member.last_name })
      setNotice('Invitation created for ' + member.first_name + ' ' + member.last_name + '. It expires in 1 hour.')
    }
    setInvitingId(null)
  }
  async function copyInvitation() {
    if (!invitation) return
    try {
      await navigator.clipboard.writeText(invitation.code)
      setCopyNotice('Invitation code copied. Share it securely with the staff member.')
    } catch {
      setCopyNotice('Select and copy the invitation code shown above.')
    }
  }
  function parseCsvLine(line: string): string[] {
    const values: string[] = []
    let value = ''
    let quoted = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++ }
      else if (char === '"') quoted = !quoted
      else if (char === ',' && !quoted) { values.push(value.trim()); value = '' }
      else value += char
    }
    values.push(value.trim())
    return values
  }
  function downloadStaffTemplate() {
    const csv = 'Name,Phone,Email,Role,Employment Type,Date Joined\nExample Teacher,0712345678,teacher@example.com,teacher,permanent,2026-01-01\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = 'Smart_Minds_Staff_Registration_Template.csv'; link.click(); URL.revokeObjectURL(url)
  }
  async function importStaffFile(file?: File) {
    if (!file || !schoolId) return
    setImporting(true); setError(''); setNotice('')
    try {
      const lines = (await file.text()).replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim())
      if (lines.length < 2) throw new Error('The file must contain a heading row and at least one staff record.')
      const headers = parseCsvLine(lines[0]).map(value => value.toLowerCase().replace(/[\s_-]+/g, ''))
      const nameIndex = headers.findIndex(value => ['name','fullname','staffname','employeename'].includes(value))
      if (nameIndex < 0) throw new Error('Please include a Name column. Example: Name, Phone, Email, Role.')
      const index = (names: string[]) => headers.findIndex(value => names.includes(value))
      const phoneIndex = index(['phone','phonenumber','mobile'])
      const emailIndex = index(['email','emailaddress'])
      const roleIndex = index(['role','staffrole','position'])
      const employmentIndex = index(['employmenttype','employment'])
      const dateIndex = index(['datejoined','dateofjoining'])
      const records = lines.slice(1).map((line, rowIndex) => {
        const cells = parseCsvLine(line)
        const fullName = (cells[nameIndex] || '').trim()
        if (!fullName) throw new Error('A staff name is missing on CSV row ' + (rowIndex + 2) + '.')
        const parts = fullName.split(/\s+/)
        const rawRole = roleIndex >= 0 ? (cells[roleIndex] || '').trim().toLowerCase().replace(/[\s-]+/g, '_') : 'teacher'
        const roles = ['teacher','head_teacher','deputy_head_teacher','bursar','secretary','support_staff','other']
        const rawEmployment = employmentIndex >= 0 ? (cells[employmentIndex] || '').trim().toLowerCase().replace(/[\s-]+/g, '_') : 'permanent'
        const employments = ['permanent','contract','part_time','intern','volunteer']
        return {
          school_id: schoolId, employee_number: '',
          first_name: parts[0], middle_name: parts.length > 2 ? parts.slice(1, -1).join(' ') : null,
          last_name: parts.length > 1 ? parts[parts.length - 1] : parts[0],
          phone: phoneIndex >= 0 ? (cells[phoneIndex] || '').trim() || null : null,
          email: emailIndex >= 0 ? (cells[emailIndex] || '').trim() || null : null,
          staff_role: roles.includes(rawRole) ? rawRole : 'teacher',
          employment_type: employments.includes(rawEmployment) ? rawEmployment : 'permanent',
          date_joined: dateIndex >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(cells[dateIndex] || '') ? cells[dateIndex] : new Date().toISOString().slice(0, 10),
          status: 'active'
        }
      })
      const { error } = await supabase.from('staff').insert(records)
      if (error) throw error
      setNotice(records.length + ' staff member(s) imported successfully. Staff numbers were generated automatically.')
      await load()
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not import this file.')
    } finally { setImporting(false) }
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!schoolId) return
    setBusy(true); setError(''); setNotice('')
    const payload = {
      ...form, school_id: schoolId, middle_name: form.middle_name || null,
      gender: form.gender || null, phone: form.phone || null, email: form.email || null
    }
    const result = editingId ? await supabase.from('staff').update(payload).eq('id', editingId).eq('school_id', schoolId) : await supabase.from('staff').insert(payload)
    const error = result.error
    if (error) setError(error.message)
    else {
      setNotice(editingId ? 'Staff details updated successfully.' : 'Staff member added successfully.')
      setForm(blank); setAdding(false); setEditingId(null); await load()
    }
    setBusy(false)
  }
  return <section className="panel student-panel">
    <div className="academic-head"><div><p className="kicker">SCHOOL RECORDS</p><h2>Staff management</h2><p className="muted">Register teachers and employees, record their roles and contact details, and maintain the staff register.</p></div><button className="secondary" onClick={() => void load()}><RefreshCw /> Refresh</button></div>
    <label className="school-picker">Select school<select value={schoolId} onChange={e => { setSchoolId(e.target.value); setAdding(false) }}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <div className="student-toolbar"><div className="student-search"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, staff number, phone or email" /></div><button className="primary" disabled={!schoolId} onClick={() => { setAdding(!adding); setEditingId(null); setForm(blank); setError(''); setNotice('') }}><Plus /> Add staff member</button></div>
    <div className="student-toolbar" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
      <button type="button" className="secondary" onClick={downloadStaffTemplate}><FileSpreadsheet /> Download Staff CSV Template</button>
      <label className="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: importing ? 'wait' : 'pointer', padding: '10px 14px', borderRadius: 10 }}>
        <Upload /> {importing ? 'Importing staff…' : 'Upload staff CSV'}
        <input type="file" accept=".csv,text/csv" disabled={!schoolId || importing} onChange={e => { void importStaffFile(e.target.files?.[0]); e.currentTarget.value = '' }} style={{ display: 'none' }} />
      </label>
    </div>
    <p className="muted">CSV must have a <b>Name</b> column. Optional columns: Phone, Email, Role, Employment Type, Date Joined (YYYY-MM-DD). New staff numbers are generated automatically.</p>
    {error && <p className="alert error"><XCircle />{error}</p>}{notice && <p className="alert success"><CheckCircle2 />{notice}</p>}
    {invitation && <div className="notice invitation-panel"><div><b>Staff invitation for {invitation.name}</b><p className="muted">This one-time code expires 1 hour after it was created. The staff member must register/sign in using the email on their staff record.</p><code className="invitation-code">{invitation.code}</code>{copyNotice && <p className="muted">{copyNotice}</p>}</div><button type="button" className="secondary" onClick={() => void copyInvitation()}><Copy /> Copy code</button></div>}
    {adding && <form className="academic-form" onSubmit={save}>
      <h3>{editingId ? 'Edit staff member' : 'Register staff member'}</h3>
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
      <div className="academic-form-actions"><button type="button" className="secondary" onClick={() => { setAdding(false); setEditingId(null); setForm(blank) }}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Update staff details' : 'Save staff member'}</button></div>
    </form>}
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="academic-head"><div><p className="kicker">TEACHING LOAD</p><h2>Teacher workload overview</h2><p className="muted">Compare each active teacher's assigned lessons per week, classes and subjects. The comparison is against your school's current teacher average.</p></div><button type="button" className="secondary" onClick={() => void loadWorkload()}><RefreshCw /> Refresh workload</button></div>
      {teacherWorkloads.length === 0 ? <p className="muted">Register active teachers to see their workload.</p> : <div className="table-wrap"><table><thead><tr><th>Teacher</th><th>Lessons / week</th><th>Classes</th><th>Subjects</th><th>Workload comparison</th></tr></thead><tbody>{teacherWorkloads.map(row => <tr key={row.teacher.id}><td><b>{row.teacher.first_name} {row.teacher.last_name}</b><small>{row.teacher.employee_number}</small></td><td><b>{row.lessons}</b></td><td>{row.classes.length ? row.classes.join(', ') : '—'}</td><td>{row.subjects.length ? row.subjects.join(', ') : '—'}</td><td><span className={'status ' + (row.comparison === 'Above school average' || row.comparison === 'No lessons assigned' ? 'pending' : 'approved')}>{row.comparison}</span></td></tr>)}</tbody></table></div>}
      <p className="muted">Totals use lessons-per-week values in Teacher–Subject Allocation. Above/below average is a guide, not a fixed staffing limit.</p>
      <div style={{ marginTop: 18 }}><h3>Workload balancing</h3><p className="muted">Move a class subject from one teacher to another below. The weekly lesson total will update automatically. Choose “Not assigned” to leave a subject unallocated.</p>
      {workloadAllocations.length === 0 ? <p className="muted">No class subject allocations are available yet.</p> : <div className="table-wrap"><table><thead><tr><th>Class</th><th>Subject</th><th>Lessons / week</th><th>Currently assigned teacher</th><th>Reassign to</th></tr></thead><tbody>{workloadAllocations.map(row => {
        const assignedTeacher = staff.find(member => member.id === row.teacher_id)
        return <tr key={row.id}><td>{classes.find(item => item.id === row.class_id)?.name || 'Class'}</td><td><b>{subjects.find(item => item.id === row.subject_id)?.name || 'Subject'}</b></td><td>{row.lessons_per_week ?? '—'}</td><td>{assignedTeacher ? assignedTeacher.first_name + ' ' + assignedTeacher.last_name : 'Not assigned'}</td><td><select aria-label={'Reassign ' + (subjects.find(item => item.id === row.subject_id)?.name || 'subject')} value={row.teacher_id || ''} disabled={balancingBusy !== null} onChange={e => void rebalanceTeacherAssignment(row.id, e.target.value)}><option value="">Not assigned</option>{staff.filter(member => member.staff_role === 'teacher' && member.status === 'active').map(member => <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>)}</select>{balancingBusy === row.id && <small>Saving…</small>}</td></tr>
      })}</tbody></table></div>}</div>
    </section>
    <section className="panel" style={{ marginTop: 22 }}>
      <div className="academic-head"><div><p className="kicker">TEACHING PLAN</p><h2>Teacher–subject allocation</h2><p className="muted">Assign an active registered teacher to each approved subject in a class. These assignments will be used by the timetable.</p></div><button type="button" className="secondary" onClick={() => { void loadAllocationSetup(); if (selectedClassId) void loadAllocations(selectedClassId) }}><RefreshCw /> Refresh</button></div>
      <label className="school-picker">Select class<select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} disabled={!classes.length}><option value="">Choose a class</option>{classes.filter(c => /^(PP1|PP2|Grade [1-9])$/.test(c.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      {allocationLoading ? <p className="muted">Loading class subjects…</p> : !selectedClassId ? <p className="muted">No PP1–Grade 9 classes are available yet.</p> : allocations.length === 0 ? <p className="muted">No subject allocations found for this class. Check the CBC subject setup first.</p> : <div className="table-wrap"><table><thead><tr><th>Approved subject</th><th>Lessons / week</th><th>Assigned teacher</th></tr></thead><tbody>{allocations.map(row => {
        const subject = subjects.find(item => item.id === row.subject_id)
        return <tr key={row.id}><td><b>{subject?.name || 'Unknown subject'}</b>{subject && !subject.is_examinable && <small>Non-examinable</small>}</td><td>{row.lessons_per_week ?? '—'}</td><td><select aria-label={'Teacher for ' + (subject?.name || 'subject')} value={row.teacher_id || ''} disabled={allocationBusy} onChange={e => void saveTeacherAssignment(row.id, e.target.value)}><option value="">Not assigned</option>{staff.filter(member => member.staff_role === 'teacher' && member.status === 'active').map(member => <option key={member.id} value={member.id}>{member.first_name} {member.middle_name || ''} {member.last_name} ({member.employee_number})</option>)}</select></td></tr>
      })}</tbody></table></div>}
      {staff.filter(member => member.staff_role === 'teacher' && member.status === 'active').length === 0 && <p className="muted">No active teachers are available. Register teachers with the Teacher role and Active status.</p>}
    </section>
    <div className="student-count"><Users /> {visible.length} staff record(s)</div>
    {visible.length === 0 ? <div className="empty"><Users /><h3>No staff found</h3><p>Add your first teacher or employee to begin building the staff register.</p></div> : <div className="table-wrap"><table><thead><tr><th>Staff no.</th><th>Staff member</th><th>Role</th><th>Contact</th><th>Employment</th><th>Date joined</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map(s => <tr key={s.id}><td><b>{s.employee_number}</b></td><td><b>{s.first_name} {s.middle_name || ''} {s.last_name}</b><small>{s.gender || '—'}</small></td><td>{roleLabels[s.staff_role] || s.staff_role}</td><td>{s.phone || '—'}<small>{s.email || ''}</small></td><td>{s.employment_type.replace(/_/g, ' ')}</td><td>{s.date_joined}</td><td><span className={'status ' + (s.status === 'active' ? 'approved' : 'pending')}>{s.status.replace(/_/g, ' ')}</span></td><td><div className="actions"><button type="button" className="secondary" onClick={() => { setForm({ employee_number: s.employee_number, first_name: s.first_name, middle_name: s.middle_name || '', last_name: s.last_name, gender: s.gender || '', phone: s.phone || '', email: s.email || '', staff_role: s.staff_role, employment_type: s.employment_type, date_joined: s.date_joined, status: s.status }); setEditingId(s.id); setAdding(true); setError(''); setNotice('') }}>Edit</button><button type="button" className="secondary" disabled={!s.email || s.status !== 'active' || invitingId === s.id} onClick={() => void createInvitation(s)}><UserPlus /> {invitingId === s.id ? 'Creating…' : 'Invite'}</button></div></td></tr>)}</tbody></table></div>}
  </section>
}
