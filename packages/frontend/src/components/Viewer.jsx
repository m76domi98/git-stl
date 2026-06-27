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
    scene.background = new THREE.Color(0x07090f)

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(width, height)
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const dirLight = new THREE.DirectionalLight(0x00d4aa, 0.6)
    dirLight.position.set(5, 10, 7)
    scene.add(dirLight)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
    fillLight.position.set(-5, -3, -5)
    scene.add(fillLight)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06

    const reader = new FileReader()
    reader.onload = (e) => {
      const geometry = new STLLoader().parse(e.target.result)
      geometry.computeVertexNormals()

      const material = new THREE.MeshPhongMaterial({
        color: 0x1e2a3a,
        specular: 0x00d4aa,
        shininess: 60,
        emissive: 0x0d1117,
      })
      const mesh = new THREE.Mesh(geometry, material)
      scene.add(mesh)

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
      renderer.dispose()
      mount.removeChild(renderer.domElement)
    }
  }, [file])

  if (!file) return <EmptyState />

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
