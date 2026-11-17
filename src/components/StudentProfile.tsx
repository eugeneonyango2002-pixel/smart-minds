import { useEffect, useState } from 'react'
import { ArrowLeft, RefreshCw, UserRound, CalendarCheck, BookOpen, Wallet, History, Users, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Student = { id:string; admission_number:string; first_name:string; middle_name:string|null; last_name:string; gender:string; date_of_birth:string|null; admission_date:string; class_id:string|null; stream_id:string|null; guardian_name:string|null; guardian_relationship?:string|null; guardian_phone:string|null; guardian_email?:string|null; address?:string|null; status:string }
type Row = { id:string; [key:string]:any }
const nameOf=(s:Student)=>[s.first_name,s.middle_name,s.last_name].filter(Boolean).join(' ')
const money=(n:number)=>'KES '+n.toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2})
export default function StudentProfile({student,schoolId,className,streamName,onBack}:{student:Student;schoolId:string;className:string;streamName:string;onBack:()=>void}){
 const [attendance,setAttendance]=useState<Row[]>([]),[results,setResults]=useState<Row[]>([]),[exams,setExams]=useState<Row[]>([]),[subjects,setSubjects]=useState<Row[]>([]),[payments,setPayments]=useState<Row[]>([]),[charges,setCharges]=useState<Row[]>([]),[history,setHistory]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
 async function load(){
  setLoading(true);setError('')
  const [a,r,p,h,y]=await Promise.all([
   supabase.from('student_attendance').select('id,attendance_date,status,notes').eq('school_id',schoolId).eq('student_id',student.id).order('attendance_date',{ascending:false}).limit(30),
   supabase.from('exam_results').select('id,examination_id,subject_id,score,remarks,created_at').eq('school_id',schoolId).eq('student_id',student.id).order('created_at',{ascending:false}).limit(100),
   supabase.from('fee_payments').select('id,amount_kes,payment_date,payment_method,transaction_reference,fee_structure_id').eq('school_id',schoolId).eq('student_id',student.id).order('payment_date',{ascending:false}),
   supabase.from('student_promotion_history').select('id,action,from_academic_year_id,to_academic_year_id,from_class_id,to_class_id,notes,performed_at').eq('school_id',schoolId).eq('student_id',student.id).order('performed_at',{ascending:false}),
   supabase.from('academic_years').select('id,name,is_current').eq('school_id',schoolId).eq('is_current',true).maybeSingle()
  ])
  if(a.error||r.error||p.error)setError(a.error?.message||r.error?.message||p.error?.message||'Some profile information could not be loaded.')
  setAttendance(a.data||[]);setResults(r.data||[]);setPayments(p.data||[]);setHistory(h.error?[]:h.data||[])
  const [e,s]=await Promise.all([
   (r.data?.length?supabase.from('examinations').select('id,name,exam_date,max_score,academic_year_id,term_id').eq('school_id',schoolId).in('id',[...new Set(r.data.map(x=>x.examination_id))]):Promise.resolve({data:[],error:null})),
   (r.data?.length?supabase.from('subjects').select('id,name').eq('school_id',schoolId).in('id',[...new Set(r.data.map(x=>x.subject_id))]):Promise.resolve({data:[],error:null}))
  ])
  setExams(e.data||[]);setSubjects(s.data||[])
  if(student.class_id&&y.data){
   const c=await supabase.from('fee_structures').select('id,item_name,amount_kes,due_date,term_id').eq('school_id',schoolId).eq('class_id',student.class_id).eq('academic_year_id',y.data.id)
   setCharges(c.data||[])
  }else setCharges([])
  setLoading(false)
 }
 useEffect(()=>{void load()},[student.id,schoolId])
 const present=attendance.filter(x=>x.status==='present').length
 const attendanceRate=attendance.length?Math.round(present/attendance.length*100):null
 const paid=payments.reduce((sum,x)=>sum+Number(x.amount_kes||0),0)
 const totalCharges=charges.reduce((sum,x)=>sum+Number(x.amount_kes||0),0)
 const feePaid=charges.reduce((sum,c)=>sum+payments.filter(p=>p.fee_structure_id===c.id).reduce((n,p)=>n+Number(p.amount_kes||0),0),0)
 return <section className="panel student-panel">
  <div className="academic-head"><div><p className="kicker">STUDENT RECORD · COMPLETE PROFILE</p><h2>{nameOf(student)}</h2><p className="muted">{student.admission_number} · {className||'Class not assigned'} {streamName?'· '+streamName:''}</p></div><div className="student-toolbar"><button className="secondary" onClick={onBack}><ArrowLeft/> Back to students</button><button className="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw/> Refresh</button></div></div>
  {error&&<p className="alert error"><AlertCircle/>{error}</p>}
  {loading?<p className="muted">Loading complete learner profile…</p>:<>
   <div className="stats">
    <article className="panel"><UserRound/><span>Admission status</span><b>{student.status}</b></article>
    <article className="panel"><CalendarCheck/><span>Attendance (latest {attendance.length})</span><b>{attendanceRate===null?'—':attendanceRate+'%'}</b></article>
    <article className="panel"><BookOpen/><span>Assessment entries</span><b>{results.length}</b></article>
    <article className="panel"><Wallet/><span>Total payments recorded</span><b>{money(paid)}</b></article>
   </div>
   <section className="panel"><h3><UserRound/> Personal and admission details</h3><div className="academic-form"><p><b>Full name</b><br/>{nameOf(student)}</p><p><b>Admission number</b><br/>{student.admission_number}</p><p><b>Gender</b><br/>{student.gender}</p><p><b>Date of birth</b><br/>{student.date_of_birth||'Not recorded'}</p><p><b>Admission date</b><br/>{student.admission_date}</p><p><b>Current class / stream</b><br/>{className||'Unassigned'} {streamName?' / '+streamName:''}</p><p><b>Home address</b><br/>{student.address||'Not recorded'}</p></div></section>
   <section className="panel"><h3><Users/> Parent / guardian</h3><div className="academic-form"><p><b>Name</b><br/>{student.guardian_name||'Not recorded'}</p><p><b>Relationship</b><br/>{student.guardian_relationship||'Not recorded'}</p><p><b>Phone</b><br/>{student.guardian_phone||'Not recorded'}</p><p><b>Email</b><br/>{student.guardian_email||'Not recorded'}</p></div></section>
   <section className="panel"><h3><CalendarCheck/> Attendance history</h3>{attendance.length?<div className="table-wrap"><table><thead><tr><th>Date</th><th>Status</th><th>Notes</th></tr></thead><tbody>{attendance.map(x=><tr key={x.id}><td>{x.attendance_date}</td><td>{x.status}</td><td>{x.notes||'—'}</td></tr>)}</tbody></table></div>:<p className="muted">No attendance records found.</p>}</section>
   <section className="panel"><h3><BookOpen/> Assessment history</h3>{results.length?<div className="table-wrap"><table><thead><tr><th>Examination</th><th>Learning area</th><th>Score</th><th>Teacher remarks</th></tr></thead><tbody>{results.map(x=>{const ex=exams.find(e=>e.id===x.examination_id);return <tr key={x.id}><td>{ex?.name||'Assessment'}</td><td>{subjects.find(s=>s.id===x.subject_id)?.name||'Learning area'}</td><td>{x.score}{ex?.max_score?' / '+ex.max_score:''}</td><td>{x.remarks||'—'}</td></tr>})}</tbody></table></div>:<p className="muted">No assessment results found.</p>}</section>
   <section className="panel"><h3><Wallet/> Fee and payment summary</h3><div className="stats"><article className="panel"><span>Current-year charges</span><b>{money(totalCharges)}</b></article><article className="panel"><span>Paid against current charges</span><b>{money(feePaid)}</b></article><article className="panel"><span>Current-year balance</span><b>{money(Math.max(0,totalCharges-feePaid))}</b></article></div><h4>Payment history</h4>{payments.length?<div className="table-wrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>{payments.map(x=><tr key={x.id}><td>{x.payment_date}</td><td>{money(Number(x.amount_kes))}</td><td>{x.payment_method||'—'}</td><td>{x.transaction_reference||'—'}</td></tr>)}</tbody></table></div>:<p className="muted">No fee payments recorded.</p>}</section>
   <section className="panel"><h3><History/> Promotion and progression history</h3>{history.length?<div className="table-wrap"><table><thead><tr><th>Date</th><th>Action</th><th>Notes</th></tr></thead><tbody>{history.map(x=><tr key={x.id}><td>{new Date(x.performed_at).toLocaleDateString('en-KE')}</td><td>{x.action}</td><td>{x.notes||'—'}</td></tr>)}</tbody></table></div>:<p className="muted">No progression history available. This section may be restricted to school leadership roles.</p>}</section>
  </>}
 </section>
}
