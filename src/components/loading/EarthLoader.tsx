"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function EarthLoader() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      container.classList.add("earth-fallback");
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.z = 5.2;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    const earthGeometry = new THREE.SphereGeometry(1.35, 96, 96);

    const earthMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vPosition = mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        precision highp float;

        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        uniform float uTime;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);

          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));

          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;

          for (int i = 0; i < 5; i++) {
            value += noise(p) * amplitude;
            p *= 2.03;
            amplitude *= 0.5;
          }

          return value;
        }

        void main() {
          vec2 uv = vUv;
          uv.x += uTime * 0.012;

          float land = fbm(uv * vec2(13.0, 9.0));
          float detail = fbm(uv * 35.0);

          vec3 ocean = vec3(0.018, 0.095, 0.19);
          vec3 deepOcean = vec3(0.008, 0.035, 0.095);
          vec3 continent = vec3(0.12, 0.36, 0.39);
          vec3 landLight = vec3(0.27, 0.57, 0.53);

          float landMask = smoothstep(0.51, 0.56, land);
          vec3 color = mix(deepOcean, ocean, smoothstep(0.2, 0.8, detail));
          color = mix(color, continent, landMask);
          color = mix(color, landLight, landMask * detail * 0.42);

          float latitude = sin(uv.y * 3.14159);
          float cloudNoise = fbm(uv * 21.0 + vec2(uTime * 0.025, 0.0));
          float clouds = smoothstep(0.68, 0.82, cloudNoise) * latitude;
          color = mix(color, vec3(0.67, 0.88, 0.91), clouds * 0.26);

          float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(-vPosition))), 2.2);
          color += vec3(0.025, 0.38, 0.58) * fresnel * 0.65;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earthGroup.add(earth);

    const atmosphereGeometry = new THREE.SphereGeometry(1.43, 64, 64);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        void main() {
          float intensity = pow(
            0.68 - dot(normalize(vNormal), normalize(vViewPosition)),
            3.0
          );

          vec3 atmosphere = vec3(0.08, 0.68, 0.92);
          gl_FragColor = vec4(atmosphere, intensity * 0.72);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    earthGroup.add(atmosphere);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x56dce9,
      transparent: true,
      opacity: 0.42,
    });

    const ringOne = new THREE.Mesh(
      new THREE.TorusGeometry(1.83, 0.004, 8, 180),
      ringMaterial,
    );
    ringOne.rotation.x = 1.15;
    ringOne.rotation.y = 0.25;
    earthGroup.add(ringOne);

    const ringTwo = new THREE.Mesh(
      new THREE.TorusGeometry(2.02, 0.002, 8, 180),
      new THREE.MeshBasicMaterial({
        color: 0xc7b58e,
        transparent: true,
        opacity: 0.27,
      }),
    );
    ringTwo.rotation.x = 0.82;
    ringTwo.rotation.y = -0.55;
    earthGroup.add(ringTwo);

    const particleCount = 420;
    const particlePositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const radius = 1.75 + Math.random() * 1.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = radius * Math.cos(phi);
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3),
    );

    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: 0x80eaf0,
        size: 0.018,
        transparent: true,
        opacity: 0.72,
        sizeAttenuation: true,
      }),
    );

    scene.add(particles);

    const ambient = new THREE.AmbientLight(0x6ca9c8, 1.2);
    scene.add(ambient);

    const keyLight = new THREE.PointLight(0x6de5f1, 28, 12);
    keyLight.position.set(-3, 2, 4);
    scene.add(keyLight);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let animationId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const elapsed = clock.getElapsedTime();

      if (!reducedMotion) {
        earth.rotation.y = elapsed * 0.105;
        earth.rotation.x = Math.sin(elapsed * 0.13) * 0.035;
        ringOne.rotation.z = elapsed * 0.055;
        ringTwo.rotation.z = -elapsed * 0.035;
        particles.rotation.y = elapsed * 0.018;
        particles.rotation.x = Math.sin(elapsed * 0.08) * 0.035;
      }

      earthMaterial.uniforms.uTime.value = elapsed;
      renderer.render(scene, camera);
    };

    const resizeObserver = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) return;

      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });

    resizeObserver.observe(container);
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();

      earthGeometry.dispose();
      earthMaterial.dispose();
      atmosphereGeometry.dispose();
      atmosphereMaterial.dispose();
      ringOne.geometry.dispose();
      ringOne.material.dispose();
      ringTwo.geometry.dispose();
      (ringTwo.material as THREE.Material).dispose();
      particleGeometry.dispose();
      (particles.material as THREE.Material).dispose();

      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div
      className="earth-loader-canvas"
      ref={containerRef}
      aria-hidden="true"
    />
  );
}
