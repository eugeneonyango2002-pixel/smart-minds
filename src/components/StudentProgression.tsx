import { useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, CheckCircle2, RefreshCw, Search, ShieldCheck, Users, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string }
type Year = { id: string; name: string; start_date: string; end_date: string; is_current: boolean }
type ClassRow = { id: string; name: string; sort_order: number }
type StreamRow = { id: string; name: string; class_id: string }
type Learner = { id: string; admission_number: string; first_name: string; middle_name: string | null; last_name: string; class_id: string | null; stream_id: string | null; status: string }

export default function StudentProgression({ schools }: { schools: School[] }) {
  const [schoolId,setSchoolId]=useState('')
  const [students,setStudents]=useState<Learner[]>([])
  const [years,setYears]=useState<Year[]>([])
  const [classes,setClasses]=useState<ClassRow[]>([])
  const [streams,setStreams]=useState<StreamRow[]>([])
  const [selected,setSelected]=useState<string[]>([])
  const [sourceYear,setSourceYear]=useState('')
  const [targetYear,setTargetYear]=useState('')
  const [action,setAction]=useState('promoted')
  const [targetClass,setTargetClass]=useState('')
  const [targetStream,setTargetStream]=useState('')
  const [notes,setNotes]=useState('')
  const [search,setSearch]=useState('')
  const [filterClass,setFilterClass]=useState('')
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')

  useEffect(()=>{if(!schoolId&&schools.length)setSchoolId(schools.find(s=>(s as any).status==='approved')?.id||schools[0].id)},[schools,schoolId])
  useEffect(()=>{if(schoolId)void load()},[schoolId])

  async function load(){
    setLoading(true);setError('')
    const [studentResult,yearResult,classResult,streamResult]=await Promise.all([
      supabase.from('students').select('id,admission_number,first_name,middle_name,last_name,class_id,stream_id,status').eq('school_id',schoolId).eq('status','active').order('admission_number'),
      supabase.from('academic_years').select('id,name,start_date,end_date,is_current').eq('school_id',schoolId).order('start_date',{ascending:false}),
      supabase.from('classes').select('id,name,sort_order').eq('school_id',schoolId).order('sort_order'),
      supabase.from('streams').select('id,name,class_id').eq('school_id',schoolId).order('name')
    ])
    const failed=[studentResult,yearResult,classResult,streamResult].find(r=>r.error)
    if(failed?.error)setError(failed.error.message)
    else{
      const ys=(yearResult.data||[]) as Year[]
      setStudents((studentResult.data||[]) as Learner[]);setYears(ys);setClasses((classResult.data||[]) as ClassRow[]);setStreams((streamResult.data||[]) as StreamRow[])
      const current=ys.find(y=>y.is_current)
      setSourceYear(current?.id||ys[0]?.id||'')
      setTargetYear(prev=>prev&&ys.some(y=>y.id===prev)?prev:(ys.find(y=>y.id!==current?.id)?.id||''))
      setSelected([])
    }
    setLoading(false)
  }

  const visible=useMemo(()=>students.filter(s=>{
    const name=[s.first_name,s.middle_name,s.last_name].filter(Boolean).join(' ').toLowerCase()
    const term=search.toLowerCase()
    return (!filterClass||s.class_id===filterClass)&&(!term||name.includes(term)||s.admission_number.toLowerCase().includes(term))
  }),[students,search,filterClass])
  const selectedAll=visible.length>0&&visible.every(s=>selected.includes(s.id))
  const chosenClass=classes.find(c=>c.id===targetClass)
  const destinationRequired=action==='promoted'||action==='repeated'

  function toggleAll(){setSelected(selectedAll?selected.filter(id=>!visible.some(s=>s.id===id)):Array.from(new Set([...selected,...visible.map(s=>s.id)])))}
  function toggleOne(id:string){setSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])}

  async function process(){
    if(!schoolId||!selected.length)return
    if(!sourceYear){setError('Select the academic year these learners are completing.');return}
    if(destinationRequired&&(!targetYear||!targetClass)){setError('Select the next academic year and destination class.');return}
    if(destinationRequired&&targetYear===sourceYear){setError('The destination academic year must be different from the source year.');return}
    const actionLabel=({promoted:'promote',repeated:'move as repeaters',graduated:'mark as graduated',transferred:'mark as transferred',withdrawn:'mark as withdrawn'} as Record<string,string>)[action]
    if(!window.confirm('Are you sure you want to '+actionLabel+' '+selected.length+' selected learner(s)? This will update their current student records and save a permanent history entry.'))return
    setBusy(true);setError('');setNotice('')
    const {data,error:rpcError}=await supabase.rpc('process_student_promotion',{
      p_school_id:schoolId,p_student_ids:selected,p_from_academic_year_id:sourceYear,p_action:action,
      p_to_academic_year_id:destinationRequired?targetYear:null,p_to_class_id:destinationRequired?targetClass:null,
      p_to_stream_id:destinationRequired?(targetStream||null):null,p_notes:notes.trim()||null
    })
    if(rpcError)setError(rpcError.message)
    else{setNotice('Successfully processed '+Number(data||0)+' learner(s). Their progression history has been saved.');setNotes('');await load()}
    setBusy(false)
  }

  return <section className="panel student-panel">
    <div className="academic-head"><div><p className="kicker">ACADEMIC YEAR MANAGEMENT</p><h2>Student promotion & progression</h2><p className="muted">Promote learners, record repeaters and preserve a history of every progression decision.</p></div><button className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw/> Refresh</button></div>
    <label className="school-picker">Select school<select value={schoolId} onChange={e=>{setSchoolId(e.target.value);setSelected([])}}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <div className="setup-automatic"><div><b><ShieldCheck size={18}/> Controlled progression</b><p>Only active learners are listed. Each action is checked by the database and recorded in the learner's progression history.</p></div><span className="status approved">History enabled</span></div>
    {error&&<p className="alert error"><XCircle/>{error}</p>}{notice&&<p className="alert success"><CheckCircle2/>{notice}</p>}
    <div className="academic-form">
      <label>Academic year being completed<select value={sourceYear} onChange={e=>setSourceYear(e.target.value)}><option value="">Select current / source year</option>{years.map(y=><option key={y.id} value={y.id}>{y.name}{y.is_current?' · Current':''}</option>)}</select></label>
      <label>Progression action<select value={action} onChange={e=>{setAction(e.target.value);setTargetClass('');setTargetStream('')}}><option value="promoted">Promote to another class</option><option value="repeated">Repeat the same class / assign class</option><option value="graduated">Graduate / complete school</option><option value="transferred">Transfer out</option><option value="withdrawn">Withdraw learner</option></select></label>
      {destinationRequired&&<>
        <label>Next academic year<select value={targetYear} onChange={e=>setTargetYear(e.target.value)}><option value="">Select next academic year</option>{years.filter(y=>y.id!==sourceYear).map(y=><option key={y.id} value={y.id}>{y.name}</option>)}</select></label>
        <label>Destination class<select value={targetClass} onChange={e=>{setTargetClass(e.target.value);setTargetStream('')}}><option value="">Select destination class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Destination stream (optional)<select value={targetStream} onChange={e=>setTargetStream(e.target.value)}><option value="">No stream selected</option>{streams.filter(s=>s.class_id===targetClass).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      </>}
      <label className="wide">Notes (optional)<textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add a reason or reference for this decision"/></label>
    </div>
    <div className="student-toolbar"><div className="student-search"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search learner name or admission number"/></div><select value={filterClass} onChange={e=>setFilterClass(e.target.value)}><option value="">All classes</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    <div className="student-count"><Users/> {visible.length} active learner(s) · {selected.length} selected</div>
    {loading?<div className="empty"><RefreshCw/><p>Loading learner register…</p></div>:visible.length===0?<div className="empty"><Users/><h3>No active learners found</h3><p>Check the school, class filter or student register.</p></div>:<div className="table-wrap"><table><thead><tr><th><input aria-label="Select all visible learners" type="checkbox" checked={selectedAll} onChange={toggleAll}/></th><th>Admission no.</th><th>Learner</th><th>Current class</th><th>Stream</th></tr></thead><tbody>{visible.map(s=><tr key={s.id}><td><input aria-label={'Select '+s.first_name+' '+s.last_name} type="checkbox" checked={selected.includes(s.id)} onChange={()=>toggleOne(s.id)}/></td><td><b>{s.admission_number}</b></td><td>{[s.first_name,s.middle_name,s.last_name].filter(Boolean).join(' ')}</td><td>{classes.find(c=>c.id===s.class_id)?.name||'Unassigned'}</td><td>{streams.find(t=>t.id===s.stream_id)?.name||'—'}</td></tr>)}</tbody></table></div>}
    <div className="academic-form-actions"><span className="muted">{selected.length} learner(s) selected for processing</span><button className="primary" disabled={busy||!selected.length||!sourceYear||(destinationRequired&&(!targetYear||!targetClass))} onClick={()=>void process()}><ArrowRightLeft/>{busy?'Processing…':'Process '+selected.length+' learner(s)'}</button></div>
    {!years.length&&<p className="alert error">No academic years have been set up yet. Please create the academic years in Academic setup first.</p>}
    {chosenClass&&destinationRequired&&<p className="muted">Destination: <b>{chosenClass.name}</b>{targetYear?' · '+years.find(y=>y.id===targetYear)?.name:''}</p>}
  </section>
}
