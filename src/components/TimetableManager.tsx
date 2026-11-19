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
  useEffect(()=>{
    let active=true
    const selected=classes.find(c=>c.id===generatorClass)
    const code=selected?levelCode(selected):''
    setGeneratorProfile(null)
    if(schoolId&&code){void supabase.from('cbc_timetable_profiles').select('*').eq('school_id',schoolId).eq('level_code',code).maybeSingle().then(({data})=>{if(active)setGeneratorProfile(data||null)})}
    return ()=>{active=false}
  },[schoolId,generatorClass,classes])

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
  const timetableSlots=useMemo(()=>Array.from(new Map(visible.map(e=>[e.start_time.slice(0,5)+'|'+e.end_time.slice(0,5),{start:e.start_time.slice(0,5),end:e.end_time.slice(0,5)}])).values()).sort((a,b)=>a.start.localeCompare(b.start)),[visible])

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
    if(!schoolId||!filterYear){setGenerationError('Select a school and academic year first.');return}
    setGenerationBusy(true)
    try{
      const supportedClasses=classes.filter(c=>Boolean(levelCode(c)))
      if(!supportedClasses.length)throw new Error('No supported CBC classes were found. The generator supports PP1–Grade 9.')
      const levelCodes=Array.from(new Set(supportedClasses.map(levelCode)))
      const results=await Promise.all([
        supabase.from('cbc_timetable_profiles').select('*').eq('school_id',schoolId).in('level_code',levelCodes),
        supabase.from('class_subjects').select('id,class_id,subject_id,lessons_per_week,teacher_id,allow_double_lesson').eq('school_id',schoolId),
        supabase.from('subjects').select('id,name').eq('school_id',schoolId),
        supabase.from('timetable_entries').select('id,teacher_id,day_of_week,start_time,end_time,class_id,term_id,academic_year_id').eq('school_id',schoolId).eq('academic_year_id',filterYear)
      ])
      const [profileResult,linkResult,subjectResult,existingResult]=results
      if(profileResult.error)throw profileResult.error
      if(linkResult.error)throw linkResult.error
      if(subjectResult.error)throw subjectResult.error
      if(existingResult.error)throw existingResult.error
      const profiles=profileResult.data||[]
      const profileByLevel=new Map(profiles.map((p:any)=>[p.level_code,p]))
      const subjectRows=subjectResult.data||[]
      const allLinks=linkResult.data||[]
      const targetTerm=(filterTerm==='all'||filterTerm==='none')?null:filterTerm
      const existing=(existingResult.data||[]).filter((x:any)=>filterTerm==='all'||(filterTerm==='none'?!x.term_id:x.term_id===targetTerm))
      if(existing.length)throw new Error('There are already timetable lessons saved for this academic year/term. Remove the existing timetable before generating a fresh whole-school timetable. No existing lessons have been changed.')
      const classPlans=supportedClasses.map(classRow=>{
        const code=levelCode(classRow)
        const profile:any=profileByLevel.get(code)
        const allocations=allLinks.filter((x:any)=>x.class_id===classRow.id&&Number(x.lessons_per_week)>0).map((x:any)=>({...x,subjectName:subjectRows.find((s:any)=>s.id===x.subject_id)?.name||'Subject',remaining:Number(x.lessons_per_week),dailyCounts:[0,0,0,0,0]}))
        return {classRow,code,profile,allocations,slots:[] as any[]}
      }).filter(plan=>plan.allocations.length>0)
      const missingProfiles=classPlans.filter(plan=>!plan.profile).map(plan=>plan.classRow.name+' ('+plan.code+')')
      if(missingProfiles.length)throw new Error('Missing CBC timetable profiles for: '+missingProfiles.join(', ')+'. Complete the CBC timetable setup before generating.')
      if(!classPlans.length)throw new Error('No weekly subject allocations found in the supported classes. Allocate lessons and assign teachers first.')
      const noTeacher=classPlans.flatMap(plan=>plan.allocations.filter((x:any)=>!x.teacher_id).map((x:any)=>plan.classRow.name+' — '+x.subjectName))
      if(noTeacher.length)throw new Error('Assign a teacher to every allocated subject before generating the whole-school timetable. Missing: '+noTeacher.slice(0,12).join('; ')+(noTeacher.length>12?'…':''))
      for(const plan of classPlans){
        const requested=plan.allocations.reduce((sum:number,x:any)=>sum+x.remaining,0)
        const profile=plan.profile
        for(let day=1;day<=5;day++){
          let cursor=toMinutes(profile.lesson_start_time)
          for(let period=1;period<=Number(profile.lessons_per_day);period++){
            const start=cursor,end=start+Number(profile.lesson_duration_minutes)
            if(end>toMinutes(profile.school_end_time))break
            plan.slots.push({class_id:plan.classRow.id,class_name:plan.classRow.name,day_of_week:day,start_time:toClock(start),end_time:toClock(end),period})
            cursor=end
            if(period===Number(profile.first_break_after_period))cursor+=Number(profile.first_break_minutes)
            if(period===Number(profile.second_break_after_period))cursor+=Number(profile.second_break_minutes)
            if(profile.lunch_after_period&&period===Number(profile.lunch_after_period))cursor+=Number(profile.lunch_minutes)
          }
        }
        if(requested>plan.slots.length)throw new Error(plan.classRow.name+' requires '+requested+' lessons per week, but its CBC profile provides '+plan.slots.length+' periods. Adjust its subject allocations or timetable profile.')
      }
      const events=classPlans.flatMap(plan=>plan.slots.map((slot:any)=>({...slot,plan}))).sort((a:any,b:any)=>a.day_of_week-b.day_of_week||a.start_time.localeCompare(b.start_time)||a.class_name.localeCompare(b.class_name))
      const preview:any[]=[]
      const usedSlots=new Set<string>()
      const overlap=(a:any,b:any)=>a.day_of_week===b.day_of_week&&a.start_time<b.end_time&&a.end_time>b.start_time
      const teacherFree=(teacherId:string,slots:any[])=>slots.every(slot=>!existing.some((x:any)=>x.teacher_id===teacherId&&overlap(x,slot))&&!preview.some((x:any)=>x.teacher_id===teacherId&&overlap(x,slot)))
      const slotKey=(slot:any)=>slot.class_id+'|'+slot.day_of_week+'|'+slot.start_time
      const teacherDemand=new Map<string,number>()
      classPlans.forEach(plan=>plan.allocations.forEach((x:any)=>teacherDemand.set(x.teacher_id,(teacherDemand.get(x.teacher_id)||0)+x.remaining)))
      events.sort((a:any,b:any)=>a.day_of_week-b.day_of_week||a.start_time.localeCompare(b.start_time)||Math.max(...b.plan.allocations.map((x:any)=>teacherDemand.get(x.teacher_id)||0))-Math.max(...a.plan.allocations.map((x:any)=>teacherDemand.get(x.teacher_id)||0))||a.class_name.localeCompare(b.class_name))
      for(const slot of events){
        if(usedSlots.has(slotKey(slot)))continue
        const plan=slot.plan
        const sameDaySlots=plan.slots.filter((x:any)=>x.day_of_week===slot.day_of_week)
        const nextSlot=sameDaySlots.find((x:any)=>x.period===slot.period+1)
        const candidates=plan.allocations.filter((x:any)=>{
          const dailyLimit=Math.ceil(Number(x.lessons_per_week)/5)
          if(x.remaining<1||x.dailyCounts[slot.day_of_week-1]>=dailyLimit)return false
          if(!teacherFree(x.teacher_id,[slot]))return false
          const prior=preview.find((o:any)=>o.class_id===slot.class_id&&o.subject_id===x.subject_id&&o.day_of_week===slot.day_of_week&&toMinutes(o.end_time)===toMinutes(slot.start_time))
          if(prior&&!x.allow_double_lesson)return false
          return true
        }).sort((a:any,b:any)=>{
          const targetA=Number(a.lessons_per_week)/5,targetB=Number(b.lessons_per_week)/5
          const balanceA=a.dailyCounts[slot.day_of_week-1]/Math.max(1,targetA)
          const balanceB=b.dailyCounts[slot.day_of_week-1]/Math.max(1,targetB)
          const remainingA=a.remaining/Math.max(1,Number(a.lessons_per_week))
          const remainingB=b.remaining/Math.max(1,Number(b.lessons_per_week))
          const pairA=Boolean(a.allow_double_lesson&&a.remaining>=2&&nextSlot&&toMinutes(slot.end_time)===toMinutes(nextSlot.start_time)&&teacherFree(a.teacher_id,[slot,nextSlot]))
          const pairB=Boolean(b.allow_double_lesson&&b.remaining>=2&&nextSlot&&toMinutes(slot.end_time)===toMinutes(nextSlot.start_time)&&teacherFree(b.teacher_id,[slot,nextSlot]))
          return Number(pairB)-Number(pairA)||balanceA-balanceB||remainingB-remainingA
        })
        const chosen=candidates[0]
        if(!chosen)continue
        const makeEntry=(target:any)=>({school_id:schoolId,academic_year_id:filterYear,term_id:targetTerm,class_id:target.class_id,stream_id:null,subject_id:chosen.subject_id,teacher_id:chosen.teacher_id,day_of_week:target.day_of_week,start_time:target.start_time,end_time:target.end_time,room:null,lesson_notes:'Automatically generated CBC/CBE whole-school timetable',subject_name:chosen.subjectName,class_name:target.class_name,period:target.period})
        preview.push(makeEntry(slot));chosen.remaining--;chosen.dailyCounts[slot.day_of_week-1]++;usedSlots.add(slotKey(slot))
        if(chosen.allow_double_lesson&&chosen.remaining>0&&nextSlot&&toMinutes(slot.end_time)===toMinutes(nextSlot.start_time)){
          const dailyLimit=Math.ceil(Number(chosen.lessons_per_week)/5)
          if(chosen.dailyCounts[slot.day_of_week-1]<dailyLimit&&teacherFree(chosen.teacher_id,[nextSlot])){
            preview.push(makeEntry(nextSlot));chosen.remaining--;chosen.dailyCounts[slot.day_of_week-1]++;usedSlots.add(slotKey(nextSlot))
          }
        }
      }
      const missing=classPlans.flatMap(plan=>plan.allocations.filter((x:any)=>x.remaining>0).map((x:any)=>plan.classRow.name+' — '+x.subjectName+': '+x.remaining))
      if(missing.length)throw new Error('The whole-school timetable could not place every lesson without clashes. Unscheduled: '+missing.slice(0,16).join('; ')+(missing.length>16?'…':'')+'. Check teacher assignments, weekly allocations and timetable capacity.')
      preview.sort((a:any,b:any)=>a.day_of_week-b.day_of_week||a.start_time.localeCompare(b.start_time)||a.class_name.localeCompare(b.class_name))
      setGenerationPreview(preview)
    }catch(e){setGenerationError(e instanceof Error?e.message:'Could not generate a whole-school timetable preview.')}
    finally{setGenerationBusy(false)}
  }

  async function saveGeneratedTimetable(){
    if(!generationPreview.length)return
    const current=entries.filter(x=>x.academic_year_id===filterYear&&(filterTerm==='all'||(filterTerm==='none'?!x.term_id:x.term_id===filterTerm)))
    if(current.length){setGenerationError('This academic year/term already contains timetable lessons. Remove the existing timetable first. No lessons have been changed.');return}
    setGenerationBusy(true);setGenerationError('')
    const payload=generationPreview.map(({subject_name,class_name,period,...entry})=>entry)
    const {error}=await supabase.from('timetable_entries').insert(payload)
    if(error)setGenerationError(error.message)
    else{setNotice('Whole-school CBC timetable created with '+payload.length+' lessons across '+new Set(payload.map((x:any)=>x.class_id)).size+' classes.');setGenerationPreview([]);await load()}
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
  const generatorAllocations=classSubjectLinks.filter(link=>link.class_id===generatorClass)
  const allocatedLessons=generatorAllocations.reduce((sum,link)=>sum+Math.max(0,Number(link.lessons_per_week)||0),0)
  const availablePeriods=generatorProfile?5*Number(generatorProfile.lessons_per_day||0):0
    const availableSubjects=subjects.filter(subject=>classSubjectLinks.some(link=>link.class_id===form.class_id&&link.subject_id===subject.id))
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
    <div className="setup-automatic"><div><b>Whole-school CBC timetable generator</b><p>Generate one coordinated timetable for all configured PP1–Grade 9 classes. Teachers are checked across every class to prevent clashes; daily lesson distribution and permitted double lessons are balanced automatically.</p></div><div style={{display:'grid',gap:'.5rem',minWidth:'min(100%,260px)'}}><label>Class for subject allocation setup<select value={generatorClass} onChange={e=>{setGeneratorClass(e.target.value);setGenerationPreview([]);setGenerationError('')}}>{classes.filter(x=>Boolean(levelCode(x))).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button className="secondary" type="button" disabled={generationBusy||!filterYear||!classes.some(x=>Boolean(levelCode(x)))} onClick={()=>void buildAutomaticPreview()}>{generationBusy?'Preparing whole school…':'Generate whole-school preview'}</button></div></div>
    {generatorClass&&<div className="panel" style={{marginTop:12}}><h3>Weekly subject allocations and teachers</h3><p className="muted">Set how many lessons each subject needs per week and assign its teacher before generating the timetable.</p><div style={{display:'flex',gap:16,flexWrap:'wrap',margin:'10px 0',padding:12,borderRadius:10,background:'var(--surface-muted,#f4f6f8)'}}><div><small className="muted">Allocated lessons per week</small><div style={{fontSize:22,fontWeight:700}}>{allocatedLessons}</div></div><div><small className="muted">Available periods per week</small><div style={{fontSize:22,fontWeight:700}}>{generatorProfile?availablePeriods:'Loading…'}</div></div><div><small className="muted">Remaining capacity</small><div style={{fontSize:22,fontWeight:700}}>{generatorProfile?availablePeriods-allocatedLessons:'—'}</div></div></div>{generatorProfile&&allocatedLessons>availablePeriods&&<p className="alert error">Your subjects require {allocatedLessons} lessons, but this timetable profile provides only {availablePeriods} periods. Reduce the weekly allocations or increase the available periods.</p>}{!generatorProfile&&generatorClass&&<p className="muted">Timetable capacity profile is not available for this class level yet.</p>}<div className="table-wrap"><table><thead><tr><th>Subject</th><th>Lessons per week</th><th>Assigned teacher</th><th>Save</th></tr></thead><tbody>{classSubjectLinks.filter(link=>link.class_id===generatorClass).map(link=><tr key={link.id}><td>{label(link.subject_id,subjects)}</td><td><input aria-label="Lessons per week" type="number" min="1" max="15" defaultValue={link.lessons_per_week||''} id={'lessons-'+link.id}/></td><td><select aria-label="Assigned teacher" defaultValue={link.teacher_id||''} id={'teacher-'+link.id}><option value="">Not assigned</option>{staff.filter(x=>x.staff_role==='teacher').map(x=><option key={x.id} value={x.id}>{staffName(x)}</option>)}</select></td><td><button className="secondary" type="button" onClick={()=>{const lessons=Number((document.getElementById('lessons-'+link.id) as HTMLInputElement)?.value);const teacher=(document.getElementById('teacher-'+link.id) as HTMLSelectElement)?.value||'';void saveClassAllocation(link.id,lessons,teacher)}}>Save</button></td></tr>)}</tbody></table></div>{classSubjectLinks.filter(link=>link.class_id===generatorClass).length===0&&<p className="muted">No subjects are linked to this class yet. Add class subjects in Academic structure first.</p>}</div>}
    {generationError&&<p className="alert error"><XCircle/>{generationError}</p>}
    {generationPreview.length>0&&<div className="panel" style={{marginTop:12}}><div className="academic-head"><div><h3>Whole-school timetable preview</h3><p className="muted">{generationPreview.length} lessons across {new Set(generationPreview.map(x=>x.class_id)).size} classes. Review the coordinated timetable before saving.</p></div><button className="primary" type="button" disabled={generationBusy} onClick={()=>void saveGeneratedTimetable()}>{generationBusy?'Saving…':'Save timetable'}</button></div><div className="table-wrap"><table><thead><tr><th>Class</th><th>Day</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Lesson</th></tr></thead><tbody>{generationPreview.map((x,i)=><tr key={i}><td>{x.class_name}</td><td>{days.find(d=>d.id===x.day_of_week)?.name}</td><td>{x.start_time}–{x.end_time}</td><td>{x.subject_name}</td><td>{staffName(staff.find(t=>t.id===x.teacher_id)||{})||'Not assigned'}</td><td>{x.lesson_notes?.includes('double')?'Double':'Single'}</td></tr>)}</tbody></table></div></div>}
    <div className="academic-head no-print"><h3>Weekly timetable</h3><button className="secondary" type="button" onClick={()=>window.print()}>Print landscape timetable</button></div>
    <div className="student-toolbar no-print">
      <label>Academic year<select value={filterYear} onChange={e=>setFilterYear(e.target.value)}><option value="">All years</option>{years.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Class<select value={filterClass} onChange={e=>setFilterClass(e.target.value)}><option value="all">All classes</option>{classes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <label>Term<select value={filterTerm} onChange={e=>setFilterTerm(e.target.value)}><option value="all">All terms</option><option value="none">No term</option>{terms.filter(x=>!filterYear||x.academic_year_id===filterYear).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    </div>
    {visible.length===0?<div className="empty no-print"><CalendarDays/><h3>No lessons scheduled</h3><p>Add lessons above to build the weekly timetable.</p></div>:<div className="timetable-print-area">
      <div className="timetable-print-heading"><h2>{schools.find(s=>s.id===schoolId)?.name||'School timetable'}</h2><h3>WEEKLY CLASS TIMETABLE</h3><p><b>Academic Year:</b> {label(filterYear,years)} &nbsp; | &nbsp; <b>Term:</b> {filterTerm==='all'?'All terms':filterTerm==='none'?'Not specified':label(filterTerm,terms)} &nbsp; | &nbsp; <b>Class:</b> {filterClass==='all'?'All classes':label(filterClass,classes)}</p></div>
      <div className="table-wrap timetable-grid-wrap"><table className="timetable-grid"><thead><tr><th className="timetable-day-heading">DAY</th>{timetableSlots.map(slot=><th key={slot.start+'-'+slot.end} className="timetable-time-heading">{slot.start} – {slot.end}</th>)}</tr></thead><tbody>{days.map(day=><tr key={day.id}><th className="timetable-day-cell">{day.name.toUpperCase()}</th>{timetableSlots.map(slot=>{const lessons=visible.filter(e=>e.day_of_week===day.id&&e.start_time.slice(0,5)===slot.start&&e.end_time.slice(0,5)===slot.end);return <td key={slot.start+'-'+slot.end}>{lessons.map(lesson=><div className="timetable-cell-lesson" key={lesson.id}><b>{label(lesson.subject_id,subjects)}</b>{filterClass==='all'&&<span>{label(lesson.class_id,classes)}{lesson.stream_id?' / '+label(lesson.stream_id,streams):''}</span>}<span>{staffName(staff.find(person=>person.id===lesson.teacher_id)||{})||'Teacher not assigned'}</span>{lesson.room&&<span>Room: {lesson.room}</span>}<button className="secondary no-print timetable-remove" type="button" onClick={()=>void remove(lesson.id)}><Trash2/> Remove</button></div>)}</td>})}</tr>)}</tbody></table></div>
      <div className="timetable-signature-row"><span>Prepared by: ____________________</span><span>Headteacher: ____________________</span><span>Date: ____________________</span></div>
    </div>}
  </section>
}
