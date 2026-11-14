"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { CurrentWeather } from "@/services/openMeteo";

type AtmosphericGlobeProps = {
  rotation: boolean;
  atmosphere: boolean;
  clouds: boolean;
  orbits: boolean;
  weather: CurrentWeather | null;
  latitude: number | null;
  longitude: number | null;
  cinematic?: boolean;
};

const earthVertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const earthFragmentShader = `
  precision highp float;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uNormalMap;
  uniform vec3 uSunDirection;

  void main() {
    vec3 normal = normalize(vNormal);

    vec3 lightDirection = normalize(uSunDirection);

    float sunFacing = dot(normal, lightDirection);
    float daylight = smoothstep(-0.16, 0.18, sunFacing);

    vec3 dayColor = texture2D(uDayMap, vUv).rgb;
    vec3 nightColor = texture2D(uNightMap, vUv).rgb;

    vec3 surface = dayColor * (0.025 + daylight * 1.12);

    float nightFactor = 1.0 - daylight;

    surface += nightColor *
               nightFactor *
               vec3(1.35, 1.12, 0.78);

    vec3 normalDetail = texture2D(uNormalMap, vUv).rgb;
    float terrainDetail = dot(normalDetail, vec3(0.333));

    surface *= 0.94 + terrainDetail * 0.12;

    float oceanReflection = pow(
      max(dot(
        reflect(-lightDirection, normal),
        vec3(0.0, 0.0, 1.0)
      ), 0.0),
      32.0
    );

    surface += oceanReflection * vec3(0.12, 0.34, 0.48) *
               daylight * 0.32;

    float rim = pow(
      1.0 - max(dot(normal, vec3(0.0, 0.0, 1.0)), 0.0),
      2.8
    );

    surface += vec3(0.025, 0.30, 0.48) * rim * 0.72;

    float gridLon = abs(fract(vUv.x * 36.0) - 0.5);
    float gridLat = abs(fract(vUv.y * 18.0) - 0.5);

    float grid =
      (1.0 - smoothstep(0.485, 0.5, gridLon)) +
      (1.0 - smoothstep(0.485, 0.5, gridLat));

    surface += vec3(0.025, 0.12, 0.17) *
               min(grid, 1.0) * 0.045;

    gl_FragColor = vec4(surface, 1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const cloudVertexShader = `
  varying vec3 vPosition;
  varying vec3 vNormal;

  void main() {
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cloudFragmentShader = `
  precision highp float;

  varying vec3 vPosition;
  varying vec3 vNormal;

  uniform float uTime;
  uniform float uCloudCover;
  uniform float uHumidity;
  uniform float uWindSpeed;
  uniform float uPrecipitation;
  uniform float uHasWeather;
  uniform vec2 uWindVector;
  uniform vec3 uSunDirection;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec3(1.0, 0.0, 0.0));
    float c = hash(i + vec3(0.0, 1.0, 0.0));
    float d = hash(i + vec3(1.0, 1.0, 0.0));
    float e = hash(i + vec3(0.0, 0.0, 1.0));
    float f1 = hash(i + vec3(1.0, 0.0, 1.0));
    float g = hash(i + vec3(0.0, 1.0, 1.0));
    float h = hash(i + vec3(1.0, 1.0, 1.0));

    return mix(
      mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
      mix(mix(e, f1, f.x), mix(g, h, f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.52;

    for (int i = 0; i < 5; i++) {
      value += noise(p) * amplitude;
      p *= 2.03;
      amplitude *= 0.48;
    }

    return value;
  }

  void main() {
    float coverage = clamp(uCloudCover / 100.0, 0.0, 1.0);
    float humidity = clamp(uHumidity / 100.0, 0.0, 1.0);

    float windDrift = 0.018 + clamp(uWindSpeed / 100.0, 0.0, 1.5) * 0.105;

    vec3 p = normalize(vPosition) * 5.2;
    p.x += uTime * windDrift * uWindVector.x;
    p.z += uTime * windDrift * uWindVector.y;

    // Multi-scale global procedural cloud formations.
    // Local weather modifies the appearance without erasing
    // cloud formations across the entire planetary surface.
    float cloudNoise =
      fbm(p * 0.72) * 0.42 +
      fbm(p * 1.45) * 0.30 +
      fbm(p * 3.1) * 0.18 +
      fbm(p * 6.2) * 0.10;

    // Keep a persistent global cloud field even when the
    // selected city reports clear skies.
    float threshold = mix(0.59, 0.46, coverage);
    float formation = smoothstep(threshold, threshold + 0.10, cloudNoise);
    formation = pow(formation, 0.78);

    // Local cloud cover and humidity influence density,
    // but neither can switch off the global cloud field.
    float density = 0.38 +
                    coverage * 0.34 +
                    humidity * 0.12;

    float alpha = formation * density * uHasWeather;

    vec3 lightDirection = normalize(uSunDirection);
    float cloudSunFacing = dot(normalize(vNormal), lightDirection);
    float cloudLighting = 0.12 + smoothstep(-0.18, 0.62, cloudSunFacing) * 0.88;

    vec3 brightCloud = vec3(0.78, 0.91, 0.98);
    vec3 shadowCloud = vec3(0.20, 0.40, 0.57);
    vec3 rainCloud = vec3(0.24, 0.36, 0.50);

    vec3 cloudColor = mix(shadowCloud, brightCloud, cloudLighting);
    cloudColor = mix(
      cloudColor,
      rainCloud,
      clamp(uPrecipitation / 4.0, 0.0, 0.8)
    );

    gl_FragColor = vec4(cloudColor, alpha * 0.92);
  }
`;

function calculateSolarOrientation(date: Date): {
  direction: THREE.Vector3;
  gmst: number;
} {
  const julianDay = date.getTime() / 86400000 + 2440587.5;
  const centuries = (julianDay - 2451545.0) / 36525.0;

  const normalizeDegrees = (value: number) =>
    ((value % 360) + 360) % 360;

  const meanLongitude = normalizeDegrees(
    280.46646 +
      centuries * (36000.76983 + 0.0003032 * centuries),
  );

  const meanAnomaly = normalizeDegrees(
    357.52911 +
      centuries * (35999.05029 - 0.0001537 * centuries),
  );

  const anomalyRadians = THREE.MathUtils.degToRad(meanAnomaly);

  const equationOfCenter =
    Math.sin(anomalyRadians) *
      (1.914602 - centuries * (0.004817 + 0.000014 * centuries)) +
    Math.sin(2 * anomalyRadians) *
      (0.019993 - 0.000101 * centuries) +
    Math.sin(3 * anomalyRadians) * 0.000289;

  const omega = THREE.MathUtils.degToRad(
    125.04 - 1934.136 * centuries,
  );

  const apparentLongitude = THREE.MathUtils.degToRad(
    meanLongitude + equationOfCenter - 0.00569 -
      0.00478 * Math.sin(omega),
  );

  const seconds =
    21.448 -
    centuries *
      (46.815 + centuries * (0.00059 - centuries * 0.001813));

  const meanObliquity =
    23 + (26 + seconds / 60) / 60;

  const obliquity = THREE.MathUtils.degToRad(
    meanObliquity + 0.00256 * Math.cos(omega),
  );

  const rightAscension = Math.atan2(
    Math.cos(obliquity) * Math.sin(apparentLongitude),
    Math.cos(apparentLongitude),
  );

  const declination = Math.asin(
    Math.sin(obliquity) * Math.sin(apparentLongitude),
  );

  const direction = new THREE.Vector3(
    Math.cos(declination) * Math.cos(rightAscension),
    Math.sin(declination),
    Math.cos(declination) * Math.sin(rightAscension),
  ).normalize();

  const gmstDegrees = normalizeDegrees(
    280.46061837 +
      360.98564736629 * (julianDay - 2451545.0) +
      0.000387933 * centuries * centuries -
      (centuries * centuries * centuries) / 38710000,
  );

  return {
    direction,
    gmst: THREE.MathUtils.degToRad(gmstDegrees),
  };
}
export default function AtmosphericGlobe({
  rotation,
  atmosphere,
  clouds,
  orbits,
  weather,
  latitude,
  longitude,
  cinematic = false,
}: AtmosphericGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(rotation);
  const atmosphereRef = useRef(atmosphere);
  const cloudsRef = useRef(clouds);
  const orbitsRef = useRef(orbits);
  const weatherRef = useRef(weather);
  const latitudeRef = useRef(latitude);
  const longitudeRef = useRef(longitude);
  const cinematicRef = useRef(cinematic);

  useEffect(() => {
    rotationRef.current = rotation;
    atmosphereRef.current = atmosphere;
    cloudsRef.current = clouds;
    orbitsRef.current = orbits;
    weatherRef.current = weather;
    latitudeRef.current = latitude;
    longitudeRef.current = longitude;
    cinematicRef.current = cinematic;
  }, [rotation, atmosphere, clouds, orbits, weather, latitude, longitude, cinematic]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, cinematicRef.current ? 6.8 : 3.65);

    const viewGroup = new THREE.Group();
    scene.add(viewGroup);

    const globeGroup = new THREE.Group();
    globeGroup.scale.setScalar(1.08);
    viewGroup.add(globeGroup);

    const earthGeometry = new THREE.SphereGeometry(1, 128, 128);

    const textureLoader = new THREE.TextureLoader();

    const earthDayTexture = textureLoader.load(
      "/textures/earth/earth-day.jpg",
    );

    const earthNightTexture = textureLoader.load(
      "/textures/earth/earth-night.png",
    );

    const earthNormalTexture = textureLoader.load(
      "/textures/earth/earth-normal.jpg",
    );

    earthDayTexture.colorSpace = THREE.SRGBColorSpace;
    earthNightTexture.colorSpace = THREE.SRGBColorSpace;
    earthNormalTexture.colorSpace = THREE.NoColorSpace;

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    earthDayTexture.anisotropy = maxAnisotropy;
    earthNightTexture.anisotropy = maxAnisotropy;
    earthNormalTexture.anisotropy = maxAnisotropy;

    const earthMaterial = new THREE.ShaderMaterial({
      vertexShader: earthVertexShader,
      fragmentShader: earthFragmentShader,
      uniforms: {
        uDayMap: { value: earthDayTexture },
        uNightMap: { value: earthNightTexture },
        uNormalMap: { value: earthNormalTexture },
        uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
      },
    });

    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    earthGroupAdd();

    function earthGroupAdd() {
      globeGroup.add(earth);
    }

    const cloudGeometry = new THREE.SphereGeometry(1.018, 112, 112);

    const cloudMaterial = new THREE.ShaderMaterial({
      vertexShader: cloudVertexShader,
      fragmentShader: cloudFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uCloudCover: { value: 0 },
        uHumidity: { value: 0 },
        uWindSpeed: { value: 0 },
        uPrecipitation: { value: 0 },
        uHasWeather: { value: 0 },
        uWindVector: { value: new THREE.Vector2(1, 0) },
        uSunDirection: { value: new THREE.Vector3(1, 0, 0) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });

    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    globeGroup.add(cloudMesh);

    const cityMarker = new THREE.Group();

    const markerCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 20, 20),
      new THREE.MeshBasicMaterial({
        color: 0xd8fbff,
        blending: THREE.AdditiveBlending,
      }),
    );

    const markerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.046, 0.003, 8, 48),
      new THREE.MeshBasicMaterial({
        color: 0x69e5ff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );

    const markerOuterRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.0018, 8, 48),
      new THREE.MeshBasicMaterial({
        color: 0xb6f5ff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );

    cityMarker.add(markerCore, markerRing, markerOuterRing);
    globeGroup.add(cityMarker);
    cityMarker.visible = false;

    const markerNormal = new THREE.Vector3(0, 0, 1);

    const atmosphereGeometry = new THREE.SphereGeometry(1.12, 96, 96);

    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x32cfff,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const atmosphereMesh = new THREE.Mesh(
      atmosphereGeometry,
      atmosphereMaterial,
    );
    globeGroup.add(atmosphereMesh);

    const innerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.065, 80, 80),
      new THREE.MeshBasicMaterial({
        color: 0x087da8,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    globeGroup.add(innerGlow);

    const outerGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.19, 72, 72),
      new THREE.MeshBasicMaterial({
        color: 0x0875ad,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.075,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    globeGroup.add(outerGlow);

    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);

    const orbitOne = new THREE.Mesh(
      new THREE.TorusGeometry(1.47, 0.0035, 8, 256),
      new THREE.MeshBasicMaterial({
        color: 0x62dcff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
      }),
    );
    orbitOne.rotation.set(1.05, 0.28, 0.2);
    orbitGroup.add(orbitOne);

    const orbitTwo = new THREE.Mesh(
      new THREE.TorusGeometry(1.67, 0.0025, 8, 256),
      new THREE.MeshBasicMaterial({
        color: 0xd8b978,
        transparent: true,
        opacity: 0.34,
      }),
    );
    orbitTwo.rotation.set(1.3, -0.55, 0.6);
    orbitGroup.add(orbitTwo);

    const orbitAccent = new THREE.Mesh(
      new THREE.TorusGeometry(1.53, 0.0015, 6, 220),
      new THREE.MeshBasicMaterial({
        color: 0x299ec9,
        transparent: true,
        opacity: 0.22,
      }),
    );
    orbitAccent.rotation.set(0.42, 0.9, -0.2);
    orbitGroup.add(orbitAccent);

    const starCount = 1800;
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const radius = 2.5 + Math.random() * 5.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = radius * Math.cos(phi);
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );

    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({
        color: 0xa8ddf7,
        size: 0.012,
        transparent: true,
        opacity: 0.72,
        sizeAttenuation: true,
      }),
    );
    scene.add(stars);

    const ambient = new THREE.AmbientLight(0x6bbbd4, 0.85);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xc8efff, 3.2);
    keyLight.position.set(-3, 2.2, 4);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x087ba9, 2.4, 8);
    fillLight.position.set(2, -1, -2);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x27c7ee, 1.5, 7);
    rimLight.position.set(-2, -2, 1);
    scene.add(rimLight);

    const clock = new THREE.Clock();
    let animationFrame = 0;
    let isVisible = true;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(bounds.width, 1);
      const height = Math.max(bounds.height, 1);

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const visibilityHandler = () => {
      isVisible = document.visibilityState === "visible";
    };

    document.addEventListener("visibilitychange", visibilityHandler);

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let simulationTimestamp = Date.now();
    let hasAppliedSolarOrientation = false;
    const animate = () => {
      animationFrame = requestAnimationFrame(animate);

      if (!isVisible) return;

      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      
      if (cinematicRef.current) {
        const approachProgress = reducedMotion
          ? 1
          : THREE.MathUtils.smoothstep(elapsed, 0.5, 10);

        camera.position.z = THREE.MathUtils.lerp(
          6.8,
          2.95,
          approachProgress,
        );
      } else {
        camera.position.z = 3.65;
      }

      const earthRotationEnabled =
        rotationRef.current && !reducedMotion;

      if (earthRotationEnabled) {
        simulationTimestamp = Date.now();
      }

      const solarOrientation = calculateSolarOrientation(
        new Date(simulationTimestamp),
      );

      if (!hasAppliedSolarOrientation || earthRotationEnabled) {
        globeGroup.rotation.y = -solarOrientation.gmst;
        hasAppliedSolarOrientation = true;
      }

      if (earthRotationEnabled) {
        orbitGroup.rotation.y = elapsed * 0.027;
        stars.rotation.y = elapsed * 0.004;
      }

      if (
        latitudeRef.current !== null &&
        longitudeRef.current !== null
      ) {
        const latitudeRadians = THREE.MathUtils.degToRad(
          latitudeRef.current,
        );

        const longitudeRadians = THREE.MathUtils.degToRad(
          longitudeRef.current,
        );

        const cityLocalDirection = new THREE.Vector3(
          Math.cos(latitudeRadians) * Math.cos(longitudeRadians),
          Math.sin(latitudeRadians),
          -Math.cos(latitudeRadians) * Math.sin(longitudeRadians),
        );

        const cityWorldDirection = cityLocalDirection
          .applyQuaternion(globeGroup.quaternion)
          .normalize();
        
        cityMarker.position
          .copy(cityLocalDirection)
          .multiplyScalar(1.035);

        cityMarker.quaternion.setFromUnitVectors(
          markerNormal,
          cityLocalDirection,
        );

        cityMarker.visible = cinematicRef.current;

        const targetViewRotation = new THREE.Quaternion().setFromUnitVectors(
          cityWorldDirection,
          new THREE.Vector3(0, 0, 1),
        );

        viewGroup.quaternion.slerp(
          targetViewRotation,
          1 - Math.exp(-delta * 3.2),
        );
      } else {
        cityMarker.visible = false;
        viewGroup.quaternion.slerp(
          new THREE.Quaternion(),
          1 - Math.exp(-delta * 2.0),
        );
      }

      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

      const sunDirectionView = solarOrientation.direction
        .clone()
        .applyQuaternion(viewGroup.quaternion)
        .transformDirection(camera.matrixWorldInverse)
        .negate();

      earthMaterial.uniforms.uSunDirection.value.copy(sunDirectionView);

      const currentWeather = weatherRef.current;
      const uniforms = cloudMaterial.uniforms;
      uniforms.uSunDirection.value.copy(sunDirectionView);

      uniforms.uTime.value = elapsed;
      uniforms.uHasWeather.value = currentWeather ? 1 : 0;

      if (currentWeather) {
        uniforms.uCloudCover.value = currentWeather.cloud_cover;
        uniforms.uHumidity.value = currentWeather.relative_humidity_2m;
        uniforms.uWindSpeed.value = currentWeather.wind_speed_10m;
        uniforms.uPrecipitation.value = currentWeather.precipitation;

        const radians =
          (currentWeather.wind_direction_10m * Math.PI) / 180;

        uniforms.uWindVector.value.set(
          Math.cos(radians),
          Math.sin(radians),
        );
      }

      cloudMesh.visible = cloudsRef.current;
      atmosphereMesh.visible = atmosphereRef.current;
      innerGlow.visible = atmosphereRef.current;
      outerGlow.visible = atmosphereRef.current;
      orbitGroup.visible = orbitsRef.current;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", visibilityHandler);

      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();

          const material = object.material;

          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        }
      });

      earthDayTexture.dispose();
      earthNightTexture.dispose();
      earthNormalTexture.dispose();

      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="atmosphere-globe-canvas"
      aria-label="Interactive three-dimensional atmospheric visualization"
    />
  );
}
