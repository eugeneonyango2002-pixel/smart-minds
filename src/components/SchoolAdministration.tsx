import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, RefreshCw, Network, Users, UserRound, Pencil, Trash2, XCircle, CheckCircle2, Download, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string }
type Staff = { id: string; first_name: string; middle_name: string | null; last_name: string; staff_role: string; status: string }
type Position = { id: string; school_id: string; title: string; department: string | null; description: string | null; parent_position_id: string | null; staff_id: string | null; sort_order: number; is_active: boolean }
const emptyForm = { title: '', department: '', description: '', parent_position_id: '', staff_id: '', sort_order: '0', is_active: true }

export default function SchoolAdministration({ schools, canManage = false }: { schools: School[]; canManage?: boolean }) {
  const [schoolId, setSchoolId] = useState('')
  const [positions, setPositions] = useState<Position[]>([])
  const [staff, setStaff] = useState<Staff[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!schoolId && schools.length) setSchoolId(schools[0].id)
  }, [schools, schoolId])

  useEffect(() => { if (schoolId) void load() }, [schoolId])

  async function load() {
    setLoading(true); setError('')
    const [positionResult, staffResult] = await Promise.all([
      supabase.from('school_positions').select('*').eq('school_id', schoolId).order('sort_order').order('title'),
      supabase.from('staff').select('id,first_name,middle_name,last_name,staff_role,status').eq('school_id', schoolId).order('last_name').order('first_name')
    ])
    if (positionResult.error) setError(positionResult.error.message)
    else setPositions((positionResult.data || []) as Position[])
    if (staffResult.error) setError(staffResult.error.message)
    else setStaff((staffResult.data || []) as Staff[])
    setLoading(false)
  }

  const activeStaff = useMemo(() => staff.filter(person => person.status === 'active'), [staff])
  const assignedCount = positions.filter(position => position.staff_id && position.is_active).length
  const vacantCount = positions.filter(position => !position.staff_id && position.is_active).length
  const schoolName = schools.find(school => school.id === schoolId)?.name || 'Selected school'
  const staffName = (id: string | null) => {
    const person = staff.find(item => item.id === id)
    return person ? [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ') : ''
  }
  const childrenOf = (parentId: string | null) => positions.filter(position => position.parent_position_id === parentId && position.is_active).sort((a,b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title))

  function openNew(parentId = '') {
    setEditingId(null); setForm({ ...emptyForm, parent_position_id: parentId }); setShowForm(true); setError(''); setNotice('')
  }
  function openEdit(position: Position) {
    setEditingId(position.id)
    setForm({ title: position.title, department: position.department || '', description: position.description || '', parent_position_id: position.parent_position_id || '', staff_id: position.staff_id || '', sort_order: String(position.sort_order), is_active: position.is_active })
    setShowForm(true); setError(''); setNotice('')
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!schoolId || !form.title.trim()) return
    setSaving(true); setError(''); setNotice('')
    const payload = {
      school_id: schoolId, title: form.title.trim(), department: form.department.trim() || null,
      description: form.description.trim() || null, parent_position_id: form.parent_position_id || null,
      staff_id: form.staff_id || null, sort_order: Number(form.sort_order) || 0, is_active: form.is_active
    }
    if (payload.parent_position_id === editingId) {
      setError('A position cannot report to itself.'); setSaving(false); return
    }
    const result = editingId
      ? await supabase.from('school_positions').update(payload).eq('id', editingId).eq('school_id', schoolId)
      : await supabase.from('school_positions').insert(payload)
    if (result.error) setError(result.error.message)
    else { setNotice(editingId ? 'Position updated successfully.' : 'Position added successfully.'); setShowForm(false); setForm(emptyForm); setEditingId(null); await load() }
    setSaving(false)
  }
  async function remove(position: Position) {
    if (!window.confirm('Delete the position "' + position.title + '"? Any positions reporting to it will become top-level positions.')) return
    setError(''); setNotice('')
    const { error } = await supabase.from('school_positions').delete().eq('id', position.id).eq('school_id', schoolId)
    if (error) setError(error.message)
    else { setNotice('Position deleted.'); await load() }
  }
  async function addSuggestedStructure() {
    if (!schoolId || positions.length) return
    if (!window.confirm('Add a suggested school leadership structure? You can edit, assign staff and remove positions afterwards.')) return
    setSaving(true); setError(''); setNotice('')
    const add = async (title: string, parentId: string | null, sort: number, department: string | null = null) => {
      const { data, error } = await supabase.from('school_positions').insert({ school_id: schoolId, title, parent_position_id: parentId, sort_order: sort, department }).select('id').single()
      if (error) throw error
      return String(data.id)
    }
    try {
      const board = await add('Board of Management', null, 1, 'Governance')
      const head = await add('Headteacher / Principal', board, 2, 'School leadership')
      const deputy = await add('Deputy Headteacher', head, 3, 'School leadership')
      await add('Senior Teacher / Academic Coordinator', deputy, 4, 'Academic')
      await add('Heads of Department', deputy, 5, 'Academic')
      await add('Class Teachers', deputy, 6, 'Teaching')
      await add('Subject Teachers', deputy, 7, 'Teaching')
      await add('Bursar', head, 8, 'Finance')
      await add('School Secretary', head, 9, 'Administration')
      await add('Support Staff', head, 10, 'Operations')
      setNotice('Suggested structure created. Assign staff members and adjust reporting lines to suit your school.')
      await load()
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not create the suggested structure.'); await load() }
    setSaving(false)
  }

  function renderBranch(position: Position, depth = 0): JSX.Element {
    const children = childrenOf(position.id)
    return <div className="org-branch" key={position.id} style={{ '--org-depth': depth } as React.CSSProperties}>
      <article className={'org-node' + (position.staff_id ? ' filled' : ' vacant')}>
        <div className="org-node-top"><span className="org-node-icon"><Building2 /></span><span className={position.staff_id ? 'org-status filled' : 'org-status vacant'}>{position.staff_id ? 'Assigned' : 'Vacant'}</span></div>
        <h3>{position.title}</h3>
        {position.department && <p className="org-department">{position.department}</p>}
        <p className="org-assignee">{position.staff_id ? <><UserRound /> {staffName(position.staff_id) || 'Staff member'}</> : <><Users /> Position available</>}</p>
        {position.description && <p className="org-description">{position.description}</p>}
        {canManage && <div className="org-actions"><button type="button" className="secondary" onClick={() => openEdit(position)}><Pencil /> Edit</button><button type="button" className="danger" onClick={() => void remove(position)}><Trash2 /> Delete</button><button type="button" className="secondary" onClick={() => openNew(position.id)}><Plus /> Add reporting position</button></div>}
      </article>
      {children.length > 0 && <div className="org-children">{children.map(child => renderBranch(child, depth + 1))}</div>}
    </div>
  }

  const roots = childrenOf(null)
  const downloadChart = () => window.print()

  return <section className="panel school-admin-panel">
    <div className="academic-head"><div><p className="kicker">SCHOOL LEADERSHIP</p><h2>School administration structure</h2><p className="muted">Build the school's organisational chart, appoint registered staff and define reporting lines.</p></div><button className="secondary" type="button" onClick={() => void load()} disabled={loading}><RefreshCw /> Refresh</button></div>
    <label className="school-picker">Select school<select value={schoolId} onChange={event => { setSchoolId(event.target.value); setShowForm(false) }}>{schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}</select></label>
    <div className="org-summary"><article><Network /><span>Positions</span><b>{positions.length}</b></article><article><UserRound /><span>Assigned</span><b>{assignedCount}</b></article><article><Users /><span>Vacant</span><b>{vacantCount}</b></article><article><Users /><span>Active staff</span><b>{activeStaff.length}</b></article></div>
    {error && <p className="alert error"><XCircle />{error}</p>}{notice && <p className="alert success"><CheckCircle2 />{notice}</p>}
    {canManage && <div className="student-toolbar org-toolbar"><button type="button" className="primary" onClick={() => openNew()}><Plus /> Add position</button>{positions.length === 0 && <button type="button" className="secondary" onClick={() => void addSuggestedStructure()} disabled={saving}><Network /> {saving ? 'Creating…' : 'Create suggested structure'}</button>}<button type="button" className="secondary" onClick={downloadChart}><Download /> Print organisational chart</button></div>}
    {!canManage && <div className="student-toolbar org-toolbar"><button type="button" className="secondary" onClick={downloadChart}><Download /> Print organisational chart</button></div>}
    {showForm && canManage && <form className="academic-form org-form" onSubmit={save}>
      <h3>{editingId ? 'Edit position' : 'Add school position'}</h3>
      <label>Position title *<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="e.g. Deputy Headteacher" /></label>
      <label>Department / section<input value={form.department} onChange={event => setForm({ ...form, department: event.target.value })} placeholder="e.g. Academic" /></label>
      <label>Reports to<select value={form.parent_position_id} onChange={event => setForm({ ...form, parent_position_id: event.target.value })}><option value="">Top level / reports to governance</option>{positions.filter(position => position.id !== editingId && position.is_active).map(position => <option key={position.id} value={position.id}>{position.title}</option>)}</select></label>
      <label>Appointed staff member<select value={form.staff_id} onChange={event => setForm({ ...form, staff_id: event.target.value })}><option value="">Vacant — not assigned</option>{activeStaff.map(person => <option key={person.id} value={person.id}>{[person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ')}</option>)}</select></label>
      <label>Display order<input type="number" value={form.sort_order} onChange={event => setForm({ ...form, sort_order: event.target.value })} /></label>
      <label>Status<select value={form.is_active ? 'active' : 'inactive'} onChange={event => setForm({ ...form, is_active: event.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      <label className="wide">Responsibilities / notes<textarea rows={3} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
      <div className="academic-form-actions"><button type="button" className="secondary" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancel</button><button className="primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save position'}</button></div>
    </form>}
    {loading ? <div className="empty"><RefreshCw /><p>Loading school structure…</p></div> : positions.length === 0 ? <div className="empty"><Network /><h3>No structure has been created</h3><p>Start with a suggested Kenyan school structure, or add the school's positions one by one.</p></div> : roots.length === 0 ? <div className="empty"><Network /><h3>Review reporting lines</h3><p>All positions currently have a reporting position. Edit one to make it a top-level position.</p></div> : <div className="org-chart"><div className="org-school-title"><Building2 /><b>{schoolName}</b></div><div className="org-roots">{roots.map(position => renderBranch(position))}</div></div>}
    <p className="muted org-footnote">The chart is a school-defined management guide. It does not change a staff member's system login role or permissions.</p>
  </section>
}
