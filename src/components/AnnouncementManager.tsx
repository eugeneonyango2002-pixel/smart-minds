import { useEffect, useState, type FormEvent } from 'react'
import { Bell, Plus, RefreshCw, Trash2, XCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type School = { id: string; name: string }
type Announcement = { id: string; school_id: string; title: string; message: string; status: 'draft' | 'published'; publish_at: string; created_at: string }

export default function AnnouncementManager({ schools }: { schools: School[] }) {
  const [schoolId, setSchoolId] = useState('')
  const [items, setItems] = useState<Announcement[]>([])
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('published')
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!schoolId && schools.length) setSchoolId(schools[0].id)
  }, [schools, schoolId])

  useEffect(() => { if (schoolId) void load() }, [schoolId])

  async function load() {
    setError('')
    const { data, error } = await supabase.from('school_announcements').select('*').eq('school_id', schoolId).order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setItems((data || []) as Announcement[])
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setNotice('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('school_announcements').insert({
      school_id: schoolId, title: title.trim(), message: message.trim(), status,
      publish_at: new Date().toISOString(), created_by: user?.id || null
    })
    if (error) setError(error.message)
    else {
      setNotice(status === 'published' ? 'Announcement published for parents.' : 'Draft saved.')
      setTitle(''); setMessage(''); setStatus('published'); setShowForm(false); await load()
    }
    setBusy(false)
  }

  async function changeStatus(item: Announcement) {
    setBusy(true); setError(''); setNotice('')
    const next = item.status === 'published' ? 'draft' : 'published'
    const { error } = await supabase.from('school_announcements').update({ status: next, publish_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', item.id)
    if (error) setError(error.message)
    else { setNotice(next === 'published' ? 'Announcement published.' : 'Announcement moved to drafts.'); await load() }
    setBusy(false)
  }

  async function remove(item: Announcement) {
    if (!window.confirm('Delete this announcement permanently?')) return
    setBusy(true); setError(''); setNotice('')
    const { error } = await supabase.from('school_announcements').delete().eq('id', item.id)
    if (error) setError(error.message)
    else { setNotice('Announcement deleted.'); await load() }
    setBusy(false)
  }

  return <section className="panel announcement-manager">
    <div className="academic-head"><div><p className="kicker">SCHOOL COMMUNICATION</p><h2>Announcements</h2><p className="muted">Share school notices, reminders and important updates with linked parents.</p></div><button className="secondary" onClick={() => void load()}><RefreshCw /> Refresh</button></div>
    <label className="school-picker">Select school<select value={schoolId} onChange={e => setSchoolId(e.target.value)}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {error && <p className="alert error"><XCircle />{error}</p>}
    {notice && <p className="alert success"><CheckCircle2 />{notice}</p>}
    <div className="student-toolbar"><span>{items.length} announcements</span><button className="primary" onClick={() => setShowForm(!showForm)}><Plus /> New announcement</button></div>
    {showForm && <form className="student-form" onSubmit={save}>
      <h3>New school announcement</h3>
      <label className="wide">Title *<input required minLength={3} maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Opening day reminder" /></label>
      <label className="wide">Message *<textarea required minLength={3} maxLength={10000} rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder="Write the announcement for parents…" /></label>
      <label>Visibility<select value={status} onChange={e => setStatus(e.target.value as 'draft' | 'published')}><option value="published">Publish immediately</option><option value="draft">Save as draft</option></select></label>
      <div className="academic-form-actions"><button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="primary" disabled={busy || !schoolId}>{busy ? 'Saving…' : status === 'published' ? 'Publish announcement' : 'Save draft'}</button></div>
    </form>}
    {items.length === 0 ? <div className="empty"><Bell /><h3>No announcements yet</h3><p>New school announcements will appear here.</p></div> : <div className="announcement-list">{items.map(item => <article className="announcement-item" key={item.id}><div><div className="announcement-meta"><span className={'status ' + item.status}>{item.status}</span><small>{new Date(item.created_at).toLocaleString('en-KE')}</small></div><h3>{item.title}</h3><p>{item.message}</p></div><div className="announcement-actions"><button className="secondary" disabled={busy} onClick={() => void changeStatus(item)}>{item.status === 'published' ? 'Move to draft' : 'Publish'}</button><button className="secondary" disabled={busy} onClick={() => void remove(item)} aria-label="Delete announcement"><Trash2 /></button></div></article>)}</div>}
  </section>
}
