import { useEffect, useMemo, useState } from 'react'
import { FileText, Printer, RefreshCw, Search, Wallet, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string; motto?: string | null; logo_url?: string | null }
type Student = { id: string; admission_number: string; first_name: string; middle_name: string | null; last_name: string; class_id: string | null; status: string }
type ClassRow = { id: string; name: string }
type Year = { id: string; name: string }
type Term = { id: string; name: string; academic_year_id: string }
type Fee = { id: string; class_id: string; academic_year_id: string; term_id: string | null; item_name: string; amount_kes: number; due_date: string | null }
type Payment = { id: string; student_id: string; fee_structure_id: string; amount_kes: number; payment_method: string; transaction_reference: string | null; payment_date: string; notes: string | null }

const money = (amount: number) => 'KES ' + amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fullName = (s: Student) => [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ')

export default function FeeStatements({ schools }: { schools: School[] }) {
  const [schoolId, setSchoolId] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [years, setYears] = useState<Year[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [fees, setFees] = useState<Fee[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [yearId, setYearId] = useState('')
  const [termId, setTermId] = useState('')
  const [studentId, setStudentId] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!schoolId && schools.length) setSchoolId(schools.find(s => (s as any).status === 'approved')?.id || schools[0].id)
  }, [schools, schoolId])

  useEffect(() => { if (schoolId) void load() }, [schoolId])

  async function load() {
    setBusy(true); setError('')
    const [s, c, y, t, f, p] = await Promise.all([
      supabase.from('students').select('id,admission_number,first_name,middle_name,last_name,class_id,status').eq('school_id', schoolId).eq('status', 'active').order('first_name'),
      supabase.from('classes').select('id,name').eq('school_id', schoolId).order('sort_order'),
      supabase.from('academic_years').select('id,name').eq('school_id', schoolId).order('start_date', { ascending: false }),
      supabase.from('terms').select('id,name,academic_year_id').eq('school_id', schoolId).order('start_date'),
      supabase.from('fee_structures').select('*').eq('school_id', schoolId).order('created_at'),
      supabase.from('fee_payments').select('*').eq('school_id', schoolId).order('payment_date', { ascending: false })
    ])
    const failed = [s, c, y, t, f, p].find(r => r.error)
    if (failed?.error) setError(failed.error.message)
    else {
      setStudents((s.data || []) as Student[]); setClasses((c.data || []) as ClassRow[])
      setYears((y.data || []) as Year[]); setTerms((t.data || []) as Term[])
      setFees((f.data || []) as Fee[]); setPayments((p.data || []) as Payment[])
      if (!yearId && y.data?.length) setYearId(y.data[0].id)
    }
    setBusy(false)
  }

  const availableTerms = terms.filter(t => t.academic_year_id === yearId)
  const matchingStudents = useMemo(() => students.filter(s => {
    const label = (fullName(s) + ' ' + s.admission_number).toLowerCase()
    return label.includes(search.toLowerCase())
  }), [students, search])

  function statementFor(student: Student) {
    const studentFees = fees.filter(f => f.class_id === student.class_id && f.academic_year_id === yearId && (!termId || !f.term_id || f.term_id === termId))
    const rows = studentFees.map(f => {
      const feePayments = payments.filter(p => p.student_id === student.id && p.fee_structure_id === f.id)
      const paid = feePayments.reduce((sum, p) => sum + Number(p.amount_kes), 0)
      return { fee: f, paid, balance: Math.max(0, Number(f.amount_kes) - paid), payments: feePayments }
    })
    return { rows, charged: rows.reduce((sum, r) => sum + Number(r.fee.amount_kes), 0), paid: rows.reduce((sum, r) => sum + r.paid, 0), balance: rows.reduce((sum, r) => sum + r.balance, 0) }
  }

  const summaries = matchingStudents.map(student => ({ student, ...statementFor(student) }))
  const totals = summaries.reduce((acc, s) => ({ charged: acc.charged + s.charged, paid: acc.paid + s.paid, balance: acc.balance + s.balance }), { charged: 0, paid: 0, balance: 0 })
  const selected = students.find(s => s.id === studentId)
  const selectedSchool = schools.find(s => s.id === schoolId)
  const statement = selected ? statementFor(selected) : null
  const className = (id: string | null) => classes.find(c => c.id === id)?.name || 'Unassigned'

  return <section className="panel statements-panel">
    <div className="academic-head no-print"><div><p className="kicker">SCHOOL FINANCE</p><h2>Fee balances & statements</h2><p className="muted">Review learner balances, school-wide fee totals and individual payment histories.</p></div><button className="secondary" onClick={() => void load()} disabled={busy}><RefreshCw /> Refresh</button></div>
    <label className="school-picker no-print">Select school<select value={schoolId} onChange={e => { setSchoolId(e.target.value); setStudentId('') }}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {error && <p className="alert error no-print"><XCircle />{error}</p>}
    <div className="student-form no-print">
      <label>Academic year<select value={yearId} onChange={e => { setYearId(e.target.value); setTermId('') }}><option value="">Select year</option>{years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</select></label>
      <label>Term (optional)<select value={termId} onChange={e => setTermId(e.target.value)}><option value="">All terms / annual charges</option>{availableTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className="wide">Find learner<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by learner name or admission number" /></label>
    </div>
    <div className="stats fees-stats no-print">
      <article className="panel"><FileText /><span>Total fees charged</span><b>{money(totals.charged)}</b></article>
      <article className="panel"><Wallet /><span>Total fees paid</span><b>{money(totals.paid)}</b></article>
      <article className="panel"><Wallet /><span>Outstanding balance</span><b>{money(totals.balance)}</b></article>
    </div>
    <div className="panel-heading no-print"><h2>Learner balances</h2><span>{matchingStudents.length} learners</span></div>
    {matchingStudents.length === 0 ? <div className="empty no-print"><FileText /><h3>No learners found</h3><p>Check the selected school or search term.</p></div> :
      <div className="table-wrap no-print"><table><thead><tr><th>Admission no.</th><th>Learner</th><th>Class</th><th>Fees charged</th><th>Paid</th><th>Balance</th><th>Statement</th></tr></thead><tbody>
        {summaries.map(s => <tr key={s.student.id}><td><b>{s.student.admission_number}</b></td><td>{fullName(s.student)}</td><td>{className(s.student.class_id)}</td><td>{money(s.charged)}</td><td>{money(s.paid)}</td><td><b>{money(s.balance)}</b></td><td><button className="secondary" onClick={() => setStudentId(s.student.id)}>View statement</button></td></tr>)}
      </tbody></table></div>}
    {selected && statement && <section className="statement-paper">
      <div className="statement-title"><div style={{ display:'flex', alignItems:'center', gap:14 }}>{selectedSchool?.logo_url&&<img src={selectedSchool.logo_url} alt={selectedSchool.name+' logo'} style={{ width:68, height:68, objectFit:'contain' }}/>}<div><p className="kicker">{selectedSchool?.name || 'SMART MINDS'}</p>{selectedSchool?.motto&&<p>{selectedSchool.motto}</p>}<h2>STUDENT FEE STATEMENT</h2></div></div><div className="statement-actions no-print"><button className="secondary" onClick={() => setStudentId('')}>Close</button><button className="primary" onClick={() => window.print()}><Printer /> Print / Save PDF</button></div></div>
      <div className="statement-meta"><div><span>Student</span><b>{fullName(selected)}</b></div><div><span>Admission number</span><b>{selected.admission_number}</b></div><div><span>Class</span><b>{className(selected.class_id)}</b></div><div><span>Academic year</span><b>{years.find(y => y.id === yearId)?.name || '—'}</b></div><div><span>Term</span><b>{termId ? availableTerms.find(t => t.id === termId)?.name : 'All terms'}</b></div><div><span>Statement date</span><b>{new Date().toLocaleDateString('en-KE')}</b></div></div>
      <div className="statement-totals"><div><span>Fees charged</span><b>{money(statement.charged)}</b></div><div><span>Paid</span><b>{money(statement.paid)}</b></div><div><span>Outstanding</span><b>{money(statement.balance)}</b></div></div>
      <h3>Fee items and balances</h3>
      <div className="table-wrap"><table><thead><tr><th>Fee description</th><th>Due date</th><th>Amount</th><th>Paid</th><th>Balance</th></tr></thead><tbody>{statement.rows.map(r => <tr key={r.fee.id}><td>{r.fee.item_name}</td><td>{r.fee.due_date || '—'}</td><td>{money(Number(r.fee.amount_kes))}</td><td>{money(r.paid)}</td><td>{money(r.balance)}</td></tr>)}</tbody></table></div>
      <h3>Payment history</h3>
      {statement.rows.flatMap(r => r.payments.map(p => ({ payment: p, item: r.fee.item_name }))).sort((a, b) => b.payment.payment_date.localeCompare(a.payment.payment_date)).length === 0 ? <p className="muted">No payments have been recorded for this learner in the selected period.</p> :
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Fee item</th><th>Method</th><th>Receipt / reference</th><th>Amount</th></tr></thead><tbody>{statement.rows.flatMap(r => r.payments.map(p => ({ payment: p, item: r.fee.item_name }))).sort((a, b) => b.payment.payment_date.localeCompare(a.payment.payment_date)).map(({ payment: p, item }) => <tr key={p.id}><td>{p.payment_date}</td><td>{item}</td><td>{p.payment_method.toUpperCase()}</td><td>{p.transaction_reference || '—'}</td><td>{money(Number(p.amount_kes))}</td></tr>)}</tbody></table></div>}
      <p className="statement-footnote">This statement reflects payments recorded in Smart Minds. Please contact the school accounts office if you notice any discrepancy.</p>
    </section>}
  </section>
}
