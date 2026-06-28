import { useState, useRef, useEffect } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import Login from './components/Login.jsx'
import Viewer from './components/Viewer.jsx'
import Projects from './components/Projects.jsx'

const TITLE = 'MESHGIT'

export default function App() {
  const { user, token, logout } = useAuth()
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [typed, setTyped] = useState('')
  const [selectedProject, setSelectedProject] = useState(null)
  const [committing, setCommitting] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [commitError, setCommitError] = useState(null)
  const inputRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      i++
      setTyped(TITLE.slice(0, i))
      if (i === TITLE.length) clearInterval(interval)
    }, 100)
    return () => clearInterval(interval)
  }, [])

  const handleFile = (f) => {
    if (f?.name.toLowerCase().endsWith('.stl')) {
      setFile(f)
      fileRef.current = f
      setCommitError(null)
    }
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const pushCommit = async () => {
    if (!file || !selectedProject) return
    setCommitting(true)
    setCommitError(null)
    const form = new FormData()
    form.append('file', file)
    form.append('project_id', selectedProject.id)
    form.append('message', commitMsg.trim() || file.name)
    const r = await fetch('/api/commits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    setCommitting(false)
    if (r.ok) {
      setCommitMsg('')
      setSelectedProject((p) => p ? { ...p, commit_count: (p.commit_count || 0) + 1 } : p)
    } else {
      const body = await r.json().catch(() => ({}))
      setCommitError(body.error || body.detail || 'Commit failed')
    }
  }

  if (user === undefined) return null
  if (user === null) return <Login />

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">{typed}<span className="cursor">|</span></span>
        <div className="topbar-meta">
          <span className="status-dot" />
          <span>@{user.githubUsername}</span>
          <span style={{ color: 'var(--border)', userSelect: 'none' }}>·</span>
          <button
            onClick={logout}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.7rem', letterSpacing: '0.1em', padding: 0, fontFamily: 'var(--mono)' }}
          >
            logout
          </button>
        </div>
      </header>

      <div className="app-body">
        <Projects
          token={token}
          selectedProject={selectedProject}
          onSelect={setSelectedProject}
        />

        <div className="app-main">
          <div
            className={`dropbar${dragging ? ' active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <span className="prompt">&gt;_</span>
            <span className={`drop-label${file ? ' loaded' : ''}`}>
              {file ? file.name : 'DROP .STL FILE HERE'}
            </span>
            <button className="browse-btn" onClick={() => inputRef.current.click()}>
              {file ? '[ REPLACE ]' : '[ BROWSE ]'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".stl"
              style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])}
            />

            {file && selectedProject && (
              <>
                <input
                  className="commit-msg-input"
                  placeholder="commit message (optional)"
                  value={commitMsg}
                  onChange={(e) => setCommitMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && pushCommit()}
                />
                <button
                  className="browse-btn commit-btn"
                  onClick={pushCommit}
                  disabled={committing}
                >
                  {committing ? '[ ... ]' : `[ COMMIT → ${selectedProject.name.toUpperCase()} ]`}
                </button>
              </>
            )}
          </div>

          {commitError && <div className="commit-error">{commitError}</div>}

          <div className="viewport">
            <Viewer file={file} />
          </div>
        </div>
      </div>
    </div>
  )
}
