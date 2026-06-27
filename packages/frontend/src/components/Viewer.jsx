import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

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

export default function Viewer({ file }) {
  const mountRef = useRef(null)

  useEffect(() => {
    if (!file) return

    const mount = mountRef.current
    const width = mount.clientWidth
    const height = mount.clientHeight

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf2ecfa)

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xddd0f5, 0.9))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
    dirLight.position.set(5, 10, 7)
    scene.add(dirLight)
    const fillLight = new THREE.DirectionalLight(0xc4a8f0, 0.5)
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

      const material = new THREE.MeshPhongMaterial({
        color: 0x9b8bbf,
        specular: 0xfaf6ff,
        shininess: 50,
      })
      const mesh = new THREE.Mesh(geometry, material)
      scene.add(mesh)

      // Slightly darker purple edges for definition
      edges = new THREE.EdgesGeometry(geometry, 15)
      const lineMat = new THREE.LineBasicMaterial({ color: 0x6b46c1, transparent: true, opacity: 0.5 })
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
    }
  }, [file])

  if (!file) return <EmptyState />

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
