import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Wallet, Plus, RefreshCw, Search, XCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string }
type Row = { id: string; name: string }
type Student = { id: string; admission_number: string; first_name: string; middle_name: string | null; last_name: string; class_id: string | null; status: string }
type Fee = { id: string; class_id: string; academic_year_id: string; term_id: string | null; item_name: string; amount_kes: number; due_date: string | null }
type Payment = { id: string; student_id: string; fee_structure_id: string; amount_kes: number; payment_method: string; transaction_reference: string | null; payment_date: string; created_at: string }
const today = () => new Date().toLocaleDateString('en-CA')
const blankCharge = { class_id:'', academic_year_id:'', term_id:'', item_name:'Tuition fees', amount_kes:'', due_date:'' }
const blankPayment = { student_id:'', fee_structure_id:'', amount_kes:'', payment_method:'mpesa', transaction_reference:'', payment_date:today(), notes:'' }

export default function FeesManager({ schools }: { schools: School[] }) {
  const [schoolId,setSchoolId]=useState('')
  const [students,setStudents]=useState<Student[]>([])
  const [classes,setClasses]=useState<Row[]>([])
  const [years,setYears]=useState<Row[]>([])
  const [terms,setTerms]=useState<(Row & {academic_year_id:string})[]>([])
  const [fees,setFees]=useState<Fee[]>([])
  const [payments,setPayments]=useState<Payment[]>([])
  const [charge,setCharge]=useState(blankCharge)
  const [payment,setPayment]=useState(blankPayment)
  const [addingCharge,setAddingCharge]=useState(false)
  const [addingPayment,setAddingPayment]=useState(false)
  const [search,setSearch]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  useEffect(()=>{if(!schoolId&&schools.length)setSchoolId(schools.find(s=>(s as any).status==='approved')?.id||schools[0].id)},[schools,schoolId])
  useEffect(()=>{if(schoolId)void load()},[schoolId])
  async function load(){
    setError('')
    const [s,c,y,t,f,p]=await Promise.all([
      supabase.from('students').select('id,admission_number,first_name,middle_name,last_name,class_id,status').eq('school_id',schoolId).eq('status','active').order('first_name'),
      supabase.from('classes').select('id,name').eq('school_id',schoolId).order('sort_order'),
      supabase.from('academic_years').select('id,name').eq('school_id',schoolId).order('start_date',{ascending:false}),
      supabase.from('terms').select('id,name,academic_year_id').eq('school_id',schoolId).order('start_date'),
      supabase.from('fee_structures').select('*').eq('school_id',schoolId).order('created_at',{ascending:false}),
      supabase.from('fee_payments').select('*').eq('school_id',schoolId).order('payment_date',{ascending:false}).limit(100)
    ])
    for(const result of [s,c,y,t,f,p]) if(result.error){setError(result.error.message);return}
    setStudents((s.data||[]) as Student[]);setClasses((c.data||[]) as Row[]);setYears((y.data||[]) as Row[])
    setTerms((t.data||[]) as (Row & {academic_year_id:string})[]);setFees((f.data||[]) as Fee[]);setPayments((p.data||[]) as Payment[])
  }
  const visiblePayments=useMemo(()=>payments.filter(p=>{
    const student=students.find(s=>s.id===p.student_id)
    const label=student ? student.first_name+' '+student.last_name+' '+student.admission_number : ''
    return label.toLowerCase().includes(search.toLowerCase()) || (p.transaction_reference||'').toLowerCase().includes(search.toLowerCase())
  }),[payments,students,search])
  const selectedFee=fees.find(f=>f.id===payment.fee_structure_id)
  const selectedStudent=students.find(s=>s.id===payment.student_id)
  const studentFees=selectedStudent ? fees.filter(f=>f.class_id===selectedStudent.class_id) : []
  const paidForSelected=selectedStudent && selectedFee ? payments.filter(p=>p.student_id===selectedStudent.id&&p.fee_structure_id===selectedFee.id).reduce((sum,p)=>sum+Number(p.amount_kes),0) : 0
  const balance=selectedFee ? Math.max(0,Number(selectedFee.amount_kes)-paidForSelected) : 0
  async function saveCharge(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');setNotice('')
    const {error}=await supabase.from('fee_structures').insert({school_id:schoolId,class_id:charge.class_id,academic_year_id:charge.academic_year_id,term_id:charge.term_id||null,item_name:charge.item_name,amount_kes:Number(charge.amount_kes),due_date:charge.due_date||null})
    if(error)setError(error.message);else{setNotice('Fee charge created successfully.');setCharge(blankCharge);setAddingCharge(false);await load()}
    setBusy(false)
  }
  async function savePayment(e:FormEvent){
    e.preventDefault();if(!selectedStudent||!selectedFee)return
    if(Number(payment.amount_kes)>balance){setError('The payment is greater than the remaining balance for this fee item.');return}
    setBusy(true);setError('');setNotice('')
    const {data:{user}}=await supabase.auth.getUser()
    const {error}=await supabase.from('fee_payments').insert({school_id:schoolId,student_id:payment.student_id,fee_structure_id:payment.fee_structure_id,amount_kes:Number(payment.amount_kes),payment_method:payment.payment_method,transaction_reference:payment.transaction_reference||null,payment_date:payment.payment_date,notes:payment.notes||null,received_by:user?.id||null})
    if(error)setError(error.message);else{setNotice('Payment recorded successfully.');setPayment({...blankPayment,payment_date:today()});setAddingPayment(false);await load()}
    setBusy(false)
  }
  const totalCollected=payments.reduce((sum,p)=>sum+Number(p.amount_kes),0)
  return <section className="panel fees-panel">
    <div className="academic-head"><div><p className="kicker">SCHOOL FINANCE</p><h2>Fees management</h2><p className="muted">Set class fee charges, record learner payments and track balances.</p></div><button className="secondary" onClick={()=>void load()}><RefreshCw/> Refresh</button></div>
    <label className="school-picker">Select school<select value={schoolId} onChange={e=>{setSchoolId(e.target.value);setAddingCharge(false);setAddingPayment(false)}}>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {error&&<p className="alert error"><XCircle/>{error}</p>}{notice&&<p className="alert success"><CheckCircle2/>{notice}</p>}
    <div className="stats fees-stats"><article className="panel"><Wallet/><span>Total recorded payments</span><b>KES {totalCollected.toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2})}</b></article><article className="panel"><span>Fee items</span><b>{fees.length}</b></article><article className="panel"><span>Payment records</span><b>{payments.length}</b></article></div>
    <div className="student-toolbar"><div className="student-search"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search learner or transaction reference"/></div><div className="fees-actions"><button className="secondary" onClick={()=>{setAddingCharge(!addingCharge);setAddingPayment(false);setError('')}}><Plus/> Set fee charge</button><button className="primary" onClick={()=>{setAddingPayment(!addingPayment);setAddingCharge(false);setError('')}}><Plus/> Record payment</button></div></div>
    {addingCharge&&<form className="student-form" onSubmit={saveCharge}><h3>New class fee charge</h3>
      <label>Class *<select required value={charge.class_id} onChange={e=>setCharge({...charge,class_id:e.target.value})}><option value="">Select class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Academic year *<select required value={charge.academic_year_id} onChange={e=>setCharge({...charge,academic_year_id:e.target.value,term_id:''})}><option value="">Select year</option>{years.map(y=><option key={y.id} value={y.id}>{y.name}</option>)}</select></label>
      <label>Term<select value={charge.term_id} onChange={e=>setCharge({...charge,term_id:e.target.value})}><option value="">All terms / annual</option>{terms.filter(t=>t.academic_year_id===charge.academic_year_id).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label>Fee description *<input required value={charge.item_name} onChange={e=>setCharge({...charge,item_name:e.target.value})}/></label>
      <label>Amount (KES) *<input required type="number" min="1" step="0.01" value={charge.amount_kes} onChange={e=>setCharge({...charge,amount_kes:e.target.value})}/></label>
      <label>Due date<input type="date" value={charge.due_date} onChange={e=>setCharge({...charge,due_date:e.target.value})}/></label>
      <div className="academic-form-actions"><button type="button" className="secondary" onClick={()=>setAddingCharge(false)}>Cancel</button><button className="primary" disabled={busy||!schoolId}>{busy?'Saving…':'Save fee charge'}</button></div>
    </form>}
    {addingPayment&&<form className="student-form" onSubmit={savePayment}><h3>Record learner payment</h3>
      <label>Student *<select required value={payment.student_id} onChange={e=>setPayment({...payment,student_id:e.target.value,fee_structure_id:''})}><option value="">Select learner</option>{students.map(s=><option key={s.id} value={s.id}>{s.admission_number} — {s.first_name} {s.last_name}</option>)}</select></label>
      <label>Fee item *<select required value={payment.fee_structure_id} onChange={e=>setPayment({...payment,fee_structure_id:e.target.value})}><option value="">Select fee item</option>{studentFees.map(f=><option key={f.id} value={f.id}>{f.item_name} — KES {Number(f.amount_kes).toLocaleString('en-KE')}</option>)}</select></label>
      {selectedFee&&<p className="wide fees-balance">Fee: KES {Number(selectedFee.amount_kes).toLocaleString('en-KE')} · Paid: KES {paidForSelected.toLocaleString('en-KE')} · Balance: <b>KES {balance.toLocaleString('en-KE')}</b></p>}
      <label>Amount received (KES) *<input required type="number" min="0.01" max={balance} step="0.01" value={payment.amount_kes} onChange={e=>setPayment({...payment,amount_kes:e.target.value})}/></label>
      <label>Payment method *<select value={payment.payment_method} onChange={e=>setPayment({...payment,payment_method:e.target.value})}><option value="mpesa">M-Pesa</option><option value="cash">Cash</option><option value="bank">Bank transfer</option><option value="cheque">Cheque</option><option value="other">Other</option></select></label>
      <label>Transaction / receipt reference<input value={payment.transaction_reference} onChange={e=>setPayment({...payment,transaction_reference:e.target.value})}/></label>
      <label>Payment date *<input required type="date" value={payment.payment_date} onChange={e=>setPayment({...payment,payment_date:e.target.value})}/></label>
      <label className="wide">Notes<input value={payment.notes} onChange={e=>setPayment({...payment,notes:e.target.value})}/></label>
      <div className="academic-form-actions"><button type="button" className="secondary" onClick={()=>setAddingPayment(false)}>Cancel</button><button className="primary" disabled={busy||!selectedFee||!selectedStudent||balance<=0}>{busy?'Saving…':'Save payment'}</button></div>
    </form>}
    <div className="panel-heading"><h2>Recent payments</h2><span>{visiblePayments.length} records shown</span></div>
    {visiblePayments.length===0?<div className="empty"><Wallet/><h3>No payments found</h3><p>Recorded learner payments will appear here.</p></div>:<div className="table-wrap"><table><thead><tr><th>Date</th><th>Student</th><th>Fee item</th><th>Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>{visiblePayments.map(p=>{const s=students.find(x=>x.id===p.student_id);const f=fees.find(x=>x.id===p.fee_structure_id);return <tr key={p.id}><td>{p.payment_date}</td><td><b>{s? s.first_name+' '+s.last_name:'Learner'}</b><small>{s?.admission_number||''}</small></td><td>{f?.item_name||'Fee item'}</td><td><b>KES {Number(p.amount_kes).toLocaleString('en-KE',{minimumFractionDigits:2})}</b></td><td>{p.payment_method.toUpperCase()}</td><td>{p.transaction_reference||'—'}</td></tr>})}</tbody></table></div>}
  </section>
}
