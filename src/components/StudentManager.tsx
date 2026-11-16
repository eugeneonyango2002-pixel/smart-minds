import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Search, RefreshCw, Users, XCircle, CheckCircle2, Pencil, Upload, FileSpreadsheet } from 'lucide-react'
import { supabase } from '../lib/supabase'
type School = { id: string; name: string }
type ClassRow = { id: string; name: string }
type StreamRow = { id: string; name: string; class_id: string }
type Student = { id:string; admission_number:string; first_name:string; middle_name:string|null; last_name:string; gender:string; date_of_birth:string|null; admission_date:string; class_id:string|null; stream_id:string|null; guardian_name:string|null; guardian_relationship?:string|null; guardian_phone:string|null; guardian_email?:string|null; address?:string|null; status:string }
const blank = { admission_number:'', first_name:'', middle_name:'', last_name:'', gender:'', date_of_birth:'', admission_date:new Date().toISOString().slice(0,10), class_id:'', stream_id:'', guardian_name:'', guardian_relationship:'', guardian_phone:'', guardian_email:'', address:'' }
export default function StudentManager({ schools, canManage = true }: { schools: School[]; canManage?: boolean }) {
  const [schoolId,setSchoolId]=useState(''),[students,setStudents]=useState<Student[]>([]),[classes,setClasses]=useState<ClassRow[]>([]),[streams,setStreams]=useState<StreamRow[]>([])
  const [form,setForm]=useState(blank),[adding,setAdding]=useState(false),[editingStudentId,setEditingStudentId]=useState<string|null>(null),[busy,setBusy]=useState(false)
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[search,setSearch]=useState(''),[csvRows,setCsvRows]=useState<Record<string,string>[]>([]),[csvName,setCsvName]=useState(''),[uploading,setUploading]=useState(false)
  useEffect(()=>{if(!schoolId&&schools.length)setSchoolId(schools.find(s=>(s as any).status==='approved')?.id||schools[0].id)},[schools,schoolId])
  useEffect(()=>{if(schoolId)void load()},[schoolId])
  async function load(){
    setError('')
    const [s,c,t]=await Promise.all([supabase.from('students').select('*').eq('school_id',schoolId).order('created_at',{ascending:false}),supabase.from('classes').select('id,name').eq('school_id',schoolId).order('sort_order'),supabase.from('streams').select('id,name,class_id').eq('school_id',schoolId).order('name')])
    if(s.error){setError(s.error.message);return} if(c.error){setError(c.error.message);return} if(t.error){setError(t.error.message);return}
    setStudents((s.data||[]) as Student[]);setClasses(c.data||[]);setStreams(t.data||[])
  }
  const visible=useMemo(()=>students.filter(s=>(s.first_name+' '+(s.middle_name||'')+' '+s.last_name+' '+s.admission_number).toLowerCase().includes(search.toLowerCase())),[students,search])
  function parseCsv(text:string){
    const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false
    for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++}else if(ch==='"'){quoted=!quoted}else if(ch===','&&!quoted){row.push(cell.trim());cell=''}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row);row=[];cell=''}else cell+=ch}
    row.push(cell.trim());if(row.some(v=>v!==''))rows.push(row)
    if(rows.length<2)throw new Error('The CSV file must contain a header row and at least one learner.')
    const headers=rows[0].map((h,i)=>(i===0?h.replace(/^\uFEFF/,''):h).trim().toLowerCase().replace(/[\s-]+/g,'_'))
    if(!headers.includes('name')&&!headers.includes('full_name')&&!(headers.includes('first_name')&&headers.includes('last_name')))throw new Error('Please include one name column headed name (or full_name).')
    return rows.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]||''])))
  }
  async function importCsv(){
    if(!schoolId||!csvRows.length)return
    setUploading(true);setError('');setNotice('')
    try{
      const year=new Date().getFullYear(),prefix='SM/'+year+'/'
      const existingResult=await supabase.from('students').select('admission_number').eq('school_id',schoolId)
      if(existingResult.error)throw new Error(existingResult.error.message)
      let next=Math.max(0,...(existingResult.data||[]).map(s=>{const v=String(s.admission_number||'');const suffix=v.startsWith(prefix)?v.slice(prefix.length):'';return /^\d+$/.test(suffix)?Number(suffix):0}))+1
      const payload=csvRows.map((row,index)=>{
        const enteredName=(row.name||row.full_name||'').trim()
        const nameParts=enteredName?enteredName.split(/\s+/):[]
        const first_name=enteredName?nameParts.shift()||'':(row.first_name||'').trim()
        const last_name=enteredName?nameParts.join(' '):(row.last_name||'').trim()
        if(!first_name||!last_name)throw new Error('Row '+(index+2)+' needs a full learner name (at least two names).')
        const className=(row.class||row.class_name||'').trim()
        const classRow=className?classes.find(x=>x.name.toLowerCase()===className.toLowerCase()):undefined
        if(className&&!classRow)throw new Error('Row '+(index+2)+': class "'+className+'" was not found.')
        const streamName=(row.stream||row.stream_name||'').trim()
        const streamRow=streamName?streams.find(x=>x.class_id===classRow?.id&&x.name.toLowerCase()===streamName.toLowerCase()):undefined
        if(streamName&&!streamRow)throw new Error('Row '+(index+2)+': stream "'+streamName+'" was not found for the selected class.')
        const admission_number=prefix+String(next++).padStart(4,'0')
        const gender=(row.gender||'other').trim().toLowerCase()
        if(!['male','female','other'].includes(gender))throw new Error('Row '+(index+2)+': gender must be male, female or other.')
        return {school_id:schoolId,admission_number,first_name,middle_name:enteredName?null:(row.middle_name||null),last_name,gender,date_of_birth:row.date_of_birth||null,admission_date:row.admission_date||new Date().toISOString().slice(0,10),class_id:classRow?.id||null,stream_id:streamRow?.id||null,guardian_name:row.guardian_name||null,guardian_relationship:row.guardian_relationship||null,guardian_phone:row.guardian_phone||null,guardian_email:row.guardian_email||null,address:row.address||null}
      })
      const result=await supabase.from('students').insert(payload)
      if(result.error)throw new Error(result.error.message)
      setNotice('Successfully registered '+payload.length+' learner(s). Admission numbers generated automatically.')
      setCsvRows([]);setCsvName('');await load()
    }catch(e){setError(e instanceof Error?e.message:'Unable to import this file.')}
    finally{setUploading(false)}
  }
  function cancelForm(){setAdding(false);setEditingStudentId(null);setForm(blank)}
  function startEdit(s:Student){
    setEditingStudentId(s.id);setForm({admission_number:s.admission_number,first_name:s.first_name,middle_name:s.middle_name||'',last_name:s.last_name,gender:s.gender,date_of_birth:s.date_of_birth||'',admission_date:s.admission_date,class_id:s.class_id||'',stream_id:s.stream_id||'',guardian_name:s.guardian_name||'',guardian_relationship:s.guardian_relationship||'',guardian_phone:s.guardian_phone||'',guardian_email:s.guardian_email||'',address:s.address||''})
    setAdding(true);setError('');setNotice('')
  }
  async function save(e:FormEvent){
    e.preventDefault();if(!schoolId)return
    setBusy(true);setError('');setNotice('')
    const payload={...form,school_id:schoolId,class_id:form.class_id||null,stream_id:form.stream_id||null,date_of_birth:form.date_of_birth||null,middle_name:form.middle_name||null,guardian_name:form.guardian_name||null,guardian_relationship:form.guardian_relationship||null,guardian_phone:form.guardian_phone||null,guardian_email:form.guardian_email||null,address:form.address||null}
    const result=editingStudentId?await supabase.from('students').update(payload).eq('id',editingStudentId).eq('school_id',schoolId):await supabase.from('students').insert(payload)
    if(result.error)setError(result.error.message);else{setNotice(editingStudentId?'Student details updated successfully.':'Student registered successfully.');cancelForm();await load()}
    setBusy(false)
  }
  return <section className="panel student-panel">
    <div className="academic-head"><div><p className="kicker">SCHOOL RECORDS</p><h2>Student management</h2><p className="muted">Register learners, assign classes and streams, and maintain admission records.</p></div><button className="secondary" onClick={()=>void load()}><RefreshCw/> Refresh</button></div>
    <label className="school-picker">Select school<select value={schoolId} onChange={e=>{setSchoolId(e.target.value);cancelForm()}}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <div className="student-toolbar"><div className="student-search"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or admission number"/></div>{canManage&&<button className="primary" disabled={!schoolId} onClick={()=>{if(adding)cancelForm();else{setEditingStudentId(null);setForm(blank);setAdding(true)}setError('');setNotice('')}}><Plus/> Register student</button>}</div>
    {canManage&&<section className="panel" style={{marginTop:16}}>
      <div className="panel-heading"><div><h3><FileSpreadsheet size={18}/> Bulk student upload</h3><p className="muted">Upload a CSV file to register many learners together.</p></div></div>
      <p className="muted">Required column: <b>name</b> (the learner's full name in one cell). Optional: gender, date_of_birth, admission_date, class, stream, guardian_name, guardian_relationship, guardian_phone, guardian_email, address. Class and stream names must match those already registered.</p>
      <label>Choose CSV file<input type="file" accept=".csv,text/csv" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{setCsvRows(parseCsv(await file.text()));setCsvName(file.name);setError('');setNotice('')}catch(err){setCsvRows([]);setCsvName('');setError(err instanceof Error?err.message:'Unable to read CSV file.')}}}/></label>
      {csvName&&<p className="muted">{csvName} · {csvRows.length} learner row(s) ready</p>}
      {csvRows.length>0&&<><div className="table-wrap"><table><thead><tr><th>Learner name</th><th>Class</th></tr></thead><tbody>{csvRows.slice(0,5).map((row,i)=><tr key={i}><td>{row.name||row.full_name||[row.first_name,row.middle_name,row.last_name].filter(Boolean).join(' ')}</td><td>{row.class||row.class_name||'—'}</td></tr>)}</tbody></table></div><p className="muted">Admission numbers will be generated as SM/{new Date().getFullYear()}/0001, then incremented automatically.</p><div className="academic-form-actions"><button type="button" className="secondary" onClick={()=>{setCsvRows([]);setCsvName('')}}>Cancel upload</button><button type="button" className="primary" disabled={uploading||!schoolId} onClick={()=>void importCsv()}><Upload size={16}/>{uploading?'Importing…':'Import '+csvRows.length+' learners'}</button></div></>}
    </section>}

    {error&&<p className="alert error"><XCircle/>{error}</p>}{notice&&<p className="alert success"><CheckCircle2/>{notice}</p>}
    {adding&&<form className="student-form" onSubmit={save}>
      <h3>{editingStudentId?'Edit student details':'Student details'}</h3>
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
      <div className="academic-form-actions"><button type="button" className="secondary" onClick={cancelForm}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':editingStudentId?'Save changes':'Save student'}</button></div>
    </form>}
    <div className="student-count"><Users/> {visible.length} student record(s)</div>
    {visible.length===0?<div className="empty"><Users/><h3>No students found</h3><p>Register a learner to begin building your school register.</p></div>:<div className="table-wrap"><table><thead><tr><th>Admission no.</th><th>Student</th><th>Gender</th><th>Class</th><th>Stream</th><th>Guardian</th><th>Status</th>{canManage&&<th>Actions</th>}</tr></thead><tbody>{visible.map(s=><tr key={s.id}><td><b>{s.admission_number}</b></td><td><b>{s.first_name} {s.middle_name||''} {s.last_name}</b><small>Admitted {s.admission_date}</small></td><td>{s.gender}</td><td>{classes.find(c=>c.id===s.class_id)?.name||'—'}</td><td>{streams.find(t=>t.id===s.stream_id)?.name||'—'}</td><td>{s.guardian_name||'—'}<small>{s.guardian_phone||''}</small></td><td><span className="status approved">{s.status}</span></td>{canManage&&<td><button className="secondary" onClick={()=>startEdit(s)}><Pencil/> Edit</button></td>}</tr>)}</tbody></table></div>}
  </section>
}