import { useState, useEffect } from 'react'
import Viewer from './Viewer.jsx'
import { formatBytes, relativeTime } from '../lib/format.js'

export default function ModelViewer({ file, commits = [], token, initialCommitId = null, onBack }) {
  const [modelStats, setModelStats] = useState(null)
  const [commitId, setCommitId] = useState(initialCommitId || '')
  const [commitBlob, setCommitBlob] = useState(null)

  const commit = commits.find((c) => c.id === commitId)

  useEffect(() => {
    if (!commitId) return setCommitBlob(null)
    if (commitId === initialCommitId && file) return setCommitBlob(file)
    let stale = false
    setCommitBlob(null)
    fetch(`/api/commits/${commitId}/file`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => { if (!stale) setCommitBlob(b) })
    return () => { stale = true }
  }, [token, commitId, initialCommitId, file])

  const displayFile = commitId ? commitBlob : file

  const downloadStl = () => {
    const url = URL.createObjectURL(displayFile)
    const a = document.createElement('a')
    a.href = url
    a.download = `${commit ? commit.id.slice(0, 7) : 'model'}.stl`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="dashboard viewer-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn back-btn" onClick={onBack}>← Back to overview</button>
        {commits.length > 0 && (
          <select
            className="commit-msg-input"
            value={commitId}
            onChange={(e) => setCommitId(e.target.value)}
          >
            {!initialCommitId && file && <option value="">Uncommitted upload</option>}
            {commits.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id.slice(0, 7)} — {c.message || '(no message)'}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="card viewport-card">
        <div className="viewport">
          <Viewer file={displayFile} onLoad={setModelStats} full />
        </div>
        {(modelStats || commit) && (
          <div className="model-info">
            <div className="model-info-title">Model Info</div>
            {commit && (
              <>
                <div className="model-info-row"><span>Commit</span><span>{commit.id.slice(0, 7)}</span></div>
                <div className="model-info-row"><span>Author</span><span>{commit.author}</span></div>
                <div className="model-info-row"><span>When</span><span>{relativeTime(commit.created_at)}</span></div>
              </>
            )}
            {modelStats && (
              <>
                <div className="model-info-row"><span>Vertices</span><span>{modelStats.vertices.toLocaleString()}</span></div>
                <div className="model-info-row"><span>Faces</span><span>{modelStats.faces.toLocaleString()}</span></div>
                {displayFile?.size != null && <div className="model-info-row"><span>Size</span><span>{formatBytes(displayFile.size)}</span></div>}
                <div className="model-info-row"><span>Format</span><span>STL</span></div>
              </>
            )}
            <div className="model-actions">
              <div className="model-info-title" style={{ marginTop: 20 }}>Actions</div>
              <button className="btn" disabled title="Visual diffing lands in Weeks 5–6">⧉ View Changes</button>
              <button className="btn" disabled title="Branching lands in Weeks 7–8">⑂ Create Branch</button>
              <button className="btn" onClick={downloadStl} disabled={!displayFile}>⭳ Download STL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
