import { useEffect, useState, type FormEvent } from 'react'
import { Plus, RefreshCw, BookOpen, XCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string; status: string }
type Row = Record<string, any> & { id: string }
type Tab = 'years' | 'terms' | 'classes' | 'streams' | 'subjects'
const config: Record<Tab, { table: string; title: string; fields: { key: string; label: string; type?: string; options?: { value: string; label: string }[]; required?: boolean }[]; columns: string[] }> = {
  years: { table: 'academic_years', title: 'Academic years', fields: [{key:'name',label:'Academic year name',required:true},{key:'start_date',label:'Start date',type:'date',required:true},{key:'end_date',label:'End date',type:'date',required:true}], columns:['name','start_date','end_date'] },
  terms: { table: 'terms', title: 'Terms', fields: [{key:'academic_year_id',label:'Academic year',type:'year',required:true},{key:'name',label:'Term name',required:true},{key:'start_date',label:'Start date',type:'date',required:true},{key:'end_date',label:'End date',type:'date',required:true}], columns:['name','start_date','end_date'] },
  classes: { table: 'classes', title: 'Classes', fields: [{key:'name',label:'Class name',required:true},{key:'level',label:'Education level',type:'select',options:[{value:'pre_primary',label:'Pre-primary'},{value:'primary',label:'Primary'},{value:'junior_secondary',label:'Junior secondary'},{value:'senior_secondary',label:'Senior secondary'}],required:true},{key:'sort_order',label:'Display order',type:'number'}], columns:['name','level','sort_order'] },
  streams: { table: 'streams', title: 'Streams', fields: [{key:'class_id',label:'Class',type:'class',required:true},{key:'name',label:'Stream name',required:true}], columns:['name','class_id'] },
  subjects: { table: 'subjects', title: 'Subjects', fields: [{key:'name',label:'Subject name',required:true},{key:'code',label:'Subject code'},{key:'category',label:'Category',type:'select',options:[{value:'core',label:'Core'},{value:'optional',label:'Optional'},{value:'co_curricular',label:'Co-curricular'}],required:true}], columns:['name','code','category'] },
}
export default function AcademicManager({ schools }: { schools: School[] }) {
  const [schoolId, setSchoolId] = useState('')
  const [tab, setTab] = useState<Tab>('years')
  const [rows, setRows] = useState<Row[]>([])
  const [years, setYears] = useState<Row[]>([])
  const [classes, setClasses] = useState<Row[]>([])
  const [form, setForm] = useState<Record<string,string>>({})
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => { if (!schoolId && schools.length) setSchoolId(schools.find(s=>s.status==='approved')?.id || schools[0].id) }, [schools, schoolId])
  useEffect(() => { if (schoolId) void loadSupporting() }, [schoolId])
  useEffect(() => { if (schoolId) void loadRows() }, [schoolId, tab])
  async function loadSupporting() {
    const [y,c] = await Promise.all([supabase.from('academic_years').select('id,name').eq('school_id',schoolId).order('start_date'),supabase.from('classes').select('id,name').eq('school_id',schoolId).order('sort_order')])
    setYears((y.data || []) as Row[]); setClasses((c.data || []) as Row[])
  }
  async function loadRows() {
    setError('')
    const {data,error} = await supabase.from(config[tab].table).select('*').eq('school_id',schoolId).order('created_at',{ascending:false})
    if (error) setError(error.message); else setRows((data || []) as Row[])
  }
  async function save(e: FormEvent) {
    e.preventDefault(); if (!schoolId) return
    setBusy(true); setError(''); setNotice('')
    const payload = { ...form, school_id: schoolId }
    if (tab === 'classes') payload.sort_order = form.sort_order || '0'
    const {error} = await supabase.from(config[tab].table).insert(payload)
    if (error) setError(error.message)
    else { setNotice(config[tab].title.slice(0,-1) + ' saved successfully.'); setForm({}); setAdding(false); await loadRows(); await loadSupporting() }
    setBusy(false)
  }
  async function remove(id: string) {
    if (!window.confirm('Delete this record? Related records may also be deleted.')) return
    const {error} = await supabase.from(config[tab].table).delete().eq('id',id).eq('school_id',schoolId)
    if (error) setError(error.message); else { setNotice('Record deleted.'); await loadRows(); await loadSupporting() }
  }
  const current = config[tab]
  function display(row: Row, col: string) {
    if (col === 'class_id') return classes.find(c=>c.id===row[col])?.name || '—'
    if (col === 'academic_year_id') return years.find(y=>y.id===row[col])?.name || '—'
    return String(row[col] ?? '—').replaceAll('_',' ')
  }
  return <section className="panel academic-panel">
    <div className="academic-head"><div><p className="kicker">SCHOOL SETUP</p><h2>Academic structure</h2><p className="muted">Set up the academic calendar, classes and subjects for each school.</p></div><button className="secondary" onClick={()=>void loadRows()}><RefreshCw/> Refresh</button></div>
    <label className="school-picker">Select school<select value={schoolId} onChange={e=>{setSchoolId(e.target.value);setAdding(false)}}>{schools.map(s=><option key={s.id} value={s.id}>{s.name} · {s.status}</option>)}</select></label>
    <div className="academic-tabs">{(Object.keys(config) as Tab[]).map(t=><button key={t} className={tab===t?'selected':''} onClick={()=>{setTab(t);setAdding(false);setForm({})}}>{config[t].title}</button>)}</div>
    <div className="panel-heading"><h2>{current.title}</h2><button className="primary" disabled={!schoolId} onClick={()=>setAdding(!adding)}><Plus/> Add {current.title.replace(/s$/,'')}</button></div>
    {adding && <form className="academic-form" onSubmit={save}>{current.fields.map(f=><label key={f.key}>{f.label}{f.type==='year'?<select required value={form[f.key]||''} onChange={e=>setForm({...form,[f.key]:e.target.value})}><option value="">Choose academic year</option>{years.map(y=><option key={y.id} value={y.id}>{y.name}</option>)}</select>:f.type==='class'?<select required value={form[f.key]||''} onChange={e=>setForm({...form,[f.key]:e.target.value})}><option value="">Choose class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>:f.type==='select'?<select required={f.required} value={form[f.key]||f.options?.[0]?.value||''} onChange={e=>setForm({...form,[f.key]:e.target.value})}>{f.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<input required={f.required} type={f.type||'text'} value={form[f.key]||''} onChange={e=>setForm({...form,[f.key]:e.target.value})}/>}</label>)}<div className="academic-form-actions"><button type="button" className="secondary" onClick={()=>setAdding(false)}>Cancel</button><button className="primary" disabled={busy}>{busy?'Saving…':'Save record'}</button></div></form>}
    {error&&<p className="alert error"><XCircle/>{error}</p>}{notice&&<p className="alert success"><CheckCircle2/>{notice}</p>}
    {rows.length===0?<div className="empty"><BookOpen/><h3>No {current.title.toLowerCase()} yet</h3><p>Add your first record using the button above.</p></div>:<div className="table-wrap"><table><thead><tr>{current.columns.map(c=><th key={c}>{c.replaceAll('_',' ')}</th>)}<th>Action</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}>{current.columns.map(c=><td key={c}>{display(row,c)}</td>)}<td><button className="delete-row" onClick={()=>void remove(row.id)}>Delete</button></td></tr>)}</tbody></table></div>}
  </section>
}
