import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const SCALE = 2.5;
const ANIM_DURATION = 1.4;
const SIDE_POSITIONS = [
  [4.5, 0, 0],
  [-4.5, 0, 0],
  [0, 4.5, 0],
  [0, -4.5, 0],
];

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
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
  const pointsRef = useRef();
  const prevPointsRef = useRef([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const animFromRef = useRef(null);
  const animToRef = useRef(null);
  const animStartRef = useRef(null);

  useEffect(() => {
    if (points3D.length === 0) {
      prevPointsRef.current = [];
      return;
    }
    const prev = prevPointsRef.current;
    const isAdd = prev.length > 0 && points3D.length > prev.length;

    if (isAdd && pointsRef.current?.geometry) {
      const toPositions = points3D.map(([x, y, z]) => [x * SCALE, y * SCALE, z * SCALE]);
      const fromPositions = prev.map(([x, y, z]) => [x * SCALE, y * SCALE, z * SCALE]);
      const side = SIDE_POSITIONS[Math.floor(Math.random() * 4)];
      fromPositions.push([...side]);

      const posAttr = pointsRef.current.geometry.attributes.position;
      const arr = posAttr.array;
      for (let i = 0; i < fromPositions.length; i++) {
        arr[i * 3] = fromPositions[i][0];
        arr[i * 3 + 1] = fromPositions[i][1];
        arr[i * 3 + 2] = fromPositions[i][2];
      }
      posAttr.needsUpdate = true;

      animFromRef.current = fromPositions;
      animToRef.current = toPositions;
      animStartRef.current = null;
      setIsAnimating(true);
    }

    prevPointsRef.current = points3D;
  }, [points3D]);

  useFrame((state) => {
    if (!groupRef.current) return;
    if (rotate) groupRef.current.rotation.y += ROTATION_SPEED;

    if (!isAnimating || !animFromRef.current || !animToRef.current || !pointsRef.current?.geometry)
      return;

    if (animStartRef.current === null) animStartRef.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - animStartRef.current;
    let t = Math.min(1, elapsed / ANIM_DURATION);
    t = easeOutCubic(t);

    const posAttr = pointsRef.current.geometry.attributes.position;
    const arr = posAttr.array;
    const from = animFromRef.current;
    const to = animToRef.current;

    for (let i = 0; i < from.length; i++) {
      arr[i * 3] = from[i][0] + (to[i][0] - from[i][0]) * t;
      arr[i * 3 + 1] = from[i][1] + (to[i][1] - from[i][1]) * t;
      arr[i * 3 + 2] = from[i][2] + (to[i][2] - from[i][2]) * t;
    }
    posAttr.needsUpdate = true;

    if (t >= 1) {
      animFromRef.current = null;
      animToRef.current = null;
      setIsAnimating(false);
    }
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

  const validEdges = useMemo(() => {
    return edges.filter(
      ([i, j]) => i < points3D.length && j < points3D.length
    );
  }, [edges, points3D]);

  const lineSegmentsGeo = useMemo(() => {
    const maxSegments = validEdges.length;
    const pos = new Float32Array(maxSegments * 2 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }, [validEdges.length]);

  const lineSegmentsRef = useRef();

  useFrame(() => {
    if (!showEdges || points3D.length === 0 || !lineSegmentsRef.current?.geometry || !pointsRef.current?.geometry)
      return;

    const posAttr = lineSegmentsRef.current.geometry.attributes.position;
    const posArr = posAttr.array;
    const pointPositions = pointsRef.current.geometry.attributes.position.array;
    const newPointIndex = points3D.length - 1;

    let idx = 0;
    for (const [i, j] of validEdges) {
      if (isAnimating && (i === newPointIndex || j === newPointIndex)) continue;

      posArr[idx * 6] = pointPositions[i * 3];
      posArr[idx * 6 + 1] = pointPositions[i * 3 + 1];
      posArr[idx * 6 + 2] = pointPositions[i * 3 + 2];
      posArr[idx * 6 + 3] = pointPositions[j * 3];
      posArr[idx * 6 + 4] = pointPositions[j * 3 + 1];
      posArr[idx * 6 + 5] = pointPositions[j * 3 + 2];
      idx++;
    }
    posAttr.needsUpdate = true;
    lineSegmentsRef.current.geometry.setDrawRange(0, idx * 2);
  });

  return (
    <group ref={groupRef}>
      <AxisPlanes showXZ={showXZ} showXY={showXY} showYZ={showYZ} />
      <OriginPoint />
      {points3D.length > 0 && (
        <>
          <points ref={pointsRef} geometry={pointGeometry}>
            <pointsMaterial size={POINT_SIZE} vertexColors sizeAttenuation transparent opacity={0.9} />
          </points>
          {showEdges && (
            <lineSegments ref={lineSegmentsRef} geometry={lineSegmentsGeo}>
              <lineBasicMaterial
                color="#333"
                transparent
                opacity={LINE_BASE_OPACITY}
              />
            </lineSegments>
          )}
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
  const [showXZ, setShowXZ] = useState(false);
  const [showXY, setShowXY] = useState(false);
  const [showYZ, setShowYZ] = useState(false);
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
