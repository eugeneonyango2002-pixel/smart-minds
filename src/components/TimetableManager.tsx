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
  const [classSubjectLinks,setClassSubjectLinks] = useState<Row[]>([])
  const [generatorClass,setGeneratorClass] = useState('')
  const [generationPreview,setGenerationPreview] = useState<any[]>([])
  const [generationError,setGenerationError] = useState('')
  const [generationBusy,setGenerationBusy] = useState(false)
  const [generatorProfile,setGeneratorProfile] = useState<Row|null>(null)
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
  useEffect(()=>{\n    let active=true\n    const selected=classes.find(c=>c.id===generatorClass)\n    const code=selected?levelCode(selected):''\n    setGeneratorProfile(null)\n    if(schoolId&&code){void supabase.from('cbc_timetable_profiles').select('*').eq('school_id',schoolId).eq('level_code',code).maybeSingle().then(({data})=>{if(active)setGeneratorProfile(data||null)})}\n    return ()=>{active=false}\n  },[schoolId,generatorClass,classes])\n
  async function load() {
    setError('')
    const [y,t,c,st,s,cs,staffRows,e] = await Promise.all([
      supabase.from('academic_years').select('id,name').eq('school_id',schoolId).order('start_date'),
      supabase.from('terms').select('id,name,academic_year_id').eq('school_id',schoolId).order('start_date'),
      supabase.from('classes').select('id,name,level').eq('school_id',schoolId).order('sort_order'),
      supabase.from('streams').select('*').eq('school_id',schoolId).order('name'),
      supabase.from('subjects').select('id,name,is_examinable').eq('school_id',schoolId).order('name'),
      supabase.from('class_subjects').select('id,class_id,subject_id,lessons_per_week,teacher_id,allow_double_lesson').eq('school_id',schoolId),
      supabase.from('staff').select('id,first_name,middle_name,last_name,staff_role,status').eq('school_id',schoolId).eq('status','active').order('last_name'),
      supabase.from('timetable_entries').select('*').eq('school_id',schoolId).order('day_of_week').order('start_time')
    ])
    const failed=[y,t,c,st,s,cs,staffRows,e].find(x=>x.error)
    if(failed?.error){setError(failed.error.message);return}
    setYears(y.data||[]);setTerms(t.data||[]);setClasses(c.data||[]);setStreams(st.data||[])
    if(!generatorClass && c.data?.[0]) setGeneratorClass(c.data[0].id)
    setSubjects(s.data||[]);setClassSubjectLinks(cs.data||[]);setStaff(staffRows.data||[]);setEntries((e.data||[]) as Entry[])
    if(!form.academic_year_id && y.data?.[0]) setForm(v=>({...v,academic_year_id:y.data![0].id}))
    if(!filterYear && y.data?.[0]) setFilterYear(y.data[0].id)
  }

  const visible=useMemo(()=>entries.filter(e=>
    (!filterYear || e.academic_year_id===filterYear) &&
    (filterClass==='all' || e.class_id===filterClass) &&
    (filterTerm==='all' || (filterTerm==='none' ? !e.term_id : e.term_id===filterTerm))
  ),[entries,filterYear,filterClass,filterTerm])

  const toMinutes=(time:string)=>{const [h,m]=time.slice(0,5).split(':').map(Number);return h*60+m}
  const toClock=(value:number)=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0')
  const levelCode=(c:Row)=>{const n=String(c.name||'');if(/^PP/.test(n))return 'pre_primary';const g=Number(n.match(/Grade (\d+)/)?.[1]||0);return g>=1&&g<=3?'lower_primary':g>=4&&g<=6?'upper_primary':g>=7&&g<=9?'junior_school':''}

  async function saveClassAllocation(linkId:string,lessons:number,teacherId:string){
    setGenerationError('')
    if(!Number.isInteger(lessons)||lessons<1||lessons>15){setGenerationError('Weekly lessons must be between 1 and 15.');return}
    const {error}=await supabase.from('class_subjects').update({lessons_per_week:lessons,teacher_id:teacherId||null}).eq('id',linkId).eq('school_id',schoolId)
    if(error){setGenerationError(error.message);return}
    setClassSubjectLinks(rows=>rows.map(row=>row.id===linkId?{...row,lessons_per_week:lessons,teacher_id:teacherId||null}:row))
    setNotice('Subject allocation and teacher assignment saved.')
  }

  async function buildAutomaticPreview(){
    setGenerationError('');setGenerationPreview([])
    if(!schoolId||!filterYear||!generatorClass){setGenerationError('Select a school, academic year and class first.');return}
    setGenerationBusy(true)
    try{
      const selected=classes.find(c=>c.id===generatorClass)
      const code=selected?levelCode(selected):''
      if(!code)throw new Error('Automatic CBC timetable generation currently supports PP1–Grade 9. Senior-school timetable setup will be added separately.')
      const results=await Promise.all([
        supabase.from('cbc_timetable_profiles').select('*').eq('school_id',schoolId).eq('level_code',code).maybeSingle(),
        supabase.from('class_subjects').select('id,class_id,subject_id,lessons_per_week,teacher_id,allow_double_lesson').eq('school_id',schoolId).eq('class_id',generatorClass),
        supabase.from('subjects').select('id,name').eq('school_id',schoolId),
        supabase.from('timetable_entries').select('id,teacher_id,day_of_week,start_time,end_time,class_id,term_id').eq('school_id',schoolId).eq('academic_year_id',filterYear)
      ])
      const [profileResult,linkResult,subjectResult,existingResult]=results
      if(profileResult.error)throw profileResult.error
      if(linkResult.error)throw linkResult.error
      if(subjectResult.error)throw subjectResult.error
      if(existingResult.error)throw existingResult.error
      const profile=profileResult.data
      if(!profile)throw new Error('No timetable profile exists for this education level. Run the CBC timetable setup migration first.')
      const allocations=(linkResult.data||[]).filter((x:any)=>Number(x.lessons_per_week)>0).map((x:any)=>({...x,subjectName:(subjectResult.data||[]).find((s:any)=>s.id===x.subject_id)?.name||'Subject',remaining:Number(x.lessons_per_week)})).sort((a:any,b:any)=>b.remaining-a.remaining)
      if(!allocations.length)throw new Error('No weekly lesson allocations found. Set lessons per week for this class in the academic subject setup first.')
      const requested=allocations.reduce((sum:number,x:any)=>sum+x.remaining,0)
      const slots:any[]=[]
      for(let day=1;day<=5;day++){
        let cursor=toMinutes(profile.lesson_start_time)
        for(let period=1;period<=Number(profile.lessons_per_day);period++){
          const start=cursor,end=start+Number(profile.lesson_duration_minutes)
          if(end>toMinutes(profile.school_end_time))break
          slots.push({day_of_week:day,start_time:toClock(start),end_time:toClock(end),period})
          cursor=end
          if(period===Number(profile.first_break_after_period))cursor+=Number(profile.first_break_minutes)
          if(period===Number(profile.second_break_after_period))cursor+=Number(profile.second_break_minutes)
          if(profile.lunch_after_period&&period===Number(profile.lunch_after_period))cursor+=Number(profile.lunch_minutes)
        }
      }
      if(requested>slots.length)throw new Error('This class requires '+requested+' lessons per week, but the current timetable profile provides '+slots.length+' periods. Adjust the allocations or timetable profile.')
      const occupied=(existingResult.data||[]).filter((x:any)=>x.class_id!==generatorClass&&(filterTerm==='all'||(filterTerm==='none'?!x.term_id:x.term_id===filterTerm)))
      const preview:any[]=[]
      for(const slot of slots){
        if(!allocations.some((x:any)=>x.remaining>0))break
        const eligible=(x:any,allowAdjacent:boolean)=>{const sameDay=preview.filter((o:any)=>o.subject_id===x.subject_id&&o.day_of_week===slot.day_of_week);const dailyLimit=Math.ceil(Number(x.lessons_per_week)/5);const separated=allowAdjacent||Boolean(x.allow_double_lesson)||!sameDay.some((o:any)=>Math.abs(Number(o.period)-Number(slot.period))===1);return x.remaining>0&&sameDay.length<dailyLimit&&separated&&(!x.teacher_id||!occupied.some((o:any)=>o.teacher_id===x.teacher_id&&o.day_of_week===slot.day_of_week&&o.start_time<slot.end_time&&o.end_time>slot.start_time))&&(!x.teacher_id||!preview.some((o:any)=>o.teacher_id===x.teacher_id&&o.day_of_week===slot.day_of_week&&o.start_time<slot.end_time&&o.end_time>slot.start_time))};const chosen=allocations.find((x:any)=>eligible(x,false))||allocations.find((x:any)=>eligible(x,true))
        if(!chosen)continue
        preview.push({school_id:schoolId,academic_year_id:filterYear,term_id:filterTerm==='all'||filterTerm==='none'?null:filterTerm,class_id:generatorClass,stream_id:null,subject_id:chosen.subject_id,teacher_id:chosen.teacher_id||null,day_of_week:slot.day_of_week,start_time:slot.start_time,end_time:slot.end_time,room:null,lesson_notes:'Automatically generated weekly lesson',subject_name:chosen.subjectName,period:slot.period})
        chosen.remaining--
      }
      const missing=allocations.filter((x:any)=>x.remaining>0).map((x:any)=>x.subjectName+': '+x.remaining)
      if(missing.length)throw new Error('Could not place every lesson without conflicts. Unscheduled lessons: '+missing.join(', ')+'. Check teacher assignments and timetable capacity.')
      setGenerationPreview(preview)
    }catch(e){setGenerationError(e instanceof Error?e.message:'Could not generate a timetable preview.')}
    finally{setGenerationBusy(false)}
  }

  async function saveGeneratedTimetable(){
    if(!generationPreview.length)return
    const current=entries.filter(x=>x.academic_year_id===filterYear&&x.class_id===generatorClass&&(filterTerm==='all'||(filterTerm==='none'?!x.term_id:x.term_id===filterTerm)))
    if(current.length){setGenerationError('This class already has lessons for the selected year/term. Remove those lessons first. Existing lessons have not been changed.');return}
    setGenerationBusy(true);setGenerationError('')
    const payload=generationPreview.map(({subject_name,period,...entry})=>entry)
    const {error}=await supabase.from('timetable_entries').insert(payload)
    if(error)setGenerationError(error.message)
    else{setNotice('Automatic timetable created with '+payload.length+' lessons.');setGenerationPreview([]);await load()}
    setGenerationBusy(false)
  }

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
  const selectedClassName=classes.find(x=>x.id===form.class_id)?.name||''
  const generatorAllocations=classSubjectLinks.filter(link=>link.class_id===generatorClass)\n  const allocatedLessons=generatorAllocations.reduce((sum,link)=>sum+Math.max(0,Number(link.lessons_per_week)||0),0)\n  const availablePeriods=generatorProfile?5*Number(generatorProfile.lessons_per_day||0):0\n    const availableSubjects=subjects.filter(subject=>classSubjectLinks.some(link=>link.class_id===form.class_id&&link.subject_id===subject.id))
  return <section className="panel student-panel timetable-manager">
    <div className="academic-head"><div><p className="kicker">LESSON PLANNING</p><h2>School timetable</h2><p className="muted">Schedule lessons by class, stream, subject, teacher and weekday.</p></div><button className="secondary" onClick={()=>void load()}><RefreshCw/> Refresh</button></div>
    <label className="school-picker">Select school<select value={schoolId} onChange={e=>setSchoolId(e.target.value)}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {error&&<p className="alert error"><XCircle/>{error}</p>}{notice&&<p className="alert success"><CheckCircle2/>{notice}</p>}
    <form className="school-form" onSubmit={save}>
      <h3 className="wide">Add a lesson</h3>
      <label>Academic year *<select required value={form.academic_year_id} onChange={e=>setForm(v=>({...v,academic_year_id:e.target.value,term_id:''}))}><option value="">Select year</option>{years.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Term<select value={form.term_id} onChange={e=>setForm(v=>({...v,term_id:e.target.value}))}><option value="">All terms / not specified</option>{terms.filter(x=>x.academic_year_id===form.academic_year_id).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Class *<select required value={form.class_id} onChange={e=>setForm(v=>({...v,class_id:e.target.value,stream_id:'',subject_id:''}))}><option value="">Select class</option>{classes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Stream<select value={form.stream_id} onChange={e=>setForm(v=>({...v,stream_id:e.target.value}))}><option value="">All / no stream</option>{streams.filter(x=>!x.class_id||x.class_id===form.class_id).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Subject *<select required value={form.subject_id} onChange={e=>setForm(v=>({...v,subject_id:e.target.value}))}><option value="">{form.class_id?'Select a subject allocated to this class':'Select a class first'}</option>{availableSubjects.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Teacher<select value={form.teacher_id} onChange={e=>setForm(v=>({...v,teacher_id:e.target.value}))}><option value="">Not assigned</option>{staff.filter(x=>x.staff_role==='teacher').map(x=><option key={x.id} value={x.id}>{staffName(x)}</option>)}</select></label>
      <label>Day *<select required value={form.day_of_week} onChange={e=>setForm(v=>({...v,day_of_week:e.target.value}))}>{days.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
      <label>Start time *<input type="time" required value={form.start_time} onChange={e=>setForm(v=>({...v,start_time:e.target.value}))}/></label>
      <label>End time *<input type="time" required value={form.end_time} onChange={e=>setForm(v=>({...v,end_time:e.target.value}))}/></label>
      <label>Room / venue<input value={form.room} onChange={e=>setForm(v=>({...v,room:e.target.value}))} placeholder="e.g. Room 4"/></label>
      <label className="wide">Lesson notes<input value={form.lesson_notes} onChange={e=>setForm(v=>({...v,lesson_notes:e.target.value}))} placeholder="Optional notes"/></label>
      <button className="primary wide" disabled={busy||!years.length||!classes.length||!subjects.length}>{busy?'Saving…':'Add lesson to timetable'}</button>
    </form>
    <div className="setup-automatic"><div><b>Automatic timetable generator</b><p>Build a weekly CBC/CBE timetable from each class's subject allocations and assigned teachers. Teacher clashes are checked before saving.</p></div><div style={{display:'grid',gap:'.5rem',minWidth:'min(100%,260px)'}}><label>Class<select value={generatorClass} onChange={e=>{setGeneratorClass(e.target.value);setGenerationPreview([]);setGenerationError('')}}>{classes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button className="secondary" type="button" disabled={generationBusy||!filterYear||!generatorClass} onClick={()=>void buildAutomaticPreview()}>{generationBusy?'Preparing…':'Generate preview'}</button></div></div>
    {generatorClass&&<div className="panel" style={{marginTop:12}}><h3>Weekly subject allocations and teachers</h3><p className="muted">Set how many lessons each subject needs per week and assign its teacher before generating the timetable.</p><div style={{display:'flex',gap:16,flexWrap:'wrap',margin:'10px 0',padding:12,borderRadius:10,background:'var(--surface-muted,#f4f6f8)'}}><div><small className="muted">Allocated lessons per week</small><div style={{fontSize:22,fontWeight:700}}>{allocatedLessons}</div></div><div><small className="muted">Available periods per week</small><div style={{fontSize:22,fontWeight:700}}>{generatorProfile?availablePeriods:'Loading…'}</div></div><div><small className="muted">Remaining capacity</small><div style={{fontSize:22,fontWeight:700}}>{generatorProfile?availablePeriods-allocatedLessons:'—'}</div></div></div>{generatorProfile&&allocatedLessons>availablePeriods&&<p className="alert error">Your subjects require {allocatedLessons} lessons, but this timetable profile provides only {availablePeriods} periods. Reduce the weekly allocations or increase the available periods.</p>}{!generatorProfile&&generatorClass&&<p className="muted">Timetable capacity profile is not available for this class level yet.</p>}<div className="table-wrap"><table><thead><tr><th>Subject</th><th>Lessons per week</th><th>Assigned teacher</th><th>Save</th></tr></thead><tbody>{classSubjectLinks.filter(link=>link.class_id===generatorClass).map(link=><tr key={link.id}><td>{label(link.subject_id,subjects)}</td><td><input aria-label="Lessons per week" type="number" min="1" max="15" defaultValue={link.lessons_per_week||''} id={'lessons-'+link.id}/></td><td><select aria-label="Assigned teacher" defaultValue={link.teacher_id||''} id={'teacher-'+link.id}><option value="">Not assigned</option>{staff.filter(x=>x.staff_role==='teacher').map(x=><option key={x.id} value={x.id}>{staffName(x)}</option>)}</select></td><td><button className="secondary" type="button" onClick={()=>{const lessons=Number((document.getElementById('lessons-'+link.id) as HTMLInputElement)?.value);const teacher=(document.getElementById('teacher-'+link.id) as HTMLSelectElement)?.value||'';void saveClassAllocation(link.id,lessons,teacher)}}>Save</button></td></tr>)}</tbody></table></div>{classSubjectLinks.filter(link=>link.class_id===generatorClass).length===0&&<p className="muted">No subjects are linked to this class yet. Add class subjects in Academic structure first.</p>}</div>}
    {generationError&&<p className="alert error"><XCircle/>{generationError}</p>}
    {generationPreview.length>0&&<div className="panel" style={{marginTop:12}}><div className="academic-head"><div><h3>Generated timetable preview</h3><p className="muted">{generationPreview.length} lessons. Review before saving.</p></div><button className="primary" type="button" disabled={generationBusy} onClick={()=>void saveGeneratedTimetable()}>{generationBusy?'Saving…':'Save timetable'}</button></div><div className="table-wrap"><table><thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th></tr></thead><tbody>{generationPreview.map((x,i)=><tr key={i}><td>{days.find(d=>d.id===x.day_of_week)?.name}</td><td>{x.start_time}–{x.end_time}</td><td>{x.subject_name}</td><td>{staffName(staff.find(t=>t.id===x.teacher_id)||{})||'Not assigned'}</td></tr>)}</tbody></table></div></div>}
    <div className="academic-head"><h3>Weekly timetable</h3><button className="secondary" type="button" onClick={()=>window.print()}>Print timetable</button></div>
    <div className="student-toolbar">
      <label>Academic year<select value={filterYear} onChange={e=>setFilterYear(e.target.value)}><option value="">All years</option>{years.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Class<select value={filterClass} onChange={e=>setFilterClass(e.target.value)}><option value="all">All classes</option>{classes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Term<select value={filterTerm} onChange={e=>setFilterTerm(e.target.value)}><option value="all">All terms</option><option value="none">No term</option>{terms.filter(x=>!filterYear||x.academic_year_id===filterYear).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    </div>
    {visible.length===0?<div className="empty"><CalendarDays/><h3>No lessons scheduled</h3><p>Add lessons above to build the weekly timetable.</p></div>:days.map(day=>{const rows=visible.filter(x=>x.day_of_week===day.id);return rows.length?<div key={day.id}><h3>{day.name}</h3><div className="table-wrap"><table><thead><tr><th>Time</th><th>Class / stream</th><th>Subject</th><th>Teacher</th><th>Room</th><th>Term</th><th>Action</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td>{x.start_time.slice(0,5)}–{x.end_time.slice(0,5)}</td><td>{label(x.class_id,classes)}{x.stream_id?' / '+label(x.stream_id,streams):''}</td><td>{label(x.subject_id,subjects)}</td><td>{staffName(staff.find(s=>s.id===x.teacher_id)||{})||'—'}</td><td>{x.room||'—'}</td><td>{label(x.term_id,terms)}</td><td><button className="secondary" type="button" onClick={()=>void remove(x.id)}><Trash2/> Remove</button></td></tr>)}</tbody></table></div></div>:null})}
  </section>
}
