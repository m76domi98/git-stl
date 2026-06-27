import { useState, useRef, useEffect } from 'react'
import { useAuth } from './context/AuthContext.jsx'
import Login from './components/Login.jsx'
import Viewer from './components/Viewer.jsx'

const TITLE = 'MESHGIT'

export default function App() {
  const { user, logout } = useAuth()
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [typed, setTyped] = useState('')
  const inputRef = useRef(null)

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
    if (f?.name.toLowerCase().endsWith('.stl')) setFile(f)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  // Still loading auth state
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
      </div>

      <div className="viewport">
        <Viewer file={file} />
      </div>
    </div>
  )
}
