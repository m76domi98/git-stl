export default function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>MeshGit</h1>
      <p>Visual version control for 3D models.</p>
      <div
        id="viewport"
        style={{
          width: '100%',
          height: '600px',
          background: '#1a1a1a',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
        }}
      >
        3D viewport coming soon
      </div>
    </div>
  )
}
