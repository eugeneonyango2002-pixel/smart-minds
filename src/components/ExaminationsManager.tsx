import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { BookOpen, ClipboardList, Download, Plus, Printer, RefreshCw, Save, XCircle, CheckCircle2, Trash2, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string; motto?: string | null; logo_url?: string | null; registration_number?: string | null; address?: string | null; county?: string | null; sub_county?: string | null; contact_phone?: string | null; contact_email?: string | null }
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

function autoRemark(score: number, max: number) {
  const level = grade(score, max)
  if (level === 'EE') return 'Excellent achievement. Demonstrates strong understanding and applies learning confidently. Keep extending this excellent work.'
  if (level === 'ME') return 'Good progress. Demonstrates the expected understanding of the learning area. Keep practising to strengthen and extend these skills.'
  if (level === 'AE') return 'Making progress but needs more practice to meet the expected outcomes. Focus on the areas covered and seek guidance when needed.'
  return 'Needs additional support and regular practice to build understanding of the learning outcomes. Work closely with the teacher on the identified areas.'
}
const fullName = (s: Learner) => [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ')

export default function ExaminationsManager({ schools, canDelete = false, canPublish = false }: { schools: School[]; canDelete?: boolean; canPublish?: boolean }) {
  const [schoolId, setSchoolId] = useState('')
  const [years, setYears] = useState<Row[]>([])
  const [terms, setTerms] = useState<Row[]>([])
  const [classes, setClasses] = useState<Row[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classSubjectLinks, setClassSubjectLinks] = useState<Row[]>([])
  const [students, setStudents] = useState<Learner[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [selectedExamId, setSelectedExamId] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [reportMode, setReportMode] = useState<'exam' | 'term'>('term')
  const [selectedTermId, setSelectedTermId] = useState('')
  const [selectedTermClassId, setSelectedTermClassId] = useState('')
  const [termResults, setTermResults] = useState<(Result & { examination_id: string })[]>([])
  const [termAttendance, setTermAttendance] = useState<{ student_id: string; status: string; attendance_date: string }[]>([])
  const [termLoading, setTermLoading] = useState(false)
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
    const [y,t,c,s,cs,st] = await Promise.all([
      supabase.from('academic_years').select('id,name').eq('school_id',schoolId).order('start_date'),
      supabase.from('terms').select('id,name,academic_year_id,start_date,end_date').eq('school_id',schoolId).order('start_date'),
      supabase.from('classes').select('id,name').eq('school_id',schoolId).order('sort_order'),
      supabase.from('subjects').select('id,name,category').eq('school_id',schoolId).order('name'),
      supabase.from('class_subjects').select('id,class_id,subject_id').eq('school_id',schoolId),
      supabase.from('students').select('id,admission_number,first_name,middle_name,last_name,class_id').eq('school_id',schoolId).order('first_name'),
    ])
    const failed = [y,t,c,s,cs,st].find(x => x.error)
    if (failed?.error) { setError(failed.error.message); return }
    setYears(y.data || []); setTerms(t.data || []); setClasses(c.data || [])
    setSubjects(s.data || []); setClassSubjectLinks(cs.data || []); setStudents((st.data || []) as Learner[])
    if (!form.academic_year_id && y.data?.[0]) setForm(v => ({ ...v, academic_year_id: y.data![0].id }))
  }

  async function publishExamination(exam: Exam) {
    if (!schoolId || !canPublish || exam.status === 'published') return
    const { data, error: countError } = await supabase.from('exam_results').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('examination_id', exam.id)
    if (countError) { setError(countError.message); return }
    const markCount = data?.length ?? 0
    if (!markCount) { setError('This examination has no recorded marks. Enter and verify marks before publishing.'); return }
    if (!window.confirm('Publish "' + exam.name + '" for ' + (classes.find(c => c.id === exam.class_id)?.name || 'this class') + '? ' + markCount + ' recorded marks will become visible to linked parents.')) return
    setBusy(true); setError(''); setNotice('')
    const { error } = await supabase.from('examinations').update({ status: 'published', updated_at: new Date().toISOString() }).eq('id', exam.id).eq('school_id', schoolId)
    if (error) setError(error.message)
    else {
      setExams(current => current.map(item => item.id === exam.id ? { ...item, status: 'published' } : item))
      setNotice('Examination published. Linked parents can now view the recorded results.')
    }
    setBusy(false)
  }

  async function deleteExamination(exam: Exam) {
    if (!schoolId || !window.confirm('Permanently delete "' + exam.name + '" and all marks/results recorded under it? This cannot be undone.')) return
    setBusy(true); setError(''); setNotice('')
    const { error } = await supabase.rpc('delete_school_record', { p_school_id: schoolId, p_entity: 'examination', p_record_id: exam.id })
    if (error) setError(error.message)
    else {
      setNotice('Examination and its marks/results deleted.')
      if (selectedExamId === exam.id) setSelectedExamId('')
      await loadExams()
    }
    setBusy(false)
  }

  async function deleteMark(result: Result) {
    if (!schoolId || !selectedExam || !window.confirm('Permanently delete this learner mark for ' + (subjects.find(x => x.id === result.subject_id)?.name || 'this subject') + '? This cannot be undone.')) return
    setBusy(true); setError(''); setNotice('')
    const { error } = await supabase.rpc('delete_school_record', { p_school_id: schoolId, p_entity: 'exam_result', p_record_id: result.id })
    if (error) setError(error.message)
    else { setNotice('Learner mark deleted successfully.'); await loadResults(selectedExam.id) }
    setBusy(false)
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

  useEffect(() => {
    if (tab === 'reports' && reportMode === 'term' && selectedTermId && schoolId) void loadTermReport()
  }, [tab, reportMode, selectedTermId, schoolId])

  async function loadTermReport() {
    const term = terms.find(t => t.id === selectedTermId)
    if (!term || !schoolId) return
    setTermLoading(true); setError('')
    const termExams = exams.filter(e => e.term_id === selectedTermId)
    if (!termExams.length) {
      setTermResults([]); setTermAttendance([]); setTermLoading(false); return
    }
    const examIds = termExams.map(e => e.id)
    const [resultResponse, attendanceResponse] = await Promise.all([
      supabase.from('exam_results').select('id,examination_id,student_id,subject_id,score,remarks').eq('school_id', schoolId).in('examination_id', examIds),
      term.start_date && term.end_date
        ? supabase.from('student_attendance').select('student_id,status,attendance_date').eq('school_id', schoolId).gte('attendance_date', term.start_date).lte('attendance_date', term.end_date)
        : supabase.from('student_attendance').select('student_id,status,attendance_date').eq('school_id', schoolId)
    ])
    if (resultResponse.error) setError(resultResponse.error.message)
    else setTermResults((resultResponse.data || []) as (Result & { examination_id: string })[])
    if (attendanceResponse.error) setError(attendanceResponse.error.message)
    else {
      const rows = (attendanceResponse.data || []) as { student_id: string; status: string; attendance_date: string }[]
      setTermAttendance(term.start_date && term.end_date ? rows.filter(r => r.attendance_date >= term.start_date && r.attendance_date <= term.end_date) : rows)
    }
    setTermLoading(false)
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
  const examSubjects = subjects.filter(s => s.category !== 'co_curricular' && classSubjectLinks.some(link => link.class_id === selectedExam?.class_id && link.subject_id === s.id))

  async function saveMark(e: FormEvent) {
    e.preventDefault()
    if (!selectedExam || !schoolId) return
    const score = Number(mark.score)
    if (!mark.student_id || !mark.subject_id || mark.score === '' || !Number.isFinite(score) || score < 0 || score > Number(selectedExam.max_score)) {
      setError('Choose a learner and subject, and enter a score from 0 to ' + selectedExam.max_score + '.')
      return
    }
    setBusy(true); setError(''); setNotice('')
    const generatedRemark = autoRemark(score, Number(selectedExam.max_score))
    const payload = { school_id: schoolId, examination_id: selectedExam.id, student_id: mark.student_id, subject_id: mark.subject_id, score, remarks: mark.remarks.trim() || generatedRemark }
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
  const reportClassResults = results.filter(r => examStudents.some(s => s.id === r.student_id))
  const reportClassPossible = reportClassResults.length * Number(selectedExam?.max_score || 0)
  const reportClassAverage = reportClassPossible ? reportClassResults.reduce((sum,r) => sum + Number(r.score),0) / reportClassPossible * 100 : 0
  const student = students.find(s => s.id === selectedStudentId)
  const selectedTerm = terms.find(t => t.id === selectedTermId)
  const termClasses = classes.filter(c => exams.some(e => e.term_id === selectedTermId && e.class_id === c.id))
  const termStudents = students.filter(s => s.class_id === selectedTermClassId)
  const termExams = exams.filter(e => e.term_id === selectedTermId && e.class_id === selectedTermClassId)
  const termExamById = new Map(termExams.map(e => [e.id, e]))
  const termClassResults = termResults.filter(r => termExamById.has(r.examination_id) && termStudents.some(s => s.id === r.student_id))
  const termSubjectIds = [...new Set(termClassResults.map(r => r.subject_id))]
  const termClassAverage = termClassResults.length ? termClassResults.reduce((sum, r) => {
    const exam = termExamById.get(r.examination_id)!
    return sum + (Number(exam.max_score) > 0 ? Number(r.score) / Number(exam.max_score) * 100 : 0)
  }, 0) / termClassResults.length : 0
  const selectedSchool = schools.find(s => s.id === schoolId)

  function printClassReports() {
    if (!selectedExam || examStudents.length === 0) return
    document.body.classList.add('printing-bulk-reports')
    const cleanup = () => document.body.classList.remove('printing-bulk-reports')
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
  }

  function printTermReports() {
    if (!selectedTerm || !selectedTermClassId || !termStudents.length || !termClassResults.length) return
    document.body.classList.add('printing-term-reports')
    const cleanup = () => document.body.classList.remove('printing-term-reports')
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
  }

  function printIndividualReport() {
    document.body.classList.add('printing-single-report')
    const cleanup = () => document.body.classList.remove('printing-single-report')
    window.addEventListener('afterprint', cleanup, { once: true })
    window.print()
  }

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
      {exams.length === 0 ? <div className="empty"><ClipboardList/><h3>No examinations yet</h3><p>Create the first examination above.</p></div> : <div className="table-wrap"><table><thead><tr><th>Examination</th><th>Year / term</th><th>Class</th><th>Date</th><th>Maximum</th><th>Marks entered</th><th>Action</th></tr></thead><tbody>{exams.map(ex => <tr key={ex.id}><td><b>{ex.name}</b><div><span className="muted">{ex.status === 'published' ? 'Published to parents' : 'Draft · not visible to parents'}</span></div></td><td>{years.find(y => y.id === ex.academic_year_id)?.name || '—'} / {terms.find(t => t.id === ex.term_id)?.name || '—'}</td><td>{classes.find(c => c.id === ex.class_id)?.name || '—'}</td><td>{ex.exam_date || '—'}</td><td>{ex.max_score}</td><td>{results.length && ex.id === selectedExamId ? results.length : '—'}</td><td><div className="actions"><button className="secondary" onClick={() => { setSelectedExamId(ex.id); setTab('marks') }}>Open</button>{canPublish && <button className={ex.status === 'published' ? 'secondary' : 'primary'} disabled={busy || ex.status === 'published'} onClick={() => void publishExamination(ex)}><Send /> {ex.status === 'published' ? 'Published' : 'Publish to parents'}</button>}{canDelete && <button className="secondary" disabled={busy} onClick={() => void deleteExamination(ex)}><Trash2 /> Delete</button>}</div></td></tr>)}</tbody></table></div>}
    </>}
    {tab === 'marks' && <>
      <label className="school-picker">Select examination<select value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)}><option value="">Select examination</option>{exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name} · {classes.find(c => c.id === ex.class_id)?.name || ''}</option>)}</select></label>
      {!selectedExam ? <div className="empty"><ClipboardList/><h3>Select an examination</h3><p>Create an examination first, then enter marks.</p></div> : <>
        <form className="school-form" onSubmit={saveMark}>
          <h3 className="wide">Record subject mark · {selectedExam.name}</h3>
          <label>Learner *<select required value={mark.student_id} onChange={e => setMark(v => ({...v,student_id:e.target.value}))}><option value="">Select learner</option>{examStudents.map(s => <option key={s.id} value={s.id}>{s.admission_number} · {fullName(s)}</option>)}</select></label>
          <label>Subject *<select required value={mark.subject_id} onChange={e => setMark(v => ({...v,subject_id:e.target.value}))}><option value="">Select subject</option>{examSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Score *<input required type="number" min="0" max={selectedExam.max_score} step="0.01" value={mark.score} onChange={e => setMark(v => ({...v,score:e.target.value}))} placeholder={'0–' + selectedExam.max_score}/></label>
          <label>Teacher remarks (optional override)<input value={mark.remarks} onChange={e => setMark(v => ({...v,remarks:e.target.value}))} placeholder="Leave blank for automatic CBC feedback"/></label>
          <button className="primary wide" disabled={busy || !examStudents.length || !examSubjects.length}>{busy ? 'Saving…' : existingMark ? 'Update mark' : 'Save mark'}</button>
        </form>
        <h3>Marks recorded ({results.length})</h3>
        {results.length === 0 ? <p className="muted">No marks have been entered for this examination.</p> : <div className="table-wrap"><table><thead><tr><th>Learner</th><th>Subject</th><th>Score</th><th>CBC achievement level</th><th>Remarks</th>{canDelete && <th>Action</th>}</tr></thead><tbody>{results.map(r => { const s = students.find(x => x.id === r.student_id); const sub = subjects.find(x => x.id === r.subject_id); return <tr key={r.id}><td>{s ? fullName(s) : 'Learner'}</td><td>{sub?.name || 'Subject'}</td><td>{r.score} / {selectedExam.max_score}</td><td>{grade(Number(r.score),Number(selectedExam.max_score))}</td><td>{r.remarks || autoRemark(Number(r.score), Number(selectedExam.max_score))}</td>{canDelete && <td><button className="secondary" disabled={busy} onClick={() => void deleteMark(r)}><Trash2 /> Delete</button></td>}</tr> })}</tbody></table></div>}
      </>}
    </>}
    {tab === 'reports' && <>
      <div className="student-toolbar report-mode-toolbar">
        <button className={reportMode === 'term' ? 'primary' : 'secondary'} onClick={() => setReportMode('term')}>Full-term report</button>
        <button className={reportMode === 'exam' ? 'primary' : 'secondary'} onClick={() => setReportMode('exam')}>Single-examination report</button>
      </div>
      {reportMode === 'term' && <>
        <p className="muted">Combines recorded assessments across the selected term. Subject scores are averaged as percentages so examinations with different maximum marks can be combined fairly.</p>
        <label className="school-picker">Select academic term<select value={selectedTermId} onChange={e => { setSelectedTermId(e.target.value); setSelectedTermClassId('') }}><option value="">Choose term</option>{terms.map(t => <option key={t.id} value={t.id}>{years.find(y => y.id === t.academic_year_id)?.name || ''} · {t.name}</option>)}</select></label>
        {selectedTerm && <label className="school-picker">Select class<select value={selectedTermClassId} onChange={e => setSelectedTermClassId(e.target.value)}><option value="">Choose class</option>{termClasses.map(cl => <option key={cl.id} value={cl.id}>{cl.name}</option>)}</select></label>}
        {selectedTerm && selectedTermClassId && <>
          <div className="bulk-report-toolbar"><div><b>{classes.find(c => c.id === selectedTermClassId)?.name}</b><span>{termStudents.length} learners · {selectedTerm.name} · {termExams.length} assessments</span></div><button className="primary" onClick={printTermReports} disabled={termLoading || !termClassResults.length}><Download/> Download full-term reports</button></div>
          <p className="muted">Each learner receives one A4 report. Attendance is included when attendance records exist for the term dates.</p>
          {termLoading && <p className="muted">Preparing term results and attendance…</p>}
          {!termLoading && !termExams.length && <p className="muted">No examinations are linked to this term yet.</p>}
          {!termLoading && termExams.length > 0 && !termClassResults.length && <p className="muted">No assessment marks have been recorded for this class in the selected term yet.</p>}
        </>}
        {selectedTerm && selectedTermClassId && termClassResults.length > 0 && <div id="term-report-print" aria-hidden="true">
          {termStudents.map(learner => {
            const learnerRows = termClassResults.filter(r => r.student_id === learner.id)
            const bySubject = termSubjectIds.map(subjectId => {
              const rows = learnerRows.filter(r => r.subject_id === subjectId)
              const percentages = rows.map(r => { const ex = termExamById.get(r.examination_id)!; return Number(ex.max_score) > 0 ? Number(r.score) / Number(ex.max_score) * 100 : 0 })
              const pct = percentages.length ? percentages.reduce((a,b) => a+b,0) / percentages.length : null
              return { subjectId, rows, pct }
            }).filter(x => x.rows.length).sort((a,b) => (subjects.find(s => s.id === a.subjectId)?.name || '').localeCompare(subjects.find(s => s.id === b.subjectId)?.name || ''))
            const learnerAverage = bySubject.length ? bySubject.reduce((sum, row) => sum + (row.pct || 0), 0) / bySubject.length : 0
            const attendanceRows = termAttendance.filter(a => a.student_id === learner.id)
            const present = attendanceRows.filter(a => a.status === 'present').length
            const late = attendanceRows.filter(a => a.status === 'late').length
            const absent = attendanceRows.filter(a => a.status === 'absent').length
            const excused = attendanceRows.filter(a => a.status === 'excused').length
            const attendanceDays = attendanceRows.length - excused
            const attendanceRate = attendanceDays > 0 ? (present + late) / attendanceDays * 100 : null
            return <article className="bulk-report-page term-report-page" key={learner.id}>
              <header className="bulk-report-heading">
                <div className="bulk-report-school-brand">
                  {selectedSchool?.logo_url ? <img src={selectedSchool.logo_url} alt="School logo" /> : <div className="bulk-report-logo-placeholder">SCHOOL</div>}
                  <div className="bulk-report-school-identity"><h1>{selectedSchool?.name || 'School Report Form'}</h1>{selectedSchool?.motto && <p className="bulk-report-motto">“{selectedSchool.motto}”</p>}
                    <div className="bulk-report-school-contacts">{selectedSchool?.registration_number && <span><b>School No.:</b> {selectedSchool.registration_number}</span>}{(selectedSchool?.address || selectedSchool?.sub_county || selectedSchool?.county) && <span>{[selectedSchool.address, selectedSchool.sub_county, selectedSchool.county].filter(Boolean).join(', ')}</span>}{selectedSchool?.contact_phone && <span><b>Tel:</b> {selectedSchool.contact_phone}</span>}</div>
                  </div>
                </div>
                <div className="bulk-report-title-band"><span>OFFICIAL ACADEMIC RECORD</span><h2>TERM LEARNER PROGRESS REPORT</h2></div>
              </header>
              <div className="bulk-report-meta"><span><b>Learner:</b> {fullName(learner)}</span><span><b>Admission No.:</b> {learner.admission_number}</span><span><b>Class:</b> {classes.find(c => c.id === learner.class_id)?.name || '—'}</span><span><b>Academic year:</b> {years.find(y => y.id === selectedTerm.academic_year_id)?.name || '—'}</span><span><b>Term:</b> {selectedTerm.name}</span><span><b>Assessments:</b> {termExams.length}</span></div>
              <table className="bulk-report-table"><thead><tr><th>Learning area</th><th>Assessments</th><th>Term average</th><th>CBC level</th><th>Teacher feedback</th></tr></thead><tbody>
                {bySubject.length ? bySubject.map(row => <tr key={row.subjectId}><td>{subjects.find(s => s.id === row.subjectId)?.name || 'Learning area'}</td><td>{row.rows.length}</td><td>{row.pct === null ? '—' : row.pct.toFixed(1) + '%'}</td><td>{row.pct === null ? '—' : grade(row.pct,100)}</td><td>{row.rows.map(r => r.remarks).filter(Boolean).slice(-1)[0] || (row.pct === null ? 'No assessment recorded.' : autoRemark(row.pct,100))}</td></tr>) : <tr><td colSpan={5}>No assessment marks have been recorded for this learner in the selected term.</td></tr>}
              </tbody></table>
              <div className="bulk-report-summary"><span><b>Overall term average:</b> {bySubject.length ? learnerAverage.toFixed(1) + '%' : 'Not assessed'}</span><span><b>Overall CBC level:</b> {bySubject.length ? grade(learnerAverage,100) : '—'}</span><span><b>Assessments:</b> {learnerRows.length}</span></div>
              {bySubject.length > 0 && <section className="term-overall-feedback"><b>OVERALL TEACHER FEEDBACK</b><p>{autoRemark(learnerAverage,100)}</p></section>}
              <section className="term-attendance-summary"><b>TERM ATTENDANCE</b><span>Present: {present}</span><span>Late: {late}</span><span>Absent: {absent}</span><span>Excused: {excused}</span><span>Attendance rate (excluding excused): {attendanceRate === null ? 'No records' : attendanceRate.toFixed(1) + '%'}</span></section>
              <div className="bulk-report-signatures"><span>Class teacher's signature: ____________________</span><span>Headteacher's signature: ____________________</span><span>Parent/Guardian: ____________________</span></div>
              <footer>{selectedSchool?.name || 'School'} · {selectedTerm.name} Learner Progress Report</footer>
            </article>
          })}
        </div>}
      </>}
      {reportMode === 'exam' && <>
      <label className="school-picker">Select examination<select value={selectedExamId} onChange={e => { setSelectedExamId(e.target.value); setSelectedStudentId('') }}><option value="">Select examination</option>{exams.map(ex => <option key={ex.id} value={ex.id}>{ex.name} · {classes.find(c => c.id === ex.class_id)?.name || ''}</option>)}</select></label>
      {selectedExam && <>
        <div className="bulk-report-toolbar">
          <div><b>{classes.find(c => c.id === selectedExam.class_id)?.name || 'Selected class'}</b><span>{examStudents.length} learner{examStudents.length === 1 ? '' : 's'} · {selectedExam.name}</span></div>
          <button className="primary" onClick={printClassReports} disabled={!examStudents.length || !results.length}><Download/> Download all report forms</button>
        </div>
        <p className="muted">All learners in this examination's class will be included. Each report form is formatted to fit on one A4 page. In the print window, choose “Save as PDF” to download one combined file.</p>
        <label className="school-picker">Or select one learner to preview<select value={selectedStudentId} onChange={e => setSelectedStudentId(e.target.value)}><option value="">Select learner</option>{examStudents.map(s => <option key={s.id} value={s.id}>{s.admission_number} · {fullName(s)}</option>)}</select></label>
      </>}
      {selectedExam && examStudents.length > 0 && <div id="bulk-report-print" aria-hidden="true">
        {examStudents.map(learner => {
          const learnerResults = results.filter(r => r.student_id === learner.id).sort((a,b) => (subjects.find(s => s.id === a.subject_id)?.name || '').localeCompare(subjects.find(s => s.id === b.subject_id)?.name || ''))
          const learnerTotal = learnerResults.reduce((sum,r) => sum + Number(r.score), 0)
          const learnerPossible = learnerResults.length * Number(selectedExam.max_score || 0)
          const learnerAverage = learnerPossible ? learnerTotal / learnerPossible * 100 : 0
          const classResults = results.filter(r => examStudents.some(s => s.id === r.student_id))
          const classTotal = classResults.reduce((sum,r) => sum + Number(r.score), 0)
          const classPossible = classResults.length * Number(selectedExam.max_score || 0)
          const classAverage = classPossible ? classTotal / classPossible * 100 : 0
          return <article className="bulk-report-page" key={learner.id}>
            <header className="bulk-report-heading">
              <div className="bulk-report-school-brand">
                {selectedSchool?.logo_url ? <img src={selectedSchool.logo_url} alt="School logo" /> : <div className="bulk-report-logo-placeholder">SCHOOL</div>}
                <div className="bulk-report-school-identity">
                  <h1>{selectedSchool?.name || 'School Report Form'}</h1>
                  {selectedSchool?.motto && <p className="bulk-report-motto">“{selectedSchool.motto}”</p>}
                  <div className="bulk-report-school-contacts">
                    {selectedSchool?.registration_number && <span><b>School No.:</b> {selectedSchool.registration_number}</span>}
                    {(selectedSchool?.address || selectedSchool?.sub_county || selectedSchool?.county) && <span>{[selectedSchool.address, selectedSchool.sub_county, selectedSchool.county].filter(Boolean).join(', ')}</span>}
                    {selectedSchool?.contact_phone && <span><b>Tel:</b> {selectedSchool.contact_phone}</span>}
                    {selectedSchool?.contact_email && <span><b>Email:</b> {selectedSchool.contact_email}</span>}
                  </div>
                </div>
              </div>
              <div className="bulk-report-title-band"><span>OFFICIAL ACADEMIC RECORD</span><h2>LEARNER PROGRESS REPORT</h2></div>
            </header>
            <div className="bulk-report-meta">
              <span><b>Learner:</b> {fullName(learner)}</span><span><b>Admission No.:</b> {learner.admission_number}</span>
              <span><b>Class:</b> {classes.find(c => c.id === learner.class_id)?.name || '—'}</span>
              <span><b>Examination:</b> {selectedExam.name}</span>
              <span><b>Academic year:</b> {years.find(y => y.id === selectedExam.academic_year_id)?.name || '—'}</span>
              <span><b>Term:</b> {terms.find(t => t.id === selectedExam.term_id)?.name || '—'}</span>
            </div>
            <table className="bulk-report-table"><thead><tr><th>Learning area</th><th>Score</th><th>Percentage</th><th>CBC level</th><th>Teacher remarks</th></tr></thead>
              <tbody>{learnerResults.map(r => {
                const subject = subjects.find(s => s.id === r.subject_id)
                const pct = Number(selectedExam.max_score) > 0 ? Number(r.score) / Number(selectedExam.max_score) * 100 : 0
                return <tr key={r.id}><td>{subject?.name || 'Learning area'}</td><td>{r.score} / {selectedExam.max_score}</td><td>{pct.toFixed(1)}%</td><td>{grade(Number(r.score), Number(selectedExam.max_score))}</td><td>{r.remarks || autoRemark(Number(r.score), Number(selectedExam.max_score))}</td></tr>
              })}</tbody>
            </table>
            <div className="bulk-report-summary"><span><b>Total score:</b> {learnerTotal.toFixed(1)}</span><span><b>Learner average:</b> {learnerAverage.toFixed(1)}%</span><span><b>Overall CBC level:</b> {learnerResults.length ? grade(learnerAverage, 100) : '—'}</span></div>
            <section className="report-performance-graph" aria-label="Learner performance compared with class average">
              <b>PERFORMANCE COMPARISON</b>
              <div className="report-performance-row"><span>Learner</span><div className="report-performance-track"><i style={{width: learnerAverage + '%'}} /></div><strong>{learnerAverage.toFixed(1)}%</strong></div>
              <div className="report-performance-row"><span>Class average</span><div className="report-performance-track class"><i style={{width: classAverage + '%'}} /></div><strong>{classAverage.toFixed(1)}%</strong></div>
            </section>
            <section className="report-subject-comparison" aria-label="Subject-by-subject learner and class performance">
          <b>SUBJECT PERFORMANCE · LEARNER VS CLASS AVERAGE</b>
          <div className="report-subject-legend"><span><i className="learner-key" /> Learner</span><span><i className="class-key" /> Class average</span></div>
          <div className="report-subject-chart">
            {reportResults.map(r => {
              const subject = subjects.find(s => s.id === r.subject_id)
              const learnerPct = Number(selectedExam.max_score) > 0 ? Number(r.score) / Number(selectedExam.max_score) * 100 : 0
              const subjectClassResults = results.filter(cr => cr.subject_id === r.subject_id && examStudents.some(es => es.id === cr.student_id))
              const subjectClassAverage = subjectClassResults.length ? subjectClassResults.reduce((sum, cr) => sum + Number(cr.score) / Number(selectedExam.max_score) * 100, 0) / subjectClassResults.length : 0
              return <div className="report-subject-chart-group" key={r.id}>
                <div className="report-subject-chart-values"><strong>{learnerPct.toFixed(0)}%</strong><strong>{subjectClassAverage.toFixed(0)}%</strong></div>
                <div className="report-subject-chart-bars">
                  <div className="report-subject-column"><i className="learner-bar" style={{height: learnerPct + '%'}} /></div>
                  <div className="report-subject-column"><i className="class-bar" style={{height: subjectClassAverage + '%'}} /></div>
                </div>
                <span className="report-subject-chart-label">{subject?.name || 'Learning area'}</span>
              </div>
            })}
          </div>
        </section>
            {learnerResults.length === 0 && <p className="bulk-report-empty">No subject marks have been recorded for this learner.</p>}
            <div className="bulk-report-signatures"><span>Class teacher's signature: ____________________</span><span>Headteacher's signature: ____________________</span><span>Parent/Guardian: ____________________</span></div>
            <footer>{selectedSchool?.name || 'School'} · Learner Progress Report</footer>
          </article>
        })}
      </div>}
      </>}
      {reportMode === 'exam' && student && selectedExam && <div className="panel" id="learner-report-card">
        <div className="panel-heading"><div><p className="kicker">{selectedSchool?.name || 'SCHOOL'} · LEARNER REPORT</p><h2>{fullName(student)}</h2><p className="muted">{student.admission_number} · {classes.find(c => c.id === student.class_id)?.name || ''}</p></div><button className="secondary" onClick={printIndividualReport}><Printer/> Print report card</button></div>
        <h3>{selectedExam.name}</h3>
        <div className="table-wrap"><table><thead><tr><th>Learning area</th><th>Score</th><th>Percentage</th><th>CBC achievement level</th><th>Teacher remarks</th></tr></thead><tbody>{reportResults.map(r => { const sub = subjects.find(x => x.id === r.subject_id); const pct = Number(r.score) / Number(selectedExam.max_score) * 100; return <tr key={r.id}><td>{sub?.name || 'Subject'}</td><td>{r.score} / {selectedExam.max_score}</td><td>{pct.toFixed(1)}%</td><td>{grade(Number(r.score),Number(selectedExam.max_score))}</td><td>{r.remarks || autoRemark(Number(r.score), Number(selectedExam.max_score))}</td></tr> })}</tbody></table></div>
        <div className="stats"><article className="panel"><span>Total score</span><b>{total.toFixed(1)}</b></article><article className="panel"><span>Average</span><b>{average.toFixed(1)}%</b></article><article className="panel"><span>Overall CBC level</span><b>{reportResults.length ? grade(average,100) : '—'}</b></article></div>
        <section className="report-performance-graph" aria-label="Learner performance compared with class average">
          <b>PERFORMANCE COMPARISON</b>
          <div className="report-performance-row"><span>Learner</span><div className="report-performance-track"><i style={{width: average + '%'}} /></div><strong>{average.toFixed(1)}%</strong></div>
          <div className="report-performance-row"><span>Class average</span><div className="report-performance-track class"><i style={{width: reportClassAverage + '%'}} /></div><strong>{reportClassAverage.toFixed(1)}%</strong></div>
        </section>
        <section className="report-subject-comparison" aria-label="Subject-by-subject learner and class performance">
          <b>SUBJECT PERFORMANCE · LEARNER VS CLASS AVERAGE</b>
          {reportResults.map(r => {
            const subject = subjects.find(s => s.id === r.subject_id)
            const learnerPct = Number(selectedExam.max_score) > 0 ? Number(r.score) / Number(selectedExam.max_score) * 100 : 0
            const subjectClassResults = results.filter(cr => cr.subject_id === r.subject_id && examStudents.some(es => es.id === cr.student_id))
            const subjectClassAverage = subjectClassResults.length ? subjectClassResults.reduce((sum, cr) => sum + Number(cr.score) / Number(selectedExam.max_score) * 100, 0) / subjectClassResults.length : 0
            return <div className="report-subject-row" key={r.id}>
              <span className="report-subject-name">{subject?.name || 'Learning area'}</span>
              <div className="report-subject-bars">
                <div className="report-performance-row"><span>Learner</span><div className="report-performance-track"><i style={{width: learnerPct + '%'}} /></div><strong>{learnerPct.toFixed(1)}%</strong></div>
                <div className="report-performance-row"><span>Class avg.</span><div className="report-performance-track class"><i style={{width: subjectClassAverage + '%'}} /></div><strong>{subjectClassAverage.toFixed(1)}%</strong></div>
              </div>
            </div>
          })}
        </section>
        <footer className="document-developer-footer">Powered by Smart Minds · Developed by Eugene Media Graphix · 0757783275 · eugeneaswani6@gmail.com</footer>
        {reportResults.length === 0 && <p className="muted">No subject marks have been recorded for this learner yet.</p>}
      </div>}
    </>}
    {tab !== 'exams' && (!exams.length || !subjects.length || !students.length) && <p className="muted">To use assessments, set up academic years, classes, subjects and register learners first.</p>}
  </section>
}
