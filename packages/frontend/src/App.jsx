import { useState, useRef } from 'react'
import Viewer from './components/Viewer.jsx'

export default function App() {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFile = (f) => {
    if (f?.name.toLowerCase().endsWith('.stl')) setFile(f)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">MESHGIT</span>
        <div className="topbar-meta">
          <span className="status-dot" />
          <span>v0.1.0 // {file ? 'MESH LOADED' : 'READY'}</span>
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
