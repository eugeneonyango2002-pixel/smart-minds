import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Search, RefreshCw, Users, XCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string }
type ClassRow = { id: string; name: string }
type StreamRow = { id: string; name: string; class_id: string }
type Student = {
  id: string; admission_number: string; first_name: string; middle_name: string | null; last_name: string;
  gender: string; date_of_birth: string | null; admission_date: string; class_id: string | null; stream_id: string | null;
  guardian_name: string | null; guardian_phone: string | null; status: string
}
const blank = { admission_number:'', first_name:'', middle_name:'', last_name:'', gender:'', date_of_birth:'', admission_date:new Date().toISOString().slice(0,10), class_id:'', stream_id:'', guardian_name:'', guardian_relationship:'', guardian_phone:'', guardian_email:'', address:'' }
export default function StudentManager({ schools, canManage = true }: { schools: School[]; canManage?: boolean }) {
  const [schoolId,setSchoolId]=useState('')
  const [students,setStudents]=useState<Student[]>([])
  const [classes,setClasses]=useState<ClassRow[]>([])
  const [streams,setStreams]=useState<StreamRow[]>([])
  const [form,setForm]=useState(blank)
  const [adding,setAdding]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [search,setSearch]=useState('')
  useEffect(()=>{if(!schoolId&&schools.length)setSchoolId(schools.find(s=>(s as any).status==='approved')?.id||schools[0].id)},[schools,schoolId])
  useEffect(()=>{if(schoolId)void load()},[schoolId])
  async function load(){
    setError('')
    const [s,c,t]=await Promise.all([
      supabase.from('students').select('*').eq('school_id',schoolId).order('created_at',{ascending:false}),
      supabase.from('classes').select('id,name').eq('school_id',schoolId).order('sort_order'),
      supabase.from('streams').select('id,name,class_id').eq('school_id',schoolId).order('name')
    ])
    if(s.error){setError(s.error.message);return}
    if(c.error){setError(c.error.message);return}
    if(t.error){setError(t.error.message);return}
    setStudents((s.data||[]) as Student[]);setClasses(c.data||[]);setStreams(t.data||[])
  }
  const visible=useMemo(()=>students.filter(s=>(s.first_name+' '+(s.middle_name||'')+' '+s.last_name+' '+s.admission_number).toLowerCase().includes(search.toLowerCase())),[students,search])
  async function save(e:FormEvent){
    e.preventDefault();if(!schoolId)return
    setBusy(true);setError('');setNotice('')
    const payload={...form,school_id:schoolId,class_id:form.class_id||null,stream_id:form.stream_id||null,date_of_birth:form.date_of_birth||null,middle_name:form.middle_name||null,guardian_name:form.guardian_name||null,guardian_relationship:form.guardian_relationship||null,guardian_phone:form.guardian_phone||null,guardian_email:form.guardian_email||null,address:form.address||null}
    const {error}=await supabase.from('students').insert(payload)
    if(error)setError(error.message)
    else{setNotice('Student registered successfully.');setForm(blank);setAdding(false);await load()}
    setBusy(false)
  }
  return <section className="panel student-panel">
    <div className="academic-head"><div><p className="kicker">SCHOOL RECORDS</p><h2>Student management</h2><p className="muted">Register learners, assign classes and streams, and maintain admission records.</p></div><button className="secondary" onClick={()=>void load()}><RefreshCw/> Refresh</button></div>
    <label className="school-picker">Select school<select value={schoolId} onChange={e=>{setSchoolId(e.target.value);setAdding(false)}}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <div className="student-toolbar"><div className="student-search"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or admission number"/></div>{canManage && <button className="primary" disabled={!schoolId} onClick={()=>{setAdding(!adding);setError('');setNotice('')}}><Plus/> Register student</button>}</div>
    {error&&<p className="alert error"><XCircle/>{error}</p>}{notice&&<p className="alert success"><CheckCircle2/>{notice}</p>}
    {adding&&<form className="student-form" onSubmit={save}>
      <h3>Student details</h3>
      <label>Admission number *<input required value={form.admission_number} onChange={e=>setForm({...form,admission_number:e.target.value})}/></label>
      <label>First name *<input required value={form.first_name} onChange={e=>setForm({...form,first_name:e.target.value})}/></label>
      <label>Middle name<input value={form.middle_name} onChange={e=>setForm({...form,middle_name:e.target.value})}/></label>
      <label>Last name *<input required value={form.last_name} onChange={e=>setForm({...form,last_name:e.target.value})}/></label>
      <label>Gender *<select required value={form.gender} onChange={e=>setForm({...form,gender:e.target.value})}><option value="">Choose gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other / not specified</option></select></label>
      <label>Date of birth<input type="date" value={form.date_of_birth} onChange={e=>setForm({...form,date_of_birth:e.target.value})}/></label>
      <label>Admission date *<input required type="date" value={form.admission_date} onChange={e=>setForm({...form,admission_date:e.target.value})}/></label>
      <label>Class<select value={form.class_id} onChange={e=>setForm({...form,class_id:e.target.value,stream_id:''})}><option value="">Select class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Stream<select value={form.stream_id} onChange={e=>setForm({...form,stream_id:e.target.value})}><option value="">Select stream</option>{streams.filter(s=>s.class_id===form.class_id).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <h3 className="wide">Parent / guardian details</h3>
      <label>Guardian full name<input value={form.guardian_name} onChange={e=>setForm({...form,guardian_name:e.target.value})}/></label>
      <label>Relationship<input placeholder="Parent, mother, father, guardian…" value={form.guardian_relationship} onChange={e=>setForm({...form,guardian_relationship:e.target.value})}/></label>
      <label>Guardian phone<input type="tel" value={form.guardian_phone} onChange={e=>setForm({...form,guardian_phone:e.target.value})}/></label>
      <label>Guardian email<input type="email" value={form.guardian_email} onChange={e=>setForm({...form,guardian_email:e.target.value})}/></label>
      <label className="wide">Home address<textarea rows={2} value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
      <div className="academic-form-actions"><button type="button" className="secondary" onClick={()=>setAdding(false)}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':'Save student'}</button></div>
    </form>}
    <div className="student-count"><Users/> {visible.length} student record(s)</div>
    {visible.length===0?<div className="empty"><Users/><h3>No students found</h3><p>Register a learner to begin building your school register.</p></div>:<div className="table-wrap"><table><thead><tr><th>Admission no.</th><th>Student</th><th>Gender</th><th>Class</th><th>Stream</th><th>Guardian</th><th>Status</th></tr></thead><tbody>{visible.map(s=><tr key={s.id}><td><b>{s.admission_number}</b></td><td><b>{s.first_name} {s.middle_name||''} {s.last_name}</b><small>Admitted {s.admission_date}</small></td><td>{s.gender}</td><td>{classes.find(c=>c.id===s.class_id)?.name||'—'}</td><td>{streams.find(t=>t.id===s.stream_id)?.name||'—'}</td><td>{s.guardian_name||'—'}<small>{s.guardian_phone||''}</small></td><td><span className="status approved">{s.status}</span></td></tr>)}</tbody></table></div>}
  </section>
}
