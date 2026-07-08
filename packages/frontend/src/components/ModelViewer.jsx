import { useState } from 'react'
import Viewer from './Viewer.jsx'
import { formatBytes } from '../lib/format.js'

export default function ModelViewer({ file, onBack }) {
  const [modelStats, setModelStats] = useState(null)

  return (
    <div className="dashboard">
      <button className="btn back-btn" onClick={onBack}>← Back to overview</button>
      <div className="card viewport-card">
        <div className="viewport">
          <Viewer file={file} onLoad={setModelStats} />
        </div>
        {modelStats && (
          <div className="model-info">
            <div className="model-info-title">Model Info</div>
            <div className="model-info-row"><span>Vertices</span><span>{modelStats.vertices.toLocaleString()}</span></div>
            <div className="model-info-row"><span>Faces</span><span>{modelStats.faces.toLocaleString()}</span></div>
            {file.size != null && <div className="model-info-row"><span>Size</span><span>{formatBytes(file.size)}</span></div>}
            <div className="model-info-row"><span>Format</span><span>STL</span></div>
          </div>
        )}
      </div>
    </div>
  )
}
