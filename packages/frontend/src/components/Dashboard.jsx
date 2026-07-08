import { useState, useEffect } from 'react'
import Viewer from './Viewer.jsx'
import MeshLoader from './MeshLoader.jsx'
import { formatBytes, relativeTime, dayLabel } from '../lib/format.js'

function groupByDay(commits) {
  const items = []
  let lastLabel = null
  for (const c of commits) {
    const label = dayLabel(c.created_at)
    if (label !== lastLabel) {
      items.push({ type: 'heading', key: label, label })
      lastLabel = label
    }
    items.push({ type: 'commit', key: c.id, ...c })
  }
  return items
}

export default function Dashboard({
  token, project, commits, file, dragging, onDrop, onDragOver, onDragLeave,
  onUploadClick, commitMsg, setCommitMsg, pushCommit, committing, commitError, onOpenViewer,
}) {
  const [latestBlob, setLatestBlob] = useState(null)
  const [fetchingThumb, setFetchingThumb] = useState(false)
  const latestId = commits[0]?.id

  useEffect(() => {
    setLatestBlob(null)
    if (!latestId) return
    setFetchingThumb(true)
    fetch(`/api/commits/${latestId}/file`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.blob() : null)
      .then((b) => { setLatestBlob(b); setFetchingThumb(false) })
  }, [token, latestId])

  const previewFile = file || latestBlob

  return (
    <div
      className="dashboard"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="card">
        <div className="project-header">
          <div>
            <div className="project-header-title">{project.name}</div>
            {project.description && <div className="project-header-sub">{project.description}</div>}
          </div>
          <div className="project-header-actions">
            <button className="btn btn-primary" onClick={pushCommit} disabled={!file || committing}>
              ★ {committing ? 'Committing…' : 'New Commit'}
            </button>
            <button className="btn" onClick={onUploadClick}>⭱ Upload STL</button>
            <button className="btn icon-btn" disabled title="Settings — not built yet">⚙</button>
          </div>
        </div>

        {file && (
          <div className="commit-compose">
            <span className="drop-label loaded">{file.name}</span>
            <span className="file-size">{formatBytes(file.size)}</span>
            <input
              className="commit-msg-input"
              placeholder="commit message (optional)"
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && pushCommit()}
            />
          </div>
        )}
        {commitError && <div className="commit-error">{commitError}</div>}
        {dragging && <div className="commit-error" style={{ color: 'var(--accent)' }}>Drop the .stl file to load it</div>}

        <div className="stat-card">
          <div className="stat-cols">
            <div className="stat-col"><div className="stat-col-label">Branch</div><div className="stat-col-value">main</div></div>
            <div className="stat-col"><div className="stat-col-label">Commits</div><div className="stat-col-value">{project.commit_count || 0}</div></div>
            <div className="stat-col"><div className="stat-col-label">Last Commit</div><div className="stat-col-value">{commits[0] ? relativeTime(commits[0].created_at) : '—'}</div></div>
            <div className="stat-col">
              <div className="stat-col-label">Contributors</div>
              <div className="stat-col-value"><span className="commit-avatar">{commits[0]?.author?.[0]?.toUpperCase() || '?'}</span></div>
            </div>
          </div>
          <button className="stat-thumb" onClick={() => previewFile && onOpenViewer(previewFile)} disabled={!previewFile}>
            {previewFile ? <Viewer file={previewFile} /> : fetchingThumb ? <MeshLoader /> : <span className="stat-thumb-empty">no mesh yet</span>}
          </button>
        </div>
      </div>

      <div className="card commits-card">
        <div className="commits-card-header">Recent Commits</div>
        <ul className="commit-rail">
          {groupByDay(commits).map((item) =>
            item.type === 'heading' ? (
              <li key={item.key} className="commit-day-heading">{item.label}</li>
            ) : (
              <li key={item.key} className="commit-item">
                <span className="commit-dot" />
                <div className="commit-body">
                  <div className="commit-message">
                    <span className="commit-hash">{item.id.slice(0, 7)}</span>
                    {item.message || '(no message)'}
                  </div>
                  <div className="commit-sub">
                    <span className="commit-avatar">{item.author?.[0]?.toUpperCase()}</span>
                    <span>{item.author}</span>
                    <span>·</span>
                    <span>{relativeTime(item.created_at)}</span>
                    <span className="branch-badge">main</span>
                  </div>
                </div>
              </li>
            )
          )}
          {commits.length === 0 && <li className="project-empty">No commits yet — upload an STL to get started</li>}
        </ul>
        <div className="pull-history-link" title="Pull requests are not built yet">View Pull History →</div>
      </div>
    </div>
  )
}
