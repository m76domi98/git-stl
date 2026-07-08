import { useState, useRef, useEffect } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import Login from './components/Login.jsx'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './components/Dashboard.jsx'
import ModelViewer from './components/ModelViewer.jsx'

export default function App() {
  const { user, token, logout } = useAuth()
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [selectedProject, setSelectedProject] = useState(null)
  const [committing, setCommitting] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [commitError, setCommitError] = useState(null)
  const [historyKey, setHistoryKey] = useState(0)
  const [commits, setCommits] = useState([])
  const [view, setView] = useState('dashboard') // 'dashboard' | 'viewer'
  const [viewerFile, setViewerFile] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!selectedProject) return setCommits([])
    fetch(`/api/commits?project_id=${selectedProject.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.ok ? r.json() : []).then(setCommits)
  }, [token, selectedProject, historyKey])

  const handleFile = (f) => {
    if (f?.name.toLowerCase().endsWith('.stl')) {
      setFile(f)
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
      setFile(null)
      setCommitMsg('')
      setSelectedProject((p) => p ? { ...p, commit_count: (p.commit_count || 0) + 1 } : p)
      setHistoryKey((k) => k + 1)
    } else {
      const body = await r.json().catch(() => ({}))
      setCommitError(body.error || body.detail || 'Commit failed')
    }
  }

  const selectProject = (p) => {
    setSelectedProject(p)
    setFile(null)
    setView('dashboard')
  }

  const openViewer = (f) => {
    setViewerFile(f)
    setView('viewer')
  }

  if (user === undefined) return null
  if (user === null) return <Login />

  return (
    <div className="app">
      <Sidebar
        token={token}
        user={user}
        logout={logout}
        selectedProject={selectedProject}
        onSelect={selectProject}
      />

      <div className="app-main">
        {!selectedProject && <div className="project-empty" style={{ padding: 24 }}>Select or create a project to get started</div>}

        {selectedProject && view === 'dashboard' && (
          <Dashboard
            token={token}
            project={selectedProject}
            commits={commits}
            file={file}
            dragging={dragging}
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onUploadClick={() => inputRef.current.click()}
            commitMsg={commitMsg}
            setCommitMsg={setCommitMsg}
            pushCommit={pushCommit}
            committing={committing}
            commitError={commitError}
            onOpenViewer={openViewer}
          />
        )}

        {selectedProject && view === 'viewer' && (
          <ModelViewer file={viewerFile} onBack={() => setView('dashboard')} />
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".stl"
          style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>
    </div>
  )
}
