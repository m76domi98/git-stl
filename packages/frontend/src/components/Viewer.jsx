import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
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

export default function Viewer({ file, onLoad }) {
  const mountRef = useRef(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!file) return
    setLoading(true)

    const mount = mountRef.current
    const width = mount.clientWidth
    const height = mount.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0c14)

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

    let geometry, edges

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
      const fov = camera.fov * (Math.PI / 180)

      camera.position.copy(center)
      camera.position.z += (maxDim / 2) / Math.tan(fov / 2) * 1.5
      camera.near = maxDim / 100
      camera.far = maxDim * 100
      camera.updateProjectionMatrix()
      controls.target.copy(center)
      controls.update()
      setLoading(false)
    }
    reader.readAsArrayBuffer(file)

    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
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
      controls.dispose()
      geometry?.dispose()
      edges?.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
      onLoad?.(null)
    }
  }, [file])

  if (!file) return <EmptyState />

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {loading && <MeshLoader />}
    </div>
  )
}
