import { useEffect, useMemo, useState } from 'react'
import { Activity, Bell, BookOpen, CalendarCheck, GraduationCap, LogOut, Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Account = { id: string; school_id: string; parent_name: string; phone: string }
type Learner = { id: string; admission_number: string; first_name: string; middle_name: string | null; last_name: string; class_id: string | null }
type Attendance = { id: string; student_id: string; attendance_date: string; status: string }
type Payment = { id: string; student_id: string; fee_structure_id: string; amount_kes: number; payment_date: string; payment_method: string; receipt_number: string; transaction_reference: string | null }
type Exam = { id: string; name: string; exam_date: string | null; class_id: string }
type FeeCharge = { id: string; class_id: string; academic_year_id: string; term_id: string | null; item_name: string; amount_kes: number; due_date: string | null }
type AcademicYear = { id: string; name: string; is_current: boolean }
type Announcement = { id: string; title: string; message: string; publish_at: string }
type ParentNotification = { id: string; title: string; message: string; notification_type: string; created_at: string; read_at: string | null }

export default function ParentPortal({ account, onSignOut, onSwitchToAdmin }: { account: Account; onSignOut: () => void; onSwitchToAdmin?: () => void }) {
  const [learners, setLearners] = useState<Learner[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [feeCharges, setFeeCharges] = useState<FeeCharge[]>([])
  const [currentYear, setCurrentYear] = useState<AcademicYear | null>(null)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [notifications, setNotifications] = useState<ParentNotification[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [results, setResults] = useState<any[]>([])
  const [classes, setClasses] = useState<{id:string;name:string}[]>([])
  const [schoolName, setSchoolName] = useState('School')
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError('')
      const [schoolResult, linkResult, announcementResult, notificationResult] = await Promise.all([
        supabase.from('schools').select('name').eq('id', account.school_id).maybeSingle(),
        supabase.from('parent_students').select('student_id').eq('parent_account_id', account.id),
        supabase.from('school_announcements').select('id,title,message,publish_at').eq('school_id', account.school_id).eq('status','published').lte('publish_at', new Date().toISOString()).order('publish_at',{ascending:false}).limit(30),
        supabase.from('parent_notifications').select('id,title,message,notification_type,created_at,read_at').eq('parent_account_id',account.id).order('created_at',{ascending:false}).limit(50)
      ])
      if (linkResult.error) { if (!cancelled) setError(linkResult.error.message); setLoading(false); return }
      const ids = (linkResult.data || []).map(x => x.student_id)
      if (!ids.length) { if (!cancelled) { setLearners([]); setError('No learners are linked to this parent account yet.') }; setLoading(false); return }
      const [studentResult, attendanceResult, paymentResult, classResult, yearResult] = await Promise.all([
        supabase.from('students').select('id,admission_number,first_name,middle_name,last_name,class_id').in('id', ids).order('first_name'),
        supabase.from('student_attendance').select('id,student_id,attendance_date,status').in('student_id', ids).order('attendance_date', {ascending:false}).limit(100),
        supabase.from('fee_payments').select('id,student_id,fee_structure_id,amount_kes,payment_date,payment_method,receipt_number,transaction_reference').in('student_id', ids).order('payment_date', {ascending:false}),
        supabase.from('classes').select('id,name').eq('school_id', account.school_id),
        supabase.from('academic_years').select('id,name,is_current').eq('school_id', account.school_id).eq('is_current', true).maybeSingle()
      ])
      const failedRead = [schoolResult, announcementResult, notificationResult, studentResult, attendanceResult, paymentResult, classResult, yearResult].find(x => x.error)
      if (failedRead?.error) { if (!cancelled) setError(failedRead.error.message); setLoading(false); return }
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
        setAnnouncements((announcementResult.data || []) as Announcement[]); setNotifications((notificationResult.data || []) as ParentNotification[])
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
        <section className="panel parent-section"><div className="panel-heading"><h2><Bell/> Notifications</h2><span>{notifications.filter(x=>!x.read_at).length} new</span></div>
          {notifications.length ? <div className="parent-announcement-list">{notifications.map(item=><article className="parent-announcement" key={item.id}><small>{new Date(item.created_at).toLocaleString('en-KE')} · {item.notification_type==='exam_published'?'Examination':'Fee payment'}</small><h3>{item.title}</h3><p>{item.message}</p></article>)}</div> : <p className="muted">You will receive updates here when examination results are published or a fee payment is recorded.</p>}
        </section>
        <section className="panel parent-section"><div className="panel-heading"><h2><Bell/> School announcements</h2><span>{announcements.length} updates</span></div>
          {announcements.length ? <div className="parent-announcement-list">{announcements.map(item=><article className="parent-announcement" key={item.id}><small>{new Date(item.publish_at).toLocaleString('en-KE')}</small><h3>{item.title}</h3><p>{item.message}</p></article>)}</div> : <p className="muted">There are no new school announcements.</p>}
        </section>
        <section className="panel parent-section"><div className="panel-heading"><h2><CalendarCheck/> Attendance</h2><span>Latest 100 records</span></div>{learnerAttendance.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Status</th></tr></thead><tbody>{learnerAttendance.map(x=><tr key={x.id}><td>{new Date(x.attendance_date+'T00:00:00').toLocaleDateString()}</td><td>{x.status}</td></tr>)}</tbody></table></div>:<p className="muted">No attendance records are available yet.</p>}</section>
        <section className="panel parent-section"><div className="panel-heading"><h2><BookOpen/> Academic results</h2><span>Results released by the school</span></div>{learnerResults.length ? <div className="table-wrap"><table><thead><tr><th>Examination</th><th>Date</th><th>Learning area ID</th><th>Score</th><th>Teacher remarks</th></tr></thead><tbody>{learnerResults.map(x=>{const ex=exams.find(e=>e.id===x.examination_id);return <tr key={x.id}><td>{ex?.name||'Published exam'}</td><td>{ex?.exam_date?new Date(ex.exam_date+'T00:00:00').toLocaleDateString():'—'}</td><td>{x.subject_id}</td><td>{x.score ?? '—'}</td><td>{x.remarks||'—'}</td></tr>})}</tbody></table></div>:<p className="muted">No examination results have been released for this learner yet. The school must publish the examination before parents can view the marks.</p>}</section>
        <section className="panel parent-section"><div className="panel-heading"><h2><Wallet/> Fee balance</h2><span>{currentYear?.name || 'Current academic year'}</span></div>
          {currentYear ? <><div className="parent-fee-totals"><div><span>Fees charged</span><b>{money(totalCharged)}</b></div><div><span>Paid</span><b>{money(feeRows.reduce((sum,x)=>sum+x.paid,0))}</b></div><div><span>Outstanding balance</span><b>{money(totalOutstanding)}</b></div></div>
          {feeRows.length ? <div className="table-wrap"><table><thead><tr><th>Fee item</th><th>Due date</th><th>Amount</th><th>Paid</th><th>Balance</th></tr></thead><tbody>{feeRows.map(x=><tr key={x.fee.id}><td>{x.fee.item_name}</td><td>{x.fee.due_date||'—'}</td><td>{money(Number(x.fee.amount_kes))}</td><td>{money(x.paid)}</td><td><b>{money(x.balance)}</b></td></tr>)}</tbody></table></div>:<p className="muted">No fee charges have been set for this learner's class in the current academic year.</p>}
          <div className="parent-statement-actions"><button className="primary" onClick={()=>window.print()}>Print / Save fee statement</button></div>
          <section className="statement-paper parent-statement-print"><div className="statement-title"><div><p className="kicker">{schoolName}</p><h2>LEARNER FEE STATEMENT</h2></div></div><div className="statement-meta"><div><span>Learner</span><b>{[learner?.first_name,learner?.middle_name,learner?.last_name].filter(Boolean).join(' ')}</b></div><div><span>Admission number</span><b>{learner?.admission_number}</b></div><div><span>Class</span><b>{classes.find(x=>x.id===learner?.class_id)?.name||'—'}</b></div><div><span>Academic year</span><b>{currentYear.name}</b></div><div><span>Statement date</span><b>{new Date().toLocaleDateString('en-KE')}</b></div></div><div className="statement-totals"><div><span>Fees charged</span><b>{money(totalCharged)}</b></div><div><span>Paid</span><b>{money(feeRows.reduce((sum,x)=>sum+x.paid,0))}</b></div><div><span>Outstanding</span><b>{money(totalOutstanding)}</b></div></div><h3>Fee items and balances</h3><table><thead><tr><th>Fee item</th><th>Due date</th><th>Amount</th><th>Paid</th><th>Balance</th></tr></thead><tbody>{feeRows.map(x=><tr key={x.fee.id}><td>{x.fee.item_name}</td><td>{x.fee.due_date||'—'}</td><td>{money(Number(x.fee.amount_kes))}</td><td>{money(x.paid)}</td><td>{money(x.balance)}</td></tr>)}</tbody></table><p className="statement-footnote">This statement reflects payments recorded by the school.</p></section>
          </> : <p className="muted">The school has not marked an academic year as current yet.</p>}
        </section>
        <section className="panel parent-section"><div className="panel-heading"><h2><Wallet/> Fee payments & receipts</h2><span>{learnerPayments.length} recorded payments</span></div>{learnerPayments.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Receipt no.</th><th>Amount</th><th>Reference</th><th>Receipt</th></tr></thead><tbody>{learnerPayments.map(x=><tr key={x.id}><td>{new Date(x.payment_date+'T00:00:00').toLocaleDateString()}</td><td><b>{x.receipt_number}</b></td><td>{money(Number(x.amount_kes))}</td><td>{x.transaction_reference||'—'}</td><td><button className="secondary" onClick={()=>setSelectedReceipt(x)}>View / Print receipt</button></td></tr>)}</tbody></table></div>:<p className="muted">No fee payments are recorded yet. Receipts will appear here after the school records a payment.</p>}</section>
      </>}
      {selectedReceipt && learner && <div className="receipt-overlay"><section className="receipt-paper"><div className="receipt-head"><div><p className="kicker">{schoolName}</p><h2>OFFICIAL FEE RECEIPT</h2><p>Parent / learner payment confirmation</p></div><div className="receipt-actions no-print"><button className="secondary" onClick={()=>setSelectedReceipt(null)}>Close</button><button className="primary" onClick={()=>window.print()}>Print / Save PDF</button></div></div><div className="receipt-number"><span>Receipt number</span><b>{selectedReceipt.receipt_number}</b></div><div className="receipt-details"><div><span>Learner</span><b>{[learner.first_name,learner.middle_name,learner.last_name].filter(Boolean).join(' ')}</b></div><div><span>Admission number</span><b>{learner.admission_number}</b></div><div><span>Class</span><b>{classes.find(x=>x.id===learner.class_id)?.name||'—'}</b></div><div><span>Payment date</span><b>{new Date(selectedReceipt.payment_date+'T00:00:00').toLocaleDateString('en-KE')}</b></div><div><span>Payment method</span><b>{selectedReceipt.payment_method.toUpperCase()}</b></div><div><span>Transaction reference</span><b>{selectedReceipt.transaction_reference||'—'}</b></div></div><div className="receipt-amount"><span>Amount received</span><strong>{money(Number(selectedReceipt.amount_kes))}</strong></div><p className="receipt-thanks">Thank you. This receipt confirms a payment recorded by {schoolName}.</p></section></div>}
      <footer className="app-footer"><span>© {new Date().getFullYear()} Smart Minds · Parent access is read-only.</span><span className="developer-credit">Powered by Smart Minds · Developed by <b>Eugene Media Graphix</b> · <a href="tel:0757783275">0757783275</a> · <a href="mailto:eugeneaswani6@gmail.com">eugeneaswani6@gmail.com</a></span></footer>
    </main>
  </div>
}
