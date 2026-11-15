import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpen, ClipboardList, Plus, Printer, RefreshCw, Save, XCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string }
type Row = { id: string; [key: string]: any }
type Exam = Row & { name: string; class_id: string; academic_year_id: string; term_id: string | null; max_score: number; status: string }
type Learner = Row & { first_name: string; middle_name?: string | null; last_name: string; admission_number: string; class_id: string | null }
type Subject = Row & { name: string }
type Result = Row & { student_id: string; subject_id: string; score: number; remarks?: string | null }

function grade(score: number, max: number) {
  const percent = max > 0 ? score / max * 100 : 0
  if (percent >= 80) return 'EE'
  if (percent >= 60) return 'ME'
  if (percent >= 40) return 'AE'
  return 'BE'
}
const fullName = (s: Learner) => [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ')

export default function ExaminationsManager({ schools }: { schools: School[] }) {
  const [schoolId, setSchoolId] = useState('')
  const [years, setYears] = useState<Row[]>([])
  const [terms, setTerms] = useState<Row[]>([])
  const [classes, setClasses] = useState<Row[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [students, setStudents] = useState<Learner[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [tab, setTab] = useState<'exams' | 'marks' | 'reports'>('exams')
  const [form, setForm] = useState({ academic_year_id: '', term_id: '', class_id: '', name: '', exam_date: new Date().toISOString().slice(0,10), max_score: '100' })
  const [mark, setMark] = useState({ student_id: '', subject_id: '', score: '', remarks: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!schoolId && schools.length) setSchoolId(schools[0].id)
  }, [schools, schoolId])

  useEffect(() => { if (schoolId) void loadSetup() }, [schoolId])
  useEffect(() => { if (schoolId) void loadExams() }, [schoolId])
  useEffect(() => { if (selectedExamId) void loadResults(selectedExamId); else setResults([]) }, [selectedExamId])

  async function loadSetup() {
    setError('')
    const [y,t,c,s,st] = await Promise.all([
      supabase.from('academic_years').select('id,name').eq('school_id',schoolId).order('start_date'),
      supabase.from('terms').select('id,name,academic_year_id').eq('school_id',schoolId).order('start_date'),
      supabase.from('classes').select('id,name').eq('school_id',schoolId).order('sort_order'),
      supabase.from('subjects').select('id,name').eq('school_id',schoolId).order('name'),
      supabase.from('students').select('id,admission_number,first_name,middle_name,last_name,class_id').eq('school_id',schoolId).order('first_name'),
    ])
    const failed = [y,t,c,s,st].find(x => x.error)
    if (failed?.error) { setError(failed.error.message); return }
    setYears(y.data || []); setTerms(t.data || []); setClasses(c.data || [])
    setSubjects(s.data || []); setStudents((st.data || []) as Learner[])
    if (!form.academic_year_id && y.data?.[0]) setForm(v => ({ ...v, academic_year_id: y.data![0].id }))
  }

  async function loadExams() {
    const { data, error } = await supabase.from('examinations').select('*').eq('school_id',schoolId).order('created_at',{ascending:false})
    if (error) setError(error.message)
    else {
      const list = (data || []) as Exam[]
      setExams(list)
      if (!selectedExamId && list[0]) setSelectedExamId(list[0].id)
    }
  }

  async function loadResults(examId: string) {
    const { data, error } = await supabase.from('exam_results').select('*').eq('school_id',schoolId).eq('examination_id',examId)
    if (error) setError(error.message)
    else setResults((data || []) as Result[])
  }

  async function createExam(e: FormEvent) {
    e.preventDefault()
    if (!schoolId) return
    setBusy(true); setError(''); setNotice('')
    const { data, error } = await supabase.from('examinations').insert({
      school_id: schoolId, academic_year_id: form.academic_year_id,
      term_id: form.term_id || null, class_id: form.class_id,
      name: form.name.trim(), exam_date: form.exam_date || null,
      max_score: Number(form.max_score), status: 'draft'
    }).select('*').single()
    if (error) setError(error.message)
    else {
      setNotice('Examination created successfully.')
      setExams(current => [data as Exam, ...current]); setSelectedExamId(data.id)
      setForm(v => ({ ...v, name: '' })); setTab('marks')
    }
    setBusy(false)
  }

  const selectedExam = exams.find(e => e.id === selectedExamId)
  const examStudents = useMemo(() => students.filter(s => s.class_id === selectedExam?.class_id), [students, selectedExam])
  const existingMark = results.find(r => r.student_id === mark.student_id && r.subject_id === mark.subject_id)

  async function saveMark(e: FormEvent) {
    e.preventDefault()
    if (!selectedExam || !schoolId) return
    const score = Number(mark.score)
    if (!mark.student_id || !mark.subject_id || mark.score === '' || !Number.isFinite(score) || score < 0 || score > Number(selectedExam.max_score)) {
      setError('Choose a learner and subject, and enter a score from 0 to ' + selectedExam.max_score + '.')
      return
    }
    setBusy(true); setError(''); setNotice('')
    const payload = { school_id: schoolId, examination_id: selectedExam.id, student_id: mark.student_id, subject_id: mark.subject_id, score, remarks: mark.remarks.trim() || null }
    const query = supabase.from('exam_results')
    const response = existingMark
      ? await query.update({ score, remarks: payload.remarks }).eq('id', existingMark.id).eq('school_id',schoolId)
      : await query.insert(payload)
    if (response.error) setError(response.error.message)
    else {
      setNotice('Learner mark saved successfully.')
      setMark(v => ({ ...v, score: '', remarks: '' }))
      await loadResults(selectedExam.id)
    }
    setBusy(false)
  }

  const reportResults = results.filter(r => r.student_id === selectedStudentId)
  const total = reportResults.reduce((sum,r) => sum + Number(r.score),0)
  const possible = reportResults.length * Number(selectedExam?.max_score || 0)
  const average = possible ? total / possible * 100 : 0
  const student = students.find(s => s.id === selectedStudentId)

  return <section className="panel">
    <div className="academic-head"><div><p className="kicker">ASSESSMENT & PERFORMANCE</p><h2>Examinations and report cards</h2><p className="muted">Create examinations, record subject marks and prepare learner performance reports.</p></div><button className="secondary" onClick={() => { void loadSetup(); void loadExams(); if (selectedExamId) void loadResults(selectedExamId) }}><RefreshCw/> Refresh</button></div>
    <label className="school-picker">Select school<select value={schoolId} onChange={e => { setSchoolId(e.target.value); setSelectedExamId(''); setSelectedStudentId('') }}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {error && <p className="alert error"><XCircle/>{error}</p>}
    {notice && <p className="alert success"><CheckCircle2/>{notice}</p>}
    <div className="student-toolbar">
      <button className={tab === 'exams' ? 'primary' : 'secondary'} onClick={() => setTab('exams')}><Plus/> Examinations</button>
      <button className={tab === 'marks' ? 'primary' : 'secondary'} onClick={() => setTab('marks')}><Save/> Enter marks</button>
      <button className={tab === 'reports' ? 'primary' : 'secondary'} onClick={() => setTab('reports')}><BookOpen/> Report cards</button>
    </div>
    {tab === 'exams' && <>
      <form className="school-form" onSubmit={createExam}>
        <h3 className="wide">Create examination</h3>
        <label>Academic year *<select required value={form.academic_year_id} onChange={e => setForm(v => ({...v,academic_year_id:e.target.value,term_id:''}))}><option value="">Select academic year</option>{years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</select></label>
        <label>Term<select value={form.term_id} onChange={e => setForm(v => ({...v,term_id:e.target.value}))}><option value="">No term selected</option>{terms.filter(t => t.academic_year_id === form.academic_year_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label>Class *<select required value={form.class_id} onChange={e => setForm(v => ({...v,class_id:e.target.value}))}><option value="">Select class</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Examination name *<input required value={form.name} onChange={e => setForm(v => ({...v,name:e.target.value}))} placeholder="e.g. End of Term 1" /></label>
        <label>Examination date<input type="date" value={form.exam_date} onChange={e => setForm(v => ({...v,exam_date:e.target.value}))}/></label>
        <label>Maximum score *<input type="number" min="1" step="0.01" required value={form.max_score} onChange={e => setForm(v => ({...v,max_score:e.target.value}))}/></label>
        <button className="primary wide" disabled={busy || !schoolId || !years.length || !classes.length}>{busy ? 'Saving…' : 'Create examination'}</button>
      </form>
      <h3>Examinations created</h3>
      {exams.length === 0 ? <div className="empty"><ClipboardList/><h3>No examinations yet</h3><p>Create the first examination above.</p></div> : <div className="table-wrap"><table><thead><tr><th>Examination</th><th>Year / term</th><th>Class</th><th>Date</th><th>Maximum</th><th>Marks entered</th><th>Action</th></tr></thead><tbody>{exams.map(ex => <tr key={ex.id}><td><b>{ex.name}</b></td><td>{years.find(y => y.id === ex.academic_year_id)?.name || '—'} / {terms.find(t => t.id === ex.term_id)?.name || '—'}</td><td>{classes.find(c => c.id === ex.class_id)?.name || '—'}</td><td>{ex.exam_date || '—'}</td><td>{ex.max_score}</td><td>{results.length && ex.id === selectedExamId ? results.length : '—'}</td><td><button className="secondary" onClick={() => { setSelectedExamId(ex.id); setTab('marks') }}>Open</button></td></tr>)}</tbody></table></div>}
    </>}
    {tab === 'marks' && <>
      <label className="school-picker">Select examination<select value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}><option value="">Select examination</option>{exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name} · {classes.find(c => c.id === ex.class_id)?.name || ''}</option>)}</select></label>
      {!selectedExam ? <div className="empty"><ClipboardList/><h3>Select an examination</h3><p>Create an examination first, then enter marks.</p></div> : <>
        <form className="school-form" onSubmit={saveMark}>
          <h3 className="wide">Record subject mark · {selectedExam.name}</h3>
          <label>Learner *<select required value={mark.student_id} onChange={e => setMark(v => ({...v,student_id:e.target.value}))}><option value="">Select learner</option>{examStudents.map(s => <option key={s.id} value={s.id}>{s.admission_number} · {fullName(s)}</option>)}</select></label>
          <label>Subject *<select required value={mark.subject_id} onChange={e => setMark(v => ({...v,subject_id:e.target.value}))}><option value="">Select subject</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Score *<input required type="number" min="0" max={selectedExam.max_score} step="0.01" value={mark.score} onChange={e => setMark(v => ({...v,score:e.target.value}))} placeholder={'0–' + selectedExam.max_score}/></label>
          <label>Teacher remarks<input value={mark.remarks} onChange={e => setMark(v => ({...v,remarks:e.target.value}))} placeholder="Optional comment"/></label>
          <button className="primary wide" disabled={busy || !examStudents.length || !subjects.length}>{busy ? 'Saving…' : existingMark ? 'Update mark' : 'Save mark'}</button>
        </form>
        <h3>Marks recorded ({results.length})</h3>
        {results.length === 0 ? <p className="muted">No marks have been entered for this examination.</p> : <div className="table-wrap"><table><thead><tr><th>Learner</th><th>Subject</th><th>Score</th><th>CBC achievement level</th><th>Remarks</th></tr></thead><tbody>{results.map(r => { const s = students.find(x => x.id === r.student_id); const sub = subjects.find(x => x.id === r.subject_id); return <tr key={r.id}><td>{s ? fullName(s) : 'Learner'}</td><td>{sub?.name || 'Subject'}</td><td>{r.score} / {selectedExam.max_score}</td><td>{grade(Number(r.score),Number(selectedExam.max_score))}</td><td>{r.remarks || '—'}</td></tr> })}</tbody></table></div>}
      </>}
    </>}
    {tab === 'reports' && <>
      <label className="school-picker">Select examination<select value={selectedExamId} onChange={e => { setSelectedExamId(e.target.value); setSelectedStudentId('') }}><option value="">Select examination</option>{exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name} · {classes.find(c => c.id === ex.class_id)?.name || ''}</option>)}</select></label>
      {selectedExam && <label className="school-picker">Select learner<select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)}><option value="">Select learner</option>{examStudents.map(s => <option key={s.id} value={s.id}>{s.admission_number} · {fullName(s)}</option>)}</select></label>}
      {student && selectedExam && <div className="panel" id="learner-report-card">
        <div className="panel-heading"><div><p className="kicker">SMART MINDS · LEARNER REPORT</p><h2>{fullName(student)}</h2><p className="muted">{student.admission_number} · {classes.find(c => c.id === student.class_id)?.name || ''}</p></div><button className="secondary" onClick={() => window.print()}><Printer/> Print report card</button></div>
        <h3>{selectedExam.name}</h3>
        <div className="table-wrap"><table><thead><tr><th>Learning area</th><th>Score</th><th>Percentage</th><th>CBC achievement level</th><th>Teacher remarks</th></tr></thead><tbody>{reportResults.map(r => { const sub = subjects.find(x => x.id === r.subject_id); const pct = Number(r.score) / Number(selectedExam.max_score) * 100; return <tr key={r.id}><td>{sub?.name || 'Subject'}</td><td>{r.score} / {selectedExam.max_score}</td><td>{pct.toFixed(1)}%</td><td>{grade(Number(r.score),Number(selectedExam.max_score))}</td><td>{r.remarks || '—'}</td></tr> })}</tbody></table></div>
        <div className="stats"><article className="panel"><span>Total score</span><b>{total.toFixed(1)}</b></article><article className="panel"><span>Average</span><b>{average.toFixed(1)}%</b></article><article className="panel"><span>Overall CBC level</span><b>{reportResults.length ? grade(average,100) : '—'}</b></article></div>
        {reportResults.length === 0 && <p className="muted">No subject marks have been recorded for this learner yet.</p>}
      </div>}
    </>}
    {tab !== 'exams' && (!exams.length || !subjects.length || !students.length) && <p className="muted">To use assessments, set up academic years, classes, subjects and register learners first.</p>}
  </section>
}
