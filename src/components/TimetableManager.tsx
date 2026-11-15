import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, Plus, RefreshCw, Trash2, XCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string }
type Row = { id: string; name?: string; [key: string]: any }
type Entry = { id: string; academic_year_id: string; term_id: string | null; class_id: string; stream_id: string | null; subject_id: string; teacher_id: string | null; day_of_week: number; start_time: string; end_time: string; room: string | null; lesson_notes: string | null }

const days = [{id:1,name:'Monday'},{id:2,name:'Tuesday'},{id:3,name:'Wednesday'},{id:4,name:'Thursday'},{id:5,name:'Friday'}]
const blank = { academic_year_id:'', term_id:'', class_id:'', stream_id:'', subject_id:'', teacher_id:'', day_of_week:'1', start_time:'08:00', end_time:'08:40', room:'', lesson_notes:'' }
const staffName = (s: Partial<Row>) => [s.first_name,s.middle_name,s.last_name].filter(Boolean).join(' ')

export default function TimetableManager({ schools }: { schools: School[] }) {
  const [schoolId,setSchoolId] = useState('')
  const [years,setYears] = useState<Row[]>([])
  const [terms,setTerms] = useState<Row[]>([])
  const [classes,setClasses] = useState<Row[]>([])
  const [streams,setStreams] = useState<Row[]>([])
  const [subjects,setSubjects] = useState<Row[]>([])
  const [staff,setStaff] = useState<Row[]>([])
  const [entries,setEntries] = useState<Entry[]>([])
  const [form,setForm] = useState(blank)
  const [filterClass,setFilterClass] = useState('all')
  const [filterYear,setFilterYear] = useState('')
  const [filterTerm,setFilterTerm] = useState('all')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')

  useEffect(()=>{ if(!schoolId && schools.length) setSchoolId(schools[0].id) },[schools,schoolId])
  useEffect(()=>{ if(schoolId) void load() },[schoolId])

  async function load() {
    setError('')
    const [y,t,c,st,s,staffRows,e] = await Promise.all([
      supabase.from('academic_years').select('id,name').eq('school_id',schoolId).order('start_date'),
      supabase.from('terms').select('id,name,academic_year_id').eq('school_id',schoolId).order('start_date'),
      supabase.from('classes').select('id,name').eq('school_id',schoolId).order('sort_order'),
      supabase.from('streams').select('*').eq('school_id',schoolId).order('name'),
      supabase.from('subjects').select('id,name').eq('school_id',schoolId).order('name'),
      supabase.from('staff').select('id,first_name,middle_name,last_name,staff_role,status').eq('school_id',schoolId).eq('status','active').order('last_name'),
      supabase.from('timetable_entries').select('*').eq('school_id',schoolId).order('day_of_week').order('start_time')
    ])
    const failed=[y,t,c,st,s,staffRows,e].find(x=>x.error)
    if(failed?.error){setError(failed.error.message);return}
    setYears(y.data||[]);setTerms(t.data||[]);setClasses(c.data||[]);setStreams(st.data||[])
    setSubjects(s.data||[]);setStaff(staffRows.data||[]);setEntries((e.data||[]) as Entry[])
    if(!form.academic_year_id && y.data?.[0]) setForm(v=>({...v,academic_year_id:y.data![0].id}))
    if(!filterYear && y.data?.[0]) setFilterYear(y.data[0].id)
  }

  const visible=useMemo(()=>entries.filter(e=>
    (!filterYear || e.academic_year_id===filterYear) &&
    (filterClass==='all' || e.class_id===filterClass) &&
    (filterTerm==='all' || (filterTerm==='none' ? !e.term_id : e.term_id===filterTerm))
  ),[entries,filterYear,filterClass,filterTerm])

  async function save(e:FormEvent) {
    e.preventDefault()
    if(!schoolId) return
    if(form.end_time<=form.start_time){setError('Lesson end time must be later than its start time.');return}
    setBusy(true);setError('');setNotice('')
    const payload={school_id:schoolId,academic_year_id:form.academic_year_id,term_id:form.term_id||null,class_id:form.class_id,stream_id:form.stream_id||null,subject_id:form.subject_id,teacher_id:form.teacher_id||null,day_of_week:Number(form.day_of_week),start_time:form.start_time,end_time:form.end_time,room:form.room.trim()||null,lesson_notes:form.lesson_notes.trim()||null}
    const {data:existing,error:checkError}=await supabase.from('timetable_entries').select('id,class_id,teacher_id,day_of_week,start_time,end_time').eq('school_id',schoolId).eq('academic_year_id',form.academic_year_id).eq('day_of_week',Number(form.day_of_week))
    if(checkError){setError(checkError.message);setBusy(false);return}
    const overlaps=(existing||[]).some((x:any)=>x.start_time<form.end_time && x.end_time>form.start_time && ((x.class_id===form.class_id && (!form.stream_id || x.stream_id===form.stream_id)) || (form.teacher_id && x.teacher_id===form.teacher_id)))
    if(overlaps){setError('This time overlaps an existing lesson for the selected class/stream or teacher.');setBusy(false);return}
    const {error}=await supabase.from('timetable_entries').insert(payload)
    if(error)setError(error.message)
    else{setNotice('Lesson added to the timetable.');setForm(v=>({...blank,academic_year_id:v.academic_year_id,class_id:v.class_id,day_of_week:v.day_of_week}));await load()}
    setBusy(false)
  }

  async function remove(id:string){
    if(!window.confirm('Remove this lesson from the timetable?')) return
    setError('');setNotice('')
    const {error}=await supabase.from('timetable_entries').delete().eq('id',id).eq('school_id',schoolId)
    if(error)setError(error.message);else{setNotice('Lesson removed.');setEntries(v=>v.filter(x=>x.id!==id))}
  }

  const label=(id:string|null,rows:Row[])=>rows.find(x=>x.id===id)?.name||'—'
  return <section className="panel student-panel">
    <div className="academic-head"><div><p className="kicker">LESSON PLANNING</p><h2>School timetable</h2><p className="muted">Schedule lessons by class, stream, subject, teacher and weekday.</p></div><button className="secondary" onClick={()=>void load()}><RefreshCw/> Refresh</button></div>
    <label className="school-picker">Select school<select value={schoolId} onChange={e=>setSchoolId(e.target.value)}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {error&&<p className="alert error"><XCircle/>{error}</p>}{notice&&<p className="alert success"><CheckCircle2/>{notice}</p>}
    <form className="school-form" onSubmit={save}>
      <h3 className="wide">Add a lesson</h3>
      <label>Academic year *<select required value={form.academic_year_id} onChange={e=>setForm(v=>({...v,academic_year_id:e.target.value,term_id:''}))}><option value="">Select year</option>{years.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Term<select value={form.term_id} onChange={e=>setForm(v=>({...v,term_id:e.target.value}))}><option value="">All terms / not specified</option>{terms.filter(x=>x.academic_year_id===form.academic_year_id).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Class *<select required value={form.class_id} onChange={e=>setForm(v=>({...v,class_id:e.target.value,stream_id:''}))}><option value="">Select class</option>{classes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Stream<select value={form.stream_id} onChange={e=>setForm(v=>({...v,stream_id:e.target.value}))}><option value="">All / no stream</option>{streams.filter(x=>!x.class_id||x.class_id===form.class_id).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Subject *<select required value={form.subject_id} onChange={e=>setForm(v=>({...v,subject_id:e.target.value}))}><option value="">Select subject</option>{subjects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Teacher<select value={form.teacher_id} onChange={e=>setForm(v=>({...v,teacher_id:e.target.value}))}><option value="">Not assigned</option>{staff.filter(x=>x.staff_role==='teacher').map(x=><option key={x.id} value={x.id}>{staffName(x)}</option>)}</select></label>
      <label>Day *<select required value={form.day_of_week} onChange={e=>setForm(v=>({...v,day_of_week:e.target.value}))}>{days.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label>Start time *<input type="time" required value={form.start_time} onChange={e=>setForm(v=>({...v,start_time:e.target.value}))}/></label>
      <label>End time *<input type="time" required value={form.end_time} onChange={e=>setForm(v=>({...v,end_time:e.target.value}))}/></label>
      <label>Room / venue<input value={form.room} onChange={e=>setForm(v=>({...v,room:e.target.value}))} placeholder="e.g. Room 4"/></label>
      <label className="wide">Lesson notes<input value={form.lesson_notes} onChange={e=>setForm(v=>({...v,lesson_notes:e.target.value}))} placeholder="Optional notes"/></label>
      <button className="primary wide" disabled={busy||!years.length||!classes.length||!subjects.length}>{busy?'Saving…':'Add lesson to timetable'}</button>
    </form>
    <h3>Weekly timetable</h3>
    <div className="student-toolbar">
      <label>Academic year<select value={filterYear} onChange={e=>setFilterYear(e.target.value)}><option value="">All years</option>{years.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Class<select value={filterClass} onChange={e=>setFilterClass(e.target.value)}><option value="all">All classes</option>{classes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Term<select value={filterTerm} onChange={e=>setFilterTerm(e.target.value)}><option value="all">All terms</option><option value="none">No term</option>{terms.filter(x=>!filterYear||x.academic_year_id===filterYear).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    </div>
    {visible.length===0?<div className="empty"><CalendarDays/><h3>No lessons scheduled</h3><p>Add lessons above to build the weekly timetable.</p></div>:days.map(day=>{const rows=visible.filter(x=>x.day_of_week===day.id);return rows.length?<div key={day.id}><h3>{day.name}</h3><div className="table-wrap"><table><thead><tr><th>Time</th><th>Class / stream</th><th>Subject</th><th>Teacher</th><th>Room</th><th>Term</th><th>Action</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{x.start_time.slice(0,5)}–{x.end_time.slice(0,5)}</td><td>{label(x.class_id,classes)}{x.stream_id?' / '+label(x.stream_id,streams):''}</td><td>{label(x.subject_id,subjects)}</td><td>{staffName(staff.find(s=>s.id===x.teacher_id)||{})||'—'}</td><td>{x.room||'—'}</td><td>{label(x.term_id,terms)}</td><td><button className="secondary" type="button" onClick={()=>void remove(x.id)}><Trash2/> Remove</button></td></tr>)}</tbody></table></div></div>:null})}
  </section>
}
