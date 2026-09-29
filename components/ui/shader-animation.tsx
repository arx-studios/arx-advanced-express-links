"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

export function ShaderAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const vertexShader = `
      void main() {
        gl_Position = vec4( position, 1.0 );
      }
    `

    const fragmentShader = `
      #define TWO_PI 6.2831853072
      #define PI 3.14159265359

      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform vec2 mouse;

      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);

        // Convert mouse from NDC (-1..1) to the same coordinate space as uv
        vec2 m = mouse * resolution / min(resolution.x, resolution.y);

        // Offset rings to orbit the cursor
        vec2 d = uv - m;

        float t = time*0.05;
        float lineWidth = 0.002;

        vec3 color = vec3(0.0);
        for(int j = 0; j < 3; j++){
          for(int i=0; i < 5; i++){
            color[j] += lineWidth*float(i*i) / abs(fract(t - 0.01*float(j)+float(i)*0.01)*5.0 - length(d) + mod(d.x+d.y, 0.2));
          }
        }

        gl_FragColor = vec4(color[0],color[1],color[2],1.0);
      }
    `

    const camera = new THREE.Camera()
    camera.position.z = 1

    const scene = new THREE.Scene()
    const geometry = new THREE.PlaneGeometry(2, 2)

    const uniforms = {
      time:       { type: "f",  value: 1.0 },
      resolution: { type: "v2", value: new THREE.Vector2() },
      mouse:      { type: "v2", value: new THREE.Vector2(0, 0) },
    }

    const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
    scene.add(new THREE.Mesh(geometry, material))

    const renderer = new THREE.WebGLRenderer({ antialias: true, canvas })
    renderer.setPixelRatio(window.devicePixelRatio)

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight, false)
      uniforms.resolution.value.set(
        window.innerWidth  * window.devicePixelRatio,
        window.innerHeight * window.devicePixelRatio
      )
    }
    onResize()
    window.addEventListener("resize", onResize)

    // Raw mouse target (updated on every event)
    const target = { x: 0, y: 0 }
    // Smoothed position (lerped each frame)
    const smooth = { x: 0, y: 0 }

    const onMouseMove = (e: MouseEvent) => {
      // NDC: x in [-1, 1] left→right, y in [-1, 1] bottom→top (WebGL convention)
      target.x =  (e.clientX / window.innerWidth)  * 2 - 1
      target.y = -(e.clientY / window.innerHeight) * 2 + 1
    }

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      target.x =  (t.clientX / window.innerWidth)  * 2 - 1
      target.y = -(t.clientY / window.innerHeight) * 2 + 1
    }

    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("touchmove", onTouchMove, { passive: true })

    let animationId: number
    const animate = () => {
      animationId = requestAnimationFrame(animate)

      // Smooth follow — 6% per frame gives a fluid lag
      smooth.x += (target.x - smooth.x) * 0.06
      smooth.y += (target.y - smooth.y) * 0.06
      uniforms.mouse.value.set(smooth.x, smooth.y)

      uniforms.time.value += 0.05
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("touchmove", onTouchMove)
      cancelAnimationFrame(animationId)
      renderer.dispose()
      geometry.dispose()
      material.dispose()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-screen h-screen z-0 block"
    />
  )
}
