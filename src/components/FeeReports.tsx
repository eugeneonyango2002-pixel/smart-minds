import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Download, Printer, RefreshCw, Wallet, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string; motto?: string | null; logo_url?: string | null }
type Student = { id: string; class_id: string | null }
type ClassRow = { id: string; name: string }
type Payment = { id: string; student_id: string; amount_kes: number; payment_method: string; payment_date: string; receipt_number: string | null; transaction_reference: string | null }

const localDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}
const money = (amount: number) => 'KES ' + amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const methodName = (method: string) => ({ mpesa: 'M-Pesa', cash: 'Cash', bank: 'Bank transfer', cheque: 'Cheque', other: 'Other' }[method] || method)

export default function FeeReports({ schools }: { schools: School[] }) {
  const [schoolId, setSchoolId] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [period, setPeriod] = useState('month')
  const [startDate, setStartDate] = useState(localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [endDate, setEndDate] = useState(localDate(new Date()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!schoolId && schools.length) setSchoolId(schools.find(s => (s as any).status === 'approved')?.id || schools[0].id)
  }, [schools, schoolId])

  useEffect(() => { if (schoolId) void load() }, [schoolId])

  function choosePeriod(value: string) {
    setPeriod(value)
    const now = new Date()
    const end = localDate(now)
    let start = end
    if (value === 'week') {
      const monday = new Date(now)
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      start = localDate(monday)
    } else if (value === 'month') {
      start = localDate(new Date(now.getFullYear(), now.getMonth(), 1))
    } else if (value === 'year') {
      start = localDate(new Date(now.getFullYear(), 0, 1))
    }
    if (value !== 'custom') { setStartDate(start); setEndDate(end) }
  }

  async function load() {
    setBusy(true); setError('')
    const [p, s, c] = await Promise.all([
      supabase.from('fee_payments').select('id,student_id,amount_kes,payment_method,payment_date,receipt_number,transaction_reference').eq('school_id', schoolId).order('payment_date', { ascending: false }),
      supabase.from('students').select('id,class_id').eq('school_id', schoolId),
      supabase.from('classes').select('id,name').eq('school_id', schoolId).order('sort_order')
    ])
    const failed = [p, s, c].find(result => result.error)
    if (failed?.error) setError(failed.error.message)
    else { setPayments((p.data || []) as Payment[]); setStudents((s.data || []) as Student[]); setClasses((c.data || []) as ClassRow[]) }
    setBusy(false)
  }

  const filtered = useMemo(() => payments.filter(p => p.payment_date >= startDate && p.payment_date <= endDate), [payments, startDate, endDate])
  const total = filtered.reduce((sum, p) => sum + Number(p.amount_kes), 0)
  const selectedSchool = schools.find(s => s.id === schoolId)
  const classTotals = useMemo(() => {
    const groups = new Map<string, { name: string; amount: number; count: number }>()
    for (const p of filtered) {
      const student = students.find(s => s.id === p.student_id)
      const classId = student?.class_id || 'unassigned'
      const name = classes.find(c => c.id === classId)?.name || 'Unassigned'
      const current = groups.get(classId) || { name, amount: 0, count: 0 }
      current.amount += Number(p.amount_kes); current.count += 1; groups.set(classId, current)
    }
    return [...groups.values()].sort((a, b) => b.amount - a.amount)
  }, [filtered, students, classes])
  const methodTotals = useMemo(() => {
    const groups = new Map<string, { name: string; amount: number; count: number }>()
    for (const p of filtered) {
      const current = groups.get(p.payment_method) || { name: methodName(p.payment_method), amount: 0, count: 0 }
      current.amount += Number(p.amount_kes); current.count += 1; groups.set(p.payment_method, current)
    }
    return [...groups.values()].sort((a, b) => b.amount - a.amount)
  }, [filtered])
  const dailyTotals = useMemo(() => {
    const groups = new Map<string, { date: string; amount: number; count: number }>()
    for (const p of filtered) {
      const current = groups.get(p.payment_date) || { date: p.payment_date, amount: 0, count: 0 }
      current.amount += Number(p.amount_kes); current.count += 1; groups.set(p.payment_date, current)
    }
    return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date))
  }, [filtered])

  function exportCsv() {
    const rows = [
      [`${selectedSchool?.name || 'Smart Minds'} Fee Collection Report`, ''],
      ...(selectedSchool?.motto ? [['School motto', selectedSchool.motto]] : [] ),
      ['From', startDate], ['To', endDate], [],
      ['Collection summary', ''],
      ['Total collected (KES)', total.toFixed(2)], ['Number of payments', String(filtered.length)], [],
      ['Class', 'Amount (KES)', 'Payments'],
      ...classTotals.map(row => [row.name, row.amount.toFixed(2), String(row.count)]), [],
      ['Payment method', 'Amount (KES)', 'Payments'],
      ...methodTotals.map(row => [row.name, row.amount.toFixed(2), String(row.count)]), [],
      ['Payment date', 'Amount (KES)', 'Payments'],
      ...dailyTotals.map(row => [row.date, row.amount.toFixed(2), String(row.count)])
    ]
    const csv = rows.map(row => row.map(value => '"' + String(value ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url; link.download = 'smart-minds-fee-report-' + startDate + '-to-' + endDate + '.csv'
    link.click(); URL.revokeObjectURL(url)
  }

  return <section className="panel fee-reports-panel">
    <div className="academic-head no-print"><div><p className="kicker">SCHOOL FINANCE</p><h2>Fee collection reports</h2><p className="muted">Review collections by date, class and payment method. Export the report or print it.</p></div><button className="secondary" onClick={() => void load()} disabled={busy}><RefreshCw /> Refresh</button></div>
    <label className="school-picker no-print">Select school<select value={schoolId} onChange={e => setSchoolId(e.target.value)}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {error && <p className="alert error"><XCircle />{error}</p>}
    <div className="report-filters no-print">
      <label>Report period<select value={period} onChange={e => choosePeriod(e.target.value)}><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="year">This year</option><option value="custom">Custom dates</option></select></label>
      <label>From<input type="date" value={startDate} max={endDate} onChange={e => { setPeriod('custom'); setStartDate(e.target.value) }} /></label>
      <label>To<input type="date" value={endDate} min={startDate} onChange={e => { setPeriod('custom'); setEndDate(e.target.value) }} /></label>
      <div className="report-actions"><button className="secondary" onClick={exportCsv} disabled={!filtered.length}><Download /> Export CSV</button><button className="primary" onClick={() => window.print()}><Printer /> Print report</button></div>
    </div>
    <div className="report-brand" style={{ display:'flex', alignItems:'center', gap:14, margin:'18px 0' }}>{selectedSchool?.logo_url&&<img src={selectedSchool.logo_url} alt={selectedSchool.name+' logo'} style={{ width:68, height:68, objectFit:'contain' }}/>}<div><h2 style={{ margin:0 }}>{selectedSchool?.name || 'Smart Minds'}</h2>{selectedSchool?.motto&&<p className="muted" style={{ margin:'5px 0 0' }}>{selectedSchool.motto}</p>}</div></div>
    <div className="report-heading"><div><p className="kicker">COLLECTION PERIOD</p><h3>{startDate} to {endDate}</h3></div><span>{busy ? 'Updating…' : filtered.length + ' payments'}</span></div>
    <div className="stats fees-stats report-stats">
      <article className="panel"><Wallet /><span>Total collected</span><b>{money(total)}</b></article>
      <article className="panel"><BarChart3 /><span>Number of payments</span><b>{filtered.length.toLocaleString('en-KE')}</b></article>
      <article className="panel"><Wallet /><span>Average payment</span><b>{money(filtered.length ? total / filtered.length : 0)}</b></article>
    </div>
    <div className="report-grid">
      <section className="panel report-section"><div className="panel-heading"><h2>Class-wise collections</h2><span>{classTotals.length} classes</span></div>
        {!classTotals.length ? <p className="muted">No collections in this period.</p> : <div className="table-wrap"><table><thead><tr><th>Class</th><th>Payments</th><th>Collected</th></tr></thead><tbody>{classTotals.map(row => <tr key={row.name}><td><b>{row.name}</b></td><td>{row.count}</td><td><b>{money(row.amount)}</b></td></tr>)}</tbody></table></div>}
      </section>
      <section className="panel report-section"><div className="panel-heading"><h2>Payment methods</h2><span>{methodTotals.length} methods</span></div>
        {!methodTotals.length ? <p className="muted">No collections in this period.</p> : <div className="table-wrap"><table><thead><tr><th>Method</th><th>Payments</th><th>Collected</th></tr></thead><tbody>{methodTotals.map(row => <tr key={row.name}><td><b>{row.name}</b></td><td>{row.count}</td><td><b>{money(row.amount)}</b></td></tr>)}</tbody></table></div>}
      </section>
    </div>
    <section className="panel report-section daily-report"><div className="panel-heading"><h2>Daily collection breakdown</h2><span>{dailyTotals.length} days</span></div>
      {!dailyTotals.length ? <div className="empty"><Wallet /><h3>No payments for this period</h3><p>Try a different date range or record a payment first.</p></div> : <div className="table-wrap"><table><thead><tr><th>Payment date</th><th>Payments</th><th>Collected</th></tr></thead><tbody>{dailyTotals.map(row => <tr key={row.date}><td>{row.date}</td><td>{row.count}</td><td><b>{money(row.amount)}</b></td></tr>)}</tbody></table></div>}
    </section>
    <p className="report-footnote">Reports include payments recorded in Smart Minds for the selected school and dates. M-Pesa, cash and other methods are based on the payment method selected when a payment was entered.</p>
  </section>
}
