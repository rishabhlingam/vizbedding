import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const SCALE = 2.5;
const POINT_SIZE = 0.08;
const LINE_BASE_OPACITY = 0.55;
const ROTATION_SPEED = 0.0016; // 20% slower than 0.002

function PointsAndLines({ points3D, edges, rotate }) {
  const groupRef = useRef();

  useFrame(() => {
    if (!groupRef.current || !rotate) return;
    groupRef.current.rotation.y += ROTATION_SPEED;
  });

  const pointGeometry = useMemo(() => {
    const positions = new Float32Array(points3D.length * 3);
    const colors = new Float32Array(points3D.length * 3);
    const c = new THREE.Color('#000000');
    for (let i = 0; i < points3D.length; i++) {
      const [x, y, z] = points3D[i];
      positions[i * 3] = x * SCALE;
      positions[i * 3 + 1] = y * SCALE;
      positions[i * 3 + 2] = z * SCALE;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [points3D]);

  const lineItems = useMemo(() => {
    return edges
      .map(([i, j, sim]) => {
        const a = points3D[i];
        const b = points3D[j];
        if (!a || !b || i >= points3D.length || j >= points3D.length) return null;
        const points = [
          new THREE.Vector3(a[0] * SCALE, a[1] * SCALE, a[2] * SCALE),
          new THREE.Vector3(b[0] * SCALE, b[1] * SCALE, b[2] * SCALE),
        ];
        return { geom: new THREE.BufferGeometry().setFromPoints(points), i, j, sim };
      })
      .filter(Boolean);
  }, [edges, points3D]);

  if (points3D.length === 0) return null;

  return (
    <group ref={groupRef}>
      <points geometry={pointGeometry}>
        <pointsMaterial size={POINT_SIZE} vertexColors sizeAttenuation transparent opacity={0.9} />
      </points>
      {lineItems.map(({ geom, i, j }) => (
          <line key={`${i}-${j}`} geometry={geom}>
            <lineBasicMaterial
              color="#333"
              transparent
              opacity={LINE_BASE_OPACITY}
            />
          </line>
        ))}
    </group>
  );
}

function SceneContent({ points3D, edges, rotate }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-5, -5, 5]} intensity={0.4} />
      <PointsAndLines points3D={points3D} edges={edges} rotate={rotate} />
      <OrbitControls enableDamping dampingFactor={0.05} />
    </>
  );
}

export function VisualizationPanel({ points3D, edges }) {
  const [rotate, setRotate] = useState(true);

  return (
    <div
      className="viz-panel"
      onMouseEnter={() => setRotate(false)}
      onMouseLeave={() => setRotate(true)}
    >
      <Canvas camera={{ position: [0, 0, 6], fov: 48 }}>
        <SceneContent points3D={points3D} edges={edges} rotate={rotate} />
      </Canvas>
    </div>
  );
}
