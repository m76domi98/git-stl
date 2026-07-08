export default function MeshLoader() {
  return (
    <div className="mesh-loader">
      <svg viewBox="0 0 100 100" width="48" height="48">
        <g className="mesh-loader-spin">
          <polygon points="50,12 88,78 12,78" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="50" cy="12" r="5" fill="currentColor" />
          <circle cx="88" cy="78" r="5" fill="currentColor" />
          <circle cx="12" cy="78" r="5" fill="currentColor" />
        </g>
      </svg>
      <span className="mesh-loader-label">Loading mesh…</span>
    </div>
  )
}
