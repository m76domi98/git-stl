import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js'
import MeshLoader from './MeshLoader.jsx'

function EmptyState() {
  return (
    <div className="empty-state">
      <div className="crosshair">
        <span className="axis-x">X</span>
        <span className="axis-y">Y</span>
        <div className="origin" />
      </div>
      <span className="empty-hint">// no mesh loaded</span>
    </div>
  )
}

// full = the big single-model screen: light grid background, orientation gizmo, toolbar.
// Default (thumbnail) stays dark with no chrome.
export default function Viewer({ file, onLoad, full = false }) {
  const wrapperRef = useRef(null)
  const mountRef = useRef(null)
  const apiRef = useRef(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!file) return
    setLoading(true)

    const mount = mountRef.current
    const width = mount.clientWidth
    const height = mount.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(full ? 0xf5f5f2 : 0x0a0c14)

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1)
    dirLight.position.set(5, 10, 7)
    scene.add(dirLight)
    const fillLight = new THREE.DirectionalLight(0x8890a8, 0.5)
    fillLight.position.set(-5, -3, -5)
    scene.add(fillLight)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06

    // NOTE: three's stock axes gizmo, not the plan's literal cube — swap if design insists
    let viewHelper, clock, onGizmoClick
    if (full) {
      renderer.autoClear = false
      clock = new THREE.Clock()
      viewHelper = new ViewHelper(camera, renderer.domElement)
      viewHelper.center = controls.target
      onGizmoClick = (e) => viewHelper.handleClick(e)
      renderer.domElement.addEventListener('pointerup', onGizmoClick)
    }

    let geometry, edges, grid
    let fitCamera = null

    const reader = new FileReader()
    reader.onload = (e) => {
      geometry = new STLLoader().parse(e.target.result)
      geometry.computeVertexNormals()

      const vertexCount = geometry.attributes.position.count
      onLoad?.({ vertices: vertexCount, faces: Math.round(vertexCount / 3) })

      const material = new THREE.MeshPhongMaterial({
        color: 0xd8dae0,
        specular: 0x444444,
        shininess: 35,
      })
      const mesh = new THREE.Mesh(geometry, material)
      scene.add(mesh)

      edges = new THREE.EdgesGeometry(geometry, 15)
      const lineMat = new THREE.LineBasicMaterial({ color: 0x3a3f52, transparent: true, opacity: 0.6 })
      const wireframe = new THREE.LineSegments(edges, lineMat)
      scene.add(wireframe)

      const box = new THREE.Box3().setFromObject(mesh)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)

      if (full) {
        grid = new THREE.GridHelper(maxDim * 4, 40, 0xc6c9bf, 0xe0e2da)
        grid.position.y = box.min.y
        scene.add(grid)
      }

      fitCamera = () => {
        const fov = camera.fov * (Math.PI / 180)
        camera.position.copy(center)
        camera.position.z += (maxDim / 2) / Math.tan(fov / 2) * 1.2
        camera.near = maxDim / 100
        camera.far = maxDim * 100
        camera.updateProjectionMatrix()
        controls.target.copy(center)
        controls.update()
      }
      fitCamera()
      setLoading(false)
    }
    reader.readAsArrayBuffer(file)

    const orbit = (angle) => {
      const offset = camera.position.clone().sub(controls.target)
      offset.applyAxisAngle(camera.up, angle)
      camera.position.copy(controls.target).add(offset)
    }
    const zoomBy = (factor) => {
      const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor)
      camera.position.copy(controls.target).add(offset)
    }
    apiRef.current = {
      rotateLeft: () => orbit(Math.PI / 12),
      rotateRight: () => orbit(-Math.PI / 12),
      zoomIn: () => zoomBy(0.8),
      zoomOut: () => zoomBy(1.25),
      fit: () => fitCamera?.(),
      fullscreen: () =>
        document.fullscreenElement ? document.exitFullscreen() : wrapperRef.current.requestFullscreen(),
    }

    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      controls.update()
      if (viewHelper?.animating) viewHelper.update(clock.getDelta())
      renderer.render(scene, camera)
      viewHelper?.render(renderer)
    }
    animate()

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      apiRef.current = null
      if (viewHelper) {
        renderer.domElement.removeEventListener('pointerup', onGizmoClick)
        viewHelper.dispose()
      }
      controls.dispose()
      geometry?.dispose()
      edges?.dispose()
      grid?.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
      onLoad?.(null)
    }
  }, [file])

  if (!file) return <EmptyState />

  return (
    <div ref={wrapperRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {full && !loading && (
        <div className="viewer-toolbar">
          <button className="btn icon-btn" title="Rotate left" onClick={() => apiRef.current?.rotateLeft()}>⟲</button>
          <button className="btn icon-btn" title="Rotate right" onClick={() => apiRef.current?.rotateRight()}>⟳</button>
          <button className="btn icon-btn" title="Zoom in" onClick={() => apiRef.current?.zoomIn()}>＋</button>
          <button className="btn icon-btn" title="Zoom out" onClick={() => apiRef.current?.zoomOut()}>－</button>
          <button className="btn icon-btn" title="Fit to view" onClick={() => apiRef.current?.fit()}>⛶</button>
          <button className="btn icon-btn" title="Fullscreen" onClick={() => apiRef.current?.fullscreen()}>⤢</button>
        </div>
      )}
      {loading && <MeshLoader />}
    </div>
  )
}
