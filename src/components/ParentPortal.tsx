import { useEffect, useMemo, useState } from 'react'
import { Activity, Bell, BookOpen, CalendarCheck, GraduationCap, LogOut, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Account = { id: string; school_id: string; parent_name: string; phone: string }
type Learner = { id: string; admission_number: string; first_name: string; middle_name: string | null; last_name: string; class_id: string | null }
type Attendance = { id: string; student_id: string; attendance_date: string; status: string }
type Payment = { id: string; student_id: string; fee_structure_id: string; amount_kes: number; payment_date: string; transaction_reference: string | null }
type Exam = { id: string; name: string; exam_date: string | null; class_id: string }
type FeeCharge = { id: string; class_id: string; academic_year_id: string; term_id: string | null; item_name: string; amount_kes: number; due_date: string | null }
type AcademicYear = { id: string; name: string; is_current: boolean }
type Announcement = { id: string; title: string; message: string; publish_at: string }

export default function ParentPortal({ account, onSignOut, onSwitchToAdmin }: { account: Account; onSignOut: () => void; onSwitchToAdmin?: () => void }) {
  const [learners, setLearners] = useState<Learner[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [feeCharges, setFeeCharges] = useState<FeeCharge[]>([])
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [results, setResults] = useState<any[]>([])
  const [classes, setClasses] = useState<{id:string;name:string}[]>([])
  const [schoolName, setSchoolName] = useState('School')
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      const [schoolResult, linkResult, announcementResult] = await Promise.all([
        supabase.from('schools').select('name').eq('id', account.school_id).maybeSingle(),
        supabase.from('parent_students').select('student_id').eq('parent_account_id', account.id),
        supabase.from('school_announcements').select('id,title,message,publish_at').eq('school_id', account.school_id).eq('status','published').lte('publish_at', new Date().toISOString()).order('publish_at',{ascending:false}).limit(30)
      ])
      if (linkResult.error) { if (!cancelled) setError(linkResult.error.message); setLoading(false); return }
      const ids = (linkResult.data || []).map(x => x.student_id)
      if (!ids.length) { if (!cancelled) { setLearners([]); setError('No learners are linked to this parent account yet.') }; setLoading(false); return }
      const [studentResult, attendanceResult, paymentResult, classResult, yearResult] = await Promise.all([
        supabase.from('students').select('id,admission_number,first_name,middle_name,last_name,class_id').in('id', ids).order('first_name'),
        supabase.from('student_attendance').select('id,student_id,attendance_date,status').in('student_id', ids).order('attendance_date', {ascending:false}).limit(100),
        supabase.from('fee_payments').select('id,student_id,fee_structure_id,amount_kes,payment_date,transaction_reference').in('student_id', ids).order('payment_date', {ascending:false}),
        supabase.from('classes').select('id,name').eq('school_id', account.school_id),
        supabase.from('academic_years').select('id,name,is_current').eq('school_id', account.school_id).eq('is_current', true).maybeSingle()
      ])
      if (studentResult.error) { if (!cancelled) setError(studentResult.error.message); setLoading(false); return }
      const kids = (studentResult.data || []) as Learner[]
      const classIds = [...new Set(kids.map(x => x.class_id).filter(Boolean))] as string[]
      let chargeRows: FeeCharge[] = []
      if (yearResult.data && classIds.length) {
        const feeResult = await supabase.from('fee_structures').select('id,class_id,academic_year_id,term_id,item_name,amount_kes,due_date').eq('school_id', account.school_id).eq('academic_year_id', yearResult.data.id).in('class_id', classIds).order('due_date')
        chargeRows = (feeResult.data || []) as FeeCharge[]
      }
      let examRows: Exam[] = []
      let resultRows: any[] = []
      if (classIds.length) {
        const examResult = await supabase.from('examinations').select('id,name,exam_date,class_id').eq('school_id', account.school_id).eq('status','published').in('class_id', classIds).order('exam_date',{ascending:false})
        examRows = (examResult.data || []) as Exam[]
        if (examRows.length) {
          const result = await supabase.from('exam_results').select('id,student_id,examination_id,subject_id,score,remarks').in('student_id', ids).in('examination_id', examRows.map(x=>x.id))
          resultRows = result.data || []
        }
      }
      if (!cancelled) {
        setSchoolName(schoolResult.data?.name || 'School')
        setAnnouncements((announcementResult.data || []) as Announcement[])
        setLearners(kids); setAttendance((attendanceResult.data || []) as Attendance[])
        setPayments((paymentResult.data || []) as Payment[]); setClasses(classResult.data || [])
        setFeeCharges(chargeRows); setCurrentYear((yearResult.data || null) as AcademicYear | null)
        setExams(examRows); setResults(resultRows)
        setSelectedId(current => kids.some(x=>x.id===current) ? current : kids[0]?.id || '')
      }
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [account.id, account.school_id])

  const learner = learners.find(x => x.id === selectedId)
  const learnerAttendance = useMemo(()=>attendance.filter(x=>x.student_id===selectedId),[attendance,selectedId])
  const learnerPayments = useMemo(()=>payments.filter(x=>x.student_id===selectedId),[payments,selectedId])
  const learnerResults = useMemo(()=>results.filter(x=>x.student_id===selectedId),[results,selectedId])
  const totalPaid = learnerPayments.reduce((sum,x)=>sum+Number(x.amount_kes||0),0)
  const learnerCharges = learner ? feeCharges.filter(x=>x.class_id===learner.class_id) : []
  const feeRows = learnerCharges.map(fee=>{const paid=learnerPayments.filter(p=>p.fee_structure_id===fee.id).reduce((sum,p)=>sum+Number(p.amount_kes||0),0);return {fee,paid,balance:Math.max(0,Number(fee.amount_kes)-paid)}})
  const totalCharged = feeRows.reduce((sum,x)=>sum+Number(x.fee.amount_kes),0)
  const totalOutstanding = feeRows.reduce((sum,x)=>sum+x.balance,0)
  const money = (amount:number) => 'KES '+amount.toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2})
  const attendanceRate = learnerAttendance.length ? Math.round(learnerAttendance.filter(x=>String(x.status).toLowerCase()==='present').length/learnerAttendance.length*100) : null

  return <div className="parent-portal">
    <header className="parent-portal-header"><div className="parent-brand"><span className="parent-logo"><GraduationCap /></span><div><b>SMART MINDS</b><small>{schoolName}</small></div></div>{onSwitchToAdmin && <button className="secondary" onClick={onSwitchToAdmin}>Admin workspace</button>}<button className="secondary" onClick={onSignOut}><LogOut/> Sign out</button></header>
    <main className="parent-portal-main">
      <div className="parent-welcome"><div><p className="kicker">PARENT PORTAL</p><h1>Welcome, {account.parent_name}</h1><p className="muted">View your children's school progress and updates.</p></div></div>
      {error && <p className="alert error">{error}</p>}
      {loading ? <section className="panel">Loading your learners and school information…</section> : learners.length>0 && <>
        <section className="panel"><label className="parent-child-picker">Select learner<select value={selectedId} onChange={e=>setSelectedId(e.target.value)}>{learners.map(x=><option key={x.id} value={x.id}>{[x.first_name,x.middle_name,x.last_name].filter(Boolean).join(' ')} · {x.admission_number}</option>)}</select></label>
          {learner && <div className="parent-learner-summary"><div><h2>{[learner.first_name,learner.middle_name,learner.last_name].filter(Boolean).join(' ')}</h2><p className="muted">Admission: {learner.admission_number} · {classes.find(x=>x.id===learner.class_id)?.name || 'Class not assigned'}</p></div></div>}
        </section>
        {learner && <div className="parent-stats">
          <article className="panel"><Activity/><span>Attendance rate</span><b>{attendanceRate===null?'—':attendanceRate+'%'}</b></article>
          <article className="panel"><Wallet/><span>Payments recorded</span><b>KES {totalPaid.toLocaleString()}</b></article>
          <article className="panel"><BookOpen/><span>Published assessments</span><b>{new Set(learnerResults.map(x=>x.examination_id)).size}</b></article>
        </div>}
        <section className="panel parent-section"><div className="panel-heading"><h2><Bell/> School announcements</h2><span>{announcements.length} updates</span></div>
          {announcements.length ? <div className="parent-announcement-list">{announcements.map(item=><article className="parent-announcement" key={item.id}><small>{new Date(item.publish_at).toLocaleString('en-KE')}</small><h3>{item.title}</h3><p>{item.message}</p></article>)}</div> : <p className="muted">There are no new school announcements.</p>}
        </section>
        <section className="panel parent-section"><div className="panel-heading"><h2><CalendarCheck/> Attendance</h2><span>Latest 100 records</span></div>{learnerAttendance.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Status</th></tr></thead><tbody>{learnerAttendance.map(x=><tr key={x.id}><td>{new Date(x.attendance_date+'T00:00:00').toLocaleDateString()}</td><td>{x.status}</td></tr>)}</tbody></table></div>:<p className="muted">No attendance records are available yet.</p>}</section>
        <section className="panel parent-section"><div className="panel-heading"><h2><BookOpen/> Academic results</h2><span>Published examinations only</span></div>{learnerResults.length ? <div className="table-wrap"><table><thead><tr><th>Examination</th><th>Date</th><th>Learning area ID</th><th>Score</th><th>Teacher remarks</th></tr></thead><tbody>{learnerResults.map(x=>{const ex=exams.find(e=>e.id===x.examination_id);return <tr key={x.id}><td>{ex?.name||'Published exam'}</td><td>{ex?.exam_date?new Date(ex.exam_date+'T00:00:00').toLocaleDateString():'—'}</td><td>{x.subject_id}</td><td>{x.score ?? '—'}</td><td>{x.remarks||'—'}</td></tr>})}</tbody></table></div>:<p className="muted">No published results are available for this learner yet.</p>}</section>
        <section className="panel parent-section"><div className="panel-heading"><h2><Wallet/> Fee balance</h2><span>{currentYear?.name || 'Current academic year'}</span></div>
          {currentYear ? <><div className="parent-fee-totals"><div><span>Fees charged</span><b>{money(totalCharged)}</b></div><div><span>Paid</span><b>{money(feeRows.reduce((sum,x)=>sum+x.paid,0))}</b></div><div><span>Outstanding balance</span><b>{money(totalOutstanding)}</b></div></div>
          {feeRows.length ? <div className="table-wrap"><table><thead><tr><th>Fee item</th><th>Due date</th><th>Amount</th><th>Paid</th><th>Balance</th></tr></thead><tbody>{feeRows.map(x=><tr key={x.fee.id}><td>{x.fee.item_name}</td><td>{x.fee.due_date||'—'}</td><td>{money(Number(x.fee.amount_kes))}</td><td>{money(x.paid)}</td><td><b>{money(x.balance)}</b></td></tr>)}</tbody></table></div>:<p className="muted">No fee charges have been set for this learner's class in the current academic year.</p>}</> : <p className="muted">The school has not marked an academic year as current yet.</p>}
        </section>
        <section className="panel parent-section"><div className="panel-heading"><h2><Wallet/> Fee payments</h2><span>Recorded payments</span></div>{learnerPayments.length ? <div className="table-wrap"><table><thead><tr><th>Payment date</th><th>Amount</th><th>Reference</th></tr></thead><tbody>{learnerPayments.map(x=><tr key={x.id}><td>{new Date(x.payment_date+'T00:00:00').toLocaleDateString()}</td><td>KES {Number(x.amount_kes).toLocaleString()}</td><td>{x.transaction_reference||'—'}</td></tr>)}</tbody></table></div>:<p className="muted">No fee payments are recorded yet.</p>}</section>
      </>}
      <footer className="app-footer"><span>© {new Date().getFullYear()} Smart Minds · Parent access is read-only.</span><span className="developer-credit">Powered by Smart Minds · Developed by <b>Eugene Media Graphix</b> · <a href="tel:0757783275">0757783275</a> · <a href="mailto:eugeneaswani6@gmail.com">eugeneaswani6@gmail.com</a></span></footer>
    </main>
  </div>
}
