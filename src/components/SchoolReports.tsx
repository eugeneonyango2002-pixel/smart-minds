import { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, BookOpen, CalendarCheck, Download, FileBarChart, Printer, RefreshCw, Users, Wallet, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string; motto?: string | null; logo_url?: string | null }
type Student = { id: string; class_id: string | null; gender: string; status: string }
type ClassRow = { id: string; name: string }
type Attendance = { student_id: string; attendance_date: string; status: string }
type Exam = { id: string; name: string; class_id: string; exam_date: string | null; max_score: number; academic_year_id: string }
type Result = { examination_id: string; student_id: string; subject_id: string; score: number }
type FeeStructure = { id: string; class_id: string; amount_kes: number; academic_year_id: string }
type Payment = { student_id: string; fee_structure_id: string; amount_kes: number; payment_date: string }

const localDate = (date: Date) => {
  const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + d
}
const money = (n: number) => 'KES ' + n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function SchoolReports({ schools }: { schools: School[] }) {
  const [schoolId, setSchoolId] = useState('')
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [academicYearName, setAcademicYearName] = useState('')
  const [startDate, setStartDate] = useState(localDate(new Date(new Date().getFullYear(), 0, 1)))
  const [endDate, setEndDate] = useState(localDate(new Date()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!schoolId && schools.length) setSchoolId(schools.find(s => (s as any).status === 'approved')?.id || schools[0].id)
  }, [schools, schoolId])
  useEffect(() => { if (schoolId) void load() }, [schoolId, startDate, endDate])

  async function load() {
    setBusy(true); setError('')
    const yearResult = await supabase.from('academic_years').select('id,name,is_current,start_date').eq('school_id', schoolId).order('start_date', { ascending: false })
    if (yearResult.error) { setError(yearResult.error.message); setBusy(false); return }
    const year = (yearResult.data || []).find(y => y.is_current) || yearResult.data?.[0]
    setAcademicYearName(year?.name || 'No academic year set')
    const [s, c, a, e, f, p] = await Promise.all([
      supabase.from('students').select('id,class_id,gender,status').eq('school_id', schoolId),
      supabase.from('classes').select('id,name').eq('school_id', schoolId).order('sort_order'),
      supabase.from('student_attendance').select('student_id,attendance_date,status').eq('school_id', schoolId).gte('attendance_date', startDate).lte('attendance_date', endDate),
      supabase.from('examinations').select('id,name,class_id,exam_date,max_score,academic_year_id').eq('school_id', schoolId).gte('exam_date', startDate).lte('exam_date', endDate),
      year ? supabase.from('fee_structures').select('id,class_id,amount_kes,academic_year_id').eq('school_id', schoolId).eq('academic_year_id', year.id) : Promise.resolve({ data: [], error: null } as any),
      supabase.from('fee_payments').select('student_id,fee_structure_id,amount_kes,payment_date').eq('school_id', schoolId)
    ])
    const failed = [s, c, a, e, f, p].find(x => x.error)
    if (failed?.error) setError(failed.error.message)
    else {
      setStudents((s.data || []) as Student[]); setClasses((c.data || []) as ClassRow[])
      setAttendance((a.data || []) as Attendance[]); setExams((e.data || []) as Exam[])
      setFeeStructures((f.data || []) as FeeStructure[]); setPayments((p.data || []) as Payment[])
      const examIds = (e.data || []).map((x: Exam) => x.id)
      if (examIds.length) {
        const r = await supabase.from('exam_results').select('examination_id,student_id,subject_id,score').eq('school_id', schoolId).in('examination_id', examIds)
        if (r.error) setError(r.error.message)
        else setResults((r.data || []) as Result[])
      } else setResults([])
    }
    setBusy(false)
  }

  const selectedSchool = schools.find(s => s.id === schoolId)
  const activeStudents = students.filter(s => s.status === 'active')
  const classRows = useMemo(() => classes.map(c => {
    const members = activeStudents.filter(s => s.class_id === c.id)
    return { name: c.name, total: members.length, male: members.filter(s => s.gender === 'male').length, female: members.filter(s => s.gender === 'female').length }
  }), [classes, activeStudents])
  const genderRows = ['male', 'female', 'other'].map(g => ({ name: g === 'other' ? 'Not specified / other' : g[0].toUpperCase() + g.slice(1), count: activeStudents.filter(s => s.gender === g).length }))
  const attendanceSummary = attendance.reduce((acc, row) => { acc[row.status] = (acc[row.status] || 0) + 1; return acc }, {} as Record<string, number>)
  const attendanceDenominator = attendance.length - (attendanceSummary.excused || 0)
  const attendanceRate = attendanceDenominator > 0 ? ((attendanceSummary.present || 0) + (attendanceSummary.late || 0)) / attendanceDenominator * 100 : 0
  const examSummary = useMemo(() => {
    const maxByExam = new Map(exams.map(e => [e.id, Number(e.max_score)]))
    const valid = results.filter(r => maxByExam.has(r.examination_id) && maxByExam.get(r.examination_id)! > 0)
    const average = valid.length ? valid.reduce((sum, r) => sum + Number(r.score) / maxByExam.get(r.examination_id)! * 100, 0) / valid.length : 0
    return { exams: exams.length, entries: valid.length, average }
  }, [exams, results])
  const currentFees = feeStructures.reduce((sum, f) => sum + Number(f.amount_kes) * activeStudents.filter(s => s.class_id === f.class_id).length, 0)
  const currentFeeIds = new Set(feeStructures.map(f => f.id))
  const currentPayments = payments.filter(p => currentFeeIds.has(p.fee_structure_id))
  const totalPaid = currentPayments.reduce((sum, p) => sum + Number(p.amount_kes), 0)
  const balance = Math.max(0, currentFees - totalPaid)
  const periodPayments = payments.filter(p => p.payment_date >= startDate && p.payment_date <= endDate)
  const periodCollected = periodPayments.reduce((sum, p) => sum + Number(p.amount_kes), 0)

  function exportCsv() {
    const rows: (string | number)[][] = [
      [selectedSchool?.name || 'Smart Minds', 'School management report'],
      ['Reporting period', startDate + ' to ' + endDate], ['Academic year for fee summary', academicYearName], [],
      ['ENROLMENT BY CLASS', 'Learners', 'Male', 'Female'],
      ...classRows.map(r => [r.name, r.total, r.male, r.female]), [],
      ['GENDER SUMMARY', 'Learners'], ...genderRows.map(r => [r.name, r.count]), [],
      ['ATTENDANCE SUMMARY', 'Records'],
      ['Present', attendanceSummary.present || 0], ['Absent', attendanceSummary.absent || 0], ['Late', attendanceSummary.late || 0], ['Excused', attendanceSummary.excused || 0], ['Attendance rate (excluding excused)', attendanceRate.toFixed(1) + '%'], [],
      ['ACADEMIC PERFORMANCE', 'Value'], ['Examinations in period', examSummary.exams], ['Result entries', examSummary.entries], ['Average achievement', examSummary.average.toFixed(1) + '%'], [],
      ['FEES SUMMARY', 'KES'], ['Current-year expected fees', currentFees.toFixed(2)], ['Current-year payments received', totalPaid.toFixed(2)], ['Estimated outstanding balance', balance.toFixed(2)], ['Payments collected in reporting period', periodCollected.toFixed(2)]
    ]
    const csv = rows.map(row => row.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a'); link.href = url; link.download = 'smart-minds-school-report-' + startDate + '-to-' + endDate + '.csv'; link.click(); URL.revokeObjectURL(url)
  }

  return <section className="panel">
    <div className="academic-head no-print"><div><p className="kicker">SCHOOL MANAGEMENT INSIGHTS</p><h2>Comprehensive school reports</h2><p className="muted">A combined overview of enrolment, attendance, academic performance and school fees.</p></div><button className="secondary" onClick={() => void load()} disabled={busy}><RefreshCw /> Refresh</button></div>
    <label className="school-picker no-print">Select school<select value={schoolId} onChange={e => setSchoolId(e.target.value)}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <div className="report-filters no-print"><label>From date<input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)} /></label><label>To date<input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} /></label><div className="report-actions"><button className="secondary" onClick={exportCsv} disabled={busy || !schoolId}><Download /> Export CSV</button><button className="primary" onClick={() => window.print()}><Printer /> Print / Save PDF</button></div></div>
    {error && <p className="alert error"><XCircle />{error}</p>}
    <div className="report-brand" style={{ display:'flex', alignItems:'center', gap:14, margin:'18px 0' }}>{selectedSchool?.logo_url && <img src={selectedSchool.logo_url} alt={selectedSchool.name + ' logo'} style={{ width:68, height:68, objectFit:'contain' }}/>}<div><h2 style={{ margin:0 }}>{selectedSchool?.name || 'Smart Minds'}</h2>{selectedSchool?.motto && <p className="muted" style={{ margin:'5px 0 0' }}>{selectedSchool.motto}</p>}</div></div>
    <div className="report-heading"><div><p className="kicker">REPORTING PERIOD</p><h3>{startDate} to {endDate}</h3><span className="muted">Fee summary academic year: {academicYearName}</span></div><span>{busy ? 'Updating…' : 'Report ready'}</span></div>
    <div className="stats report-stats">
      <article className="panel"><Users/><span>Active learners</span><b>{activeStudents.length.toLocaleString('en-KE')}</b></article>
      <article className="panel"><CalendarCheck/><span>Attendance rate</span><b>{attendanceRate.toFixed(1)}%</b></article>
      <article className="panel"><BookOpen/><span>Average achievement</span><b>{examSummary.average.toFixed(1)}%</b></article>
      <article className="panel"><Wallet/><span>Collected in period</span><b>{money(periodCollected)}</b></article>
    </div>
    {busy && <p className="muted">Loading school reports…</p>}
    <div className="report-grid">
      <section className="panel report-section"><div className="panel-heading"><h2><Users size={18}/> Enrolment by class</h2><span>{activeStudents.length} active learners</span></div>
        {!classRows.length ? <p className="muted">No classes have been registered.</p> : <div className="table-wrap"><table><thead><tr><th>Class</th><th>Total</th><th>Male</th><th>Female</th></tr></thead><tbody>{classRows.map(r => <tr key={r.name}><td><b>{r.name}</b></td><td>{r.total}</td><td>{r.male}</td><td>{r.female}</td></tr>)}</tbody></table></div>}
      </section>
      <section className="panel report-section"><div className="panel-heading"><h2><Activity size={18}/> Learners by gender</h2></div><div className="table-wrap"><table><thead><tr><th>Gender</th><th>Active learners</th></tr></thead><tbody>{genderRows.map(r => <tr key={r.name}><td>{r.name}</td><td><b>{r.count}</b></td></tr>)}</tbody></table></div></section>
      <section className="panel report-section"><div className="panel-heading"><h2><CalendarCheck size={18}/> Attendance summary</h2><span>{attendance.length} records</span></div><div className="table-wrap"><table><thead><tr><th>Status</th><th>Records</th></tr></thead><tbody>{['present','absent','late','excused'].map(k => <tr key={k}><td>{k[0].toUpperCase()+k.slice(1)}</td><td>{attendanceSummary[k] || 0}</td></tr>)}</tbody></table></div><p className="muted">Attendance rate counts present and late records against all non-excused records in the selected dates.</p></section>
      <section className="panel report-section"><div className="panel-heading"><h2><BookOpen size={18}/> Academic performance</h2><span>{examSummary.exams} examinations</span></div><div className="stats"><article className="panel"><span>Result entries</span><b>{examSummary.entries}</b></article><article className="panel"><span>Average achievement</span><b>{examSummary.average.toFixed(1)}%</b></article></div><p className="muted">Average is calculated from recorded subject scores as a percentage of each examination's maximum score, within the selected examination dates.</p></section>
      <section className="panel report-section"><div className="panel-heading"><h2><Wallet size={18}/> Fees overview</h2><span>{academicYearName}</span></div><div className="table-wrap"><table><tbody><tr><th>Expected fees for active learners</th><td>{money(currentFees)}</td></tr><tr><th>Payments against current-year fee items</th><td>{money(totalPaid)}</td></tr><tr><th>Estimated outstanding balance</th><td><b>{money(balance)}</b></td></tr><tr><th>Collections in selected period (all fee items)</th><td>{money(periodCollected)}</td></tr></tbody></table></div><p className="muted">Expected fees are based on current-year fee structures multiplied by active learners in each class. This is an estimate; individual adjustments are not included.</p></section>
    </div>
    <p className="report-footnote">This report combines existing Smart Minds records. Enrolment and fee expectations reflect the current register and current academic year; attendance, examination and collection figures follow the selected date range.</p>
  </section>
}
