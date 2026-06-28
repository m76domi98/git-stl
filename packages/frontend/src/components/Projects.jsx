import { useState, useEffect, useCallback } from 'react'

export default function Projects({ token, selectedProject, onSelect, onCommitCreated }) {
  const [projects, setProjects] = useState([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [connectingId, setConnectingId] = useState(null)
  const [error, setError] = useState(null)

  const api = useCallback((path, opts = {}) =>
    fetch(path, { ...opts, headers: { Authorization: `Bearer ${token}`, ...opts.headers } }),
    [token]
  )

  const load = useCallback(async () => {
    const r = await api('/api/projects')
    if (r.ok) setProjects(await r.json())
  }, [api])

  useEffect(() => { load() }, [load])

  const createProject = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    const r = await api('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (r.ok) {
      const p = await r.json()
      setProjects((prev) => [{ ...p, commit_count: 0 }, ...prev])
      setNewName('')
      setCreating(false)
      onSelect(p)
    }
  }

  const connectGitHub = async (project, e) => {
    e.stopPropagation()
    setConnectingId(project.id)
    setError(null)
    const r = await api(`/api/projects/${project.id}/github`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_private: false }),
    })
    setConnectingId(null)
    if (r.ok) {
      const data = await r.json()
      setProjects((prev) => prev.map((p) =>
        p.id === project.id
          ? { ...p, github_repo_owner: data.github_repo_owner, github_repo_name: data.github_repo_name }
          : p
      ))
      if (selectedProject?.id === project.id) {
        onSelect({ ...project, ...data })
      }
    } else {
      const body = await r.json().catch(() => ({}))
      setError(body.error || 'GitHub connection failed')
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span>PROJECTS</span>
        <button className="sidebar-new-btn" onClick={() => { setCreating(true); setError(null) }}>+</button>
      </div>

      {creating && (
        <form className="new-project-form" onSubmit={createProject}>
          <input
            className="new-project-input"
            autoFocus
            placeholder="project name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="new-project-actions">
            <button type="submit" className="sidebar-action-btn">CREATE</button>
            <button type="button" className="sidebar-action-btn muted" onClick={() => { setCreating(false); setNewName('') }}>CANCEL</button>
          </div>
        </form>
      )}

      {error && <div className="sidebar-error">{error}</div>}

      <ul className="project-list">
        {projects.map((p) => (
          <li
            key={p.id}
            className={`project-item${selectedProject?.id === p.id ? ' active' : ''}`}
            onClick={() => onSelect(p)}
          >
            <div className="project-name">{p.name}</div>
            <div className="project-meta">
              <span>{p.commit_count} {p.commit_count === 1 ? 'commit' : 'commits'}</span>
              {p.github_repo_name ? (
                <a
                  className="gh-link"
                  href={`https://github.com/${p.github_repo_owner}/${p.github_repo_name}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  ↗ github
                </a>
              ) : (
                <button
                  className="gh-connect-btn"
                  disabled={connectingId === p.id}
                  onClick={(e) => connectGitHub(p, e)}
                >
                  {connectingId === p.id ? '...' : '+ github'}
                </button>
              )}
            </div>
          </li>
        ))}
        {projects.length === 0 && !creating && (
          <li className="project-empty">no projects yet</li>
        )}
      </ul>
    </aside>
  )
}
