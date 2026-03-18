import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const SCALE = 2.5;
const POINT_SIZE = 0.08;
const LINE_BASE_OPACITY = 0.55;
const ROTATION_SPEED = 0.0016; // 20% slower than 0.002
const PLANE_SIZE = 4;
const PLANE_OPACITY = 0.22;
const ORIGIN_POINT_RADIUS = 0.06;

function FilledPlane({ color, rotation }) {
  return (
    <mesh rotation={rotation}>
      <planeGeometry args={[PLANE_SIZE, PLANE_SIZE]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={PLANE_OPACITY}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function OriginPoint() {
  return (
    <mesh position={[0, 0, 0]}>
      <sphereGeometry args={[ORIGIN_POINT_RADIUS, 16, 16]} />
      <meshBasicMaterial color="#111" />
    </mesh>
  );
}

function AxisPlanes({ showXZ, showXY, showYZ }) {
  return (
    <group>
      {showXZ && (
        <FilledPlane color="#44aa88" rotation={[-Math.PI / 2, 0, 0]} />
      )}
      {showXY && (
        <FilledPlane color="#4488cc" rotation={[0, 0, 0]} />
      )}
      {showYZ && (
        <FilledPlane color="#cc6644" rotation={[0, Math.PI / 2, 0]} />
      )}
    </group>
  );
}

function PointsAndLines({ points3D, edges, rotate, showXZ, showXY, showYZ, showEdges }) {
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

  return (
    <group ref={groupRef}>
      <AxisPlanes showXZ={showXZ} showXY={showXY} showYZ={showYZ} />
      <OriginPoint />
      {points3D.length > 0 && (
        <>
          <points geometry={pointGeometry}>
            <pointsMaterial size={POINT_SIZE} vertexColors sizeAttenuation transparent opacity={0.9} />
          </points>
          {showEdges && lineItems.map(({ geom, i, j }) => (
            <line key={`${i}-${j}`} geometry={geom}>
              <lineBasicMaterial
                color="#333"
                transparent
                opacity={LINE_BASE_OPACITY}
              />
            </line>
          ))}
        </>
      )}
    </group>
  );
}

function SceneContent({ points3D, edges, rotate, showXZ, showXY, showYZ, showEdges }) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-5, -5, 5]} intensity={0.4} />
      <PointsAndLines
        points3D={points3D}
        edges={edges}
        rotate={rotate}
        showXZ={showXZ}
        showXY={showXY}
        showYZ={showYZ}
        showEdges={showEdges}
      />
      <OrbitControls enableDamping dampingFactor={0.05} />
    </>
  );
}

export function VisualizationPanel({ points3D, edges }) {
  const [rotate, setRotate] = useState(true);
  const [showXZ, setShowXZ] = useState(true);
  const [showXY, setShowXY] = useState(true);
  const [showYZ, setShowYZ] = useState(true);
  const [showEdges, setShowEdges] = useState(true);

  return (
    <div
      className="viz-panel"
      onMouseEnter={() => setRotate(false)}
      onMouseLeave={() => setRotate(true)}
    >
      <div className="viz-toggles">
        <label>
          <input
            type="checkbox"
            checked={showXZ}
            onChange={(e) => setShowXZ(e.target.checked)}
          />
          <span className="viz-toggles__swatch viz-toggles__swatch--xz" />
          XZ plane
        </label>
        <label>
          <input
            type="checkbox"
            checked={showXY}
            onChange={(e) => setShowXY(e.target.checked)}
          />
          <span className="viz-toggles__swatch viz-toggles__swatch--xy" />
          XY plane
        </label>
        <label>
          <input
            type="checkbox"
            checked={showYZ}
            onChange={(e) => setShowYZ(e.target.checked)}
          />
          <span className="viz-toggles__swatch viz-toggles__swatch--yz" />
          YZ plane
        </label>
        <label>
          <input
            type="checkbox"
            checked={showEdges}
            onChange={(e) => setShowEdges(e.target.checked)}
          />
          Edges
        </label>
      </div>
      <Canvas camera={{ position: [2, 2, 6], fov: 48 }}>
        <SceneContent
          points3D={points3D}
          edges={edges}
          rotate={rotate}
          showXZ={showXZ}
          showXY={showXY}
          showYZ={showYZ}
          showEdges={showEdges}
        />
      </Canvas>
    </div>
  );
}
