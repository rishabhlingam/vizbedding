import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { TrackballControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  IconPlanes,
  IconAxes,
  IconEdgesBetweenPoints,
  IconEdgesFromCenter,
} from './VizToggleIcons';

// Scales PCA-projected coordinates for rendering.
// Increasing this spreads clusters further apart visually.
const BASE_SCALE = 2.5;
const SCALE = 3.2;
const SCALE_RATIO = SCALE / BASE_SCALE;
// Extra shaping so both seed clusters spread similarly.
// We expand around each cluster centroid (internal) and slightly push centroids apart.
const CLUSTER_INTERNAL_SPREAD = 1.25;
const CLUSTER_CENTER_SPREAD = 1.15;
const ANIM_DURATION = 1.4;
const SIDE_POSITIONS = [
  [4.5 * SCALE_RATIO, 0, 0],
  [-4.5 * SCALE_RATIO, 0, 0],
  [0, 4.5 * SCALE_RATIO, 0],
  [0, -4.5 * SCALE_RATIO, 0],
];

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function scalePoint([x, y, z]) {
  return [x * SCALE, y * SCALE, z * SCALE];
}
const POINT_SIZE = 0.25;
const LINE_BASE_OPACITY = 0.55;
const ROTATION_SPEED = 0.0016;
const HOVER_AMPLITUDE = 0.11;
const HOVER_SPEED = 1.35;
const PLANE_SIZE = 4 * SCALE_RATIO;
const PLANE_OPACITY = 0.22;
const AXIS_LENGTH = 2.4 * SCALE_RATIO;
const AXIS_ARROW_HEIGHT = 0.14;
const AXIS_ARROW_RADIUS = 0.052;
const AXIS_COLOR_X = '#c43d3d';
const AXIS_COLOR_Y = '#3d9b4a';
const AXIS_COLOR_Z = '#3b7fc7';
const CLUSTER_COLOR_A = AXIS_COLOR_X;
const CLUSTER_COLOR_B = AXIS_COLOR_Z;
const ORIGIN_POINT_RADIUS = 0.06;
const EMPHASIS_RING_RADIUS = 0.25;
const EMPHASIS_RING_SPIN_SPEED = 0.006;

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

function EmphasisRing({ selectedIndex, pointsRef, pointCount, rotatingGroupRef, dashColor = '#1a1a1a' }) {
  const groupRef = useRef();
  const spinGroupRef = useRef();
  const lineLoopRef = useRef();
  const { camera } = useThree();
  const points = useMemo(() => {
    const pts = [];
    const segments = 32;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        EMPHASIS_RING_RADIUS * Math.cos(theta),
        EMPHASIS_RING_RADIUS * Math.sin(theta),
        0
      ));
    }
    return pts;
  }, []);

  const geo = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  const zAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const dirToCamera = useMemo(() => new THREE.Vector3(), []);
  const worldPos = useMemo(() => new THREE.Vector3(), []);
  const localPos = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (lineLoopRef.current?.computeLineDistances) {
      lineLoopRef.current.computeLineDistances();
    }
  }, [selectedIndex, pointCount]);

  useFrame(() => {
    if (
      !groupRef.current ||
      !spinGroupRef.current ||
      !rotatingGroupRef?.current ||
      selectedIndex == null ||
      selectedIndex >= pointCount ||
      !pointsRef.current?.geometry
    ) {
      return;
    }
    const posAttr = pointsRef.current.geometry.attributes.position;
    const arr = posAttr.array;
    const i = selectedIndex;
    if (i * 3 + 2 >= arr.length) return;

    const g = groupRef.current;
    localPos.set(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);
    rotatingGroupRef.current.localToWorld(worldPos.copy(localPos));
    g.position.copy(worldPos);

    dirToCamera.copy(camera.position).sub(worldPos).normalize();
    g.quaternion.setFromUnitVectors(zAxis, dirToCamera);

    spinGroupRef.current.rotation.z += EMPHASIS_RING_SPIN_SPEED;
  });

  if (selectedIndex == null || selectedIndex >= pointCount) return null;

  return (
    <group ref={groupRef}>
      <group ref={spinGroupRef}>
        <lineLoop ref={lineLoopRef} geometry={geo}>
          <lineDashedMaterial
            color={dashColor}
            dashSize={0.06}
            gapSize={0.04}
          />
        </lineLoop>
      </group>
    </group>
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

function AxisArrowHead({ position, rotation, color }) {
  return (
    <mesh position={position} rotation={rotation}>
      <coneGeometry args={[AXIS_ARROW_RADIUS, AXIS_ARROW_HEIGHT, 12]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

const AXIS_LINE_MATERIAL = { transparent: true, opacity: 0.85 };

function lineAxisGeometry(coords) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(coords), 3));
  return g;
}

function AxisLines({ showAxisX, showAxisY, showAxisZ }) {
  const h = AXIS_ARROW_HEIGHT;
  const L = AXIS_LENGTH;
  const { xGeo, yGeo, zGeo } = useMemo(() => {
    const len = AXIS_LENGTH;
    return {
      xGeo: lineAxisGeometry([-len, 0, 0, len, 0, 0]),
      yGeo: lineAxisGeometry([0, -len, 0, 0, len, 0]),
      zGeo: lineAxisGeometry([0, 0, -len, 0, 0, len]),
    };
  }, []);

  return (
    <group>
      {showAxisX && (
        <>
          <line geometry={xGeo}>
            <lineBasicMaterial color={AXIS_COLOR_X} {...AXIS_LINE_MATERIAL} />
          </line>
          <AxisArrowHead
            position={[L - h / 2, 0, 0]}
            rotation={[0, 0, -Math.PI / 2]}
            color={AXIS_COLOR_X}
          />
          <AxisArrowHead
            position={[-L + h / 2, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            color={AXIS_COLOR_X}
          />
        </>
      )}
      {showAxisY && (
        <>
          <line geometry={yGeo}>
            <lineBasicMaterial color={AXIS_COLOR_Y} {...AXIS_LINE_MATERIAL} />
          </line>
          <AxisArrowHead position={[0, L - h / 2, 0]} rotation={[0, 0, 0]} color={AXIS_COLOR_Y} />
          <AxisArrowHead
            position={[0, -L + h / 2, 0]}
            rotation={[Math.PI, 0, 0]}
            color={AXIS_COLOR_Y}
          />
        </>
      )}
      {showAxisZ && (
        <>
          <line geometry={zGeo}>
            <lineBasicMaterial color={AXIS_COLOR_Z} {...AXIS_LINE_MATERIAL} />
          </line>
          <AxisArrowHead
            position={[0, 0, L - h / 2]}
            rotation={[Math.PI / 2, 0, 0]}
            color={AXIS_COLOR_Z}
          />
          <AxisArrowHead
            position={[0, 0, -L + h / 2]}
            rotation={[-Math.PI / 2, 0, 0]}
            color={AXIS_COLOR_Z}
          />
        </>
      )}
    </group>
  );
}

function PointsAndLines({
  points3D,
  edges,
  clusters,
  autoRotateY,
  hoverBob,
  coordOverlay,
  referenceFrameMode,
  showXZ,
  showXY,
  showYZ,
  showAxisX,
  showAxisY,
  showAxisZ,
  showEdges,
  edgeMode,
  selectedIndex,
  secondarySelectedIndex,
}) {
  const groupRef = useRef();
  const pointsRef = useRef();
  const prevPointsRef = useRef([]);
  const { camera, size } = useThree();
  const localPos = useMemo(() => new THREE.Vector3(), []);
  const worldPos = useMemo(() => new THREE.Vector3(), []);
  const ndcPos = useMemo(() => new THREE.Vector3(), []);
  const localPosB = useMemo(() => new THREE.Vector3(), []);
  const worldPosB = useMemo(() => new THREE.Vector3(), []);
  const ndcPosB = useMemo(() => new THREE.Vector3(), []);
  const coordOverlayRef = useRef(coordOverlay);

  useEffect(() => {
    coordOverlayRef.current = coordOverlay;
  }, [coordOverlay]);
  const isAnimatingRef = useRef(false);
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
      const toPositions = points3D.map(scalePoint);
      const fromPositions = prev.map(scalePoint);
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
      isAnimatingRef.current = true;
    }

    prevPointsRef.current = points3D;
  }, [points3D]);

  useEffect(() => {
    const overlay = coordOverlayRef.current;
    const labelEl = overlay?.coordLabelRef?.current;
    if (!labelEl) return;

    if (
      selectedIndex == null ||
      selectedIndex < 0 ||
      selectedIndex >= points3D.length
    ) {
      labelEl.style.visibility = 'hidden';
      return;
    }

    // Show coordinates for the *rendered* positions (after any cluster spread transforms).
    const posAttr = pointsRef.current?.geometry?.attributes?.position;
    const arr = posAttr?.array;
    const [x, y, z] = arr
      ? [arr[selectedIndex * 3], arr[selectedIndex * 3 + 1], arr[selectedIndex * 3 + 2]]
      : scalePoint(points3D[selectedIndex]);
    const xf = x.toFixed(2);
    const yf = y.toFixed(2);
    const zf = z.toFixed(2);
    labelEl.innerHTML = `(<span class="coord-x">${xf}</span>, <span class="coord-y">${yf}</span>, <span class="coord-z">${zf}</span>)`;
    labelEl.style.visibility = 'visible';
  }, [selectedIndex, points3D]);

  useEffect(() => {
    const overlay = coordOverlayRef.current;
    const label2 = overlay?.coordLabel2Ref?.current;
    if (!label2) return;

    const sec = secondarySelectedIndex;
    const pri = selectedIndex;
    const valid =
      sec != null &&
      pri != null &&
      sec !== pri &&
      sec >= 0 &&
      sec < points3D.length &&
      pri >= 0 &&
      pri < points3D.length;

    if (!valid) {
      label2.style.visibility = 'hidden';
      return;
    }

    const posAttr = pointsRef.current?.geometry?.attributes?.position;
    const arr = posAttr?.array;
    const [x, y, z] = arr
      ? [arr[sec * 3], arr[sec * 3 + 1], arr[sec * 3 + 2]]
      : scalePoint(points3D[sec]);
    const xf = x.toFixed(2);
    const yf = y.toFixed(2);
    const zf = z.toFixed(2);
    label2.innerHTML = `(<span class="coord-x">${xf}</span>, <span class="coord-y">${yf}</span>, <span class="coord-z">${zf}</span>)`;
    label2.style.visibility = 'visible';
  }, [secondarySelectedIndex, selectedIndex, points3D]);

  useFrame((state) => {
    if (!groupRef.current) return;

    if (autoRotateY) {
      groupRef.current.rotation.y += ROTATION_SPEED;
      groupRef.current.position.y = 0;
    } else if (hoverBob) {
      groupRef.current.position.y =
        HOVER_AMPLITUDE * Math.sin(state.clock.elapsedTime * HOVER_SPEED);
    } else {
      groupRef.current.position.y = 0;
    }

    // Screen-space leader lines + labels (primary; optional compare row + distance).
    const overlay = coordOverlayRef.current;
    const horizLine = overlay?.leaderHorizLineRef?.current;
    const slantLine = overlay?.leaderSlantLineRef?.current;
    const labelEl = overlay?.coordLabelRef?.current;
    const horiz2 = overlay?.leaderHorizLine2Ref?.current;
    const slant2 = overlay?.leaderSlantLine2Ref?.current;
    const label2 = overlay?.coordLabel2Ref?.current;
    const distEl = overlay?.distanceLabelRef?.current;
    const vertDistLine = overlay?.distanceVertLineRef?.current;

    const primaryOk =
      horizLine &&
      slantLine &&
      labelEl &&
      selectedIndex != null &&
      selectedIndex >= 0 &&
      selectedIndex < points3D.length &&
      pointsRef.current?.geometry &&
      groupRef.current;

    const sec = secondarySelectedIndex;
    const compareOk =
      primaryOk &&
      sec != null &&
      sec !== selectedIndex &&
      sec >= 0 &&
      sec < points3D.length &&
      horiz2 &&
      slant2 &&
      label2 &&
      distEl &&
      vertDistLine;

    if (primaryOk) {
      const svgEl = overlay.leaderSvgRef?.current;
      const svgRect = svgEl?.getBoundingClientRect();
      const svgW = svgRect?.width ?? size.width;
      const svgH = svgRect?.height ?? size.height;
      const endX = svgW - 14;

      const posAttr = pointsRef.current.geometry.attributes.position;
      const arr = posAttr.array;
      const i = selectedIndex;

      const joinY1 = svgH * 0.12;
      const labelWidth1 = labelEl.getBoundingClientRect().width || 0;
      const joinX1 = Math.max(0, endX - labelWidth1);

      horizLine.setAttribute('x1', joinX1);
      horizLine.setAttribute('y1', joinY1);
      horizLine.setAttribute('x2', endX);
      horizLine.setAttribute('y2', joinY1);
      horizLine.setAttribute('visibility', 'visible');

      localPos.set(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);
      groupRef.current.localToWorld(worldPos.copy(localPos));
      ndcPos.copy(worldPos).project(camera);
      const inView1 = ndcPos.z >= -1 && ndcPos.z <= 1;
      slantLine.setAttribute('visibility', inView1 ? 'visible' : 'hidden');
      const px1 = ((ndcPos.x + 1) / 2) * svgW;
      const py1 = ((1 - ndcPos.y) / 2) * svgH;
      slantLine.setAttribute('x1', joinX1);
      slantLine.setAttribute('y1', joinY1);
      slantLine.setAttribute('x2', px1);
      slantLine.setAttribute('y2', py1);

      labelEl.style.left = `${joinX1}px`;
      labelEl.style.top = `${joinY1 - 16}px`;
      labelEl.style.visibility = 'visible';

      if (compareOk) {
        const j = sec;
        // Euclidean distance in the same rendered 3D space as the coordinate labels.
        const ax = arr[i * 3];
        const ay = arr[i * 3 + 1];
        const az = arr[i * 3 + 2];
        const bx = arr[j * 3];
        const by = arr[j * 3 + 1];
        const bz = arr[j * 3 + 2];
        const dist = Math.sqrt(
          (bx - ax) * (bx - ax) + (by - ay) * (by - ay) + (bz - az) * (bz - az)
        );
        distEl.textContent = `Distance: ${dist.toFixed(2)}`;
        distEl.title = `Euclidean distance in the same 3D space as the coordinate labels: ${dist.toFixed(2)}`;

        // Secondary tuple + underline in the bottom-right (same right margin as primary).
        const joinY2 = svgH * 0.86;
        const labelWidth2 = label2.getBoundingClientRect().width || 0;
        const joinX2 = Math.max(0, endX - labelWidth2);

        horiz2.setAttribute('x1', joinX2);
        horiz2.setAttribute('y1', joinY2);
        horiz2.setAttribute('x2', endX);
        horiz2.setAttribute('y2', joinY2);
        horiz2.setAttribute('visibility', 'visible');

        localPosB.set(arr[j * 3], arr[j * 3 + 1], arr[j * 3 + 2]);
        groupRef.current.localToWorld(worldPosB.copy(localPosB));
        ndcPosB.copy(worldPosB).project(camera);
        const inView2 = ndcPosB.z >= -1 && ndcPosB.z <= 1;
        slant2.setAttribute('visibility', inView2 ? 'visible' : 'hidden');
        const px2 = ((ndcPosB.x + 1) / 2) * svgW;
        const py2 = ((1 - ndcPosB.y) / 2) * svgH;
        slant2.setAttribute('x1', joinX2);
        slant2.setAttribute('y1', joinY2);
        slant2.setAttribute('x2', px2);
        slant2.setAttribute('y2', py2);

        label2.style.left = `${joinX2}px`;
        label2.style.top = `${joinY2 - 16}px`;
        label2.style.visibility = 'visible';

        // Vertical connector through the midpoints of each coordinate underline (joinX → endX).
        const midX1 = (joinX1 + endX) / 2;
        const midX2 = (joinX2 + endX) / 2;
        const xVert = (midX1 + midX2) / 2;
        const yVertTop = joinY1 + 5;
        const yVertBottom = joinY2 - 21;
        vertDistLine.setAttribute('x1', xVert);
        vertDistLine.setAttribute('y1', yVertTop);
        vertDistLine.setAttribute('x2', xVert);
        vertDistLine.setAttribute('y2', yVertBottom);
        vertDistLine.setAttribute('visibility', 'visible');

        const midY = (yVertTop + yVertBottom) / 2;
        distEl.style.left = `${xVert}px`;
        distEl.style.top = `${midY}px`;
        distEl.style.transform = 'translate(-50%, -50%)';
        distEl.style.visibility = 'visible';
      } else {
        horiz2?.setAttribute('visibility', 'hidden');
        slant2?.setAttribute('visibility', 'hidden');
        vertDistLine?.setAttribute('visibility', 'hidden');
        if (label2) label2.style.visibility = 'hidden';
        if (distEl) {
          distEl.style.visibility = 'hidden';
          distEl.style.transform = '';
          distEl.style.left = '';
          distEl.style.top = '';
          distEl.removeAttribute('title');
        }
      }
    } else {
      horizLine?.setAttribute('visibility', 'hidden');
      slantLine?.setAttribute('visibility', 'hidden');
      horiz2?.setAttribute('visibility', 'hidden');
      slant2?.setAttribute('visibility', 'hidden');
      if (overlay?.coordLabelRef?.current) overlay.coordLabelRef.current.style.visibility = 'hidden';
      if (overlay?.coordLabel2Ref?.current) overlay.coordLabel2Ref.current.style.visibility = 'hidden';
      if (overlay?.distanceLabelRef?.current) {
        const d = overlay.distanceLabelRef.current;
        d.style.visibility = 'hidden';
        d.style.transform = '';
        d.style.left = '';
        d.style.top = '';
        d.removeAttribute('title');
      }
      overlay?.distanceVertLineRef?.current?.setAttribute('visibility', 'hidden');
    }

    if (!isAnimatingRef.current || !animFromRef.current || !animToRef.current || !pointsRef.current?.geometry)
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
      isAnimatingRef.current = false;
    }
  });

  const pointGeometry = useMemo(() => {
    const positions = new Float32Array(points3D.length * 3);
    const colors = new Float32Array(points3D.length * 3);
    const clusterA = new THREE.Color(CLUSTER_COLOR_A);
    const clusterB = new THREE.Color(CLUSTER_COLOR_B);

    const n = points3D.length;
    const basePositions = new Array(n);
    const centroidSums = [
      [0, 0, 0],
      [0, 0, 0],
    ];
    const centroidCounts = [0, 0];

    // Base positions (uniform scale) + cluster centroid estimates (in the same scaled space).
    for (let i = 0; i < n; i++) {
      const base = scalePoint(points3D[i]);
      basePositions[i] = base;
      const cluster = clusters?.[i] ?? 0;
      centroidCounts[cluster] += 1;
      centroidSums[cluster][0] += base[0];
      centroidSums[cluster][1] += base[1];
      centroidSums[cluster][2] += base[2];
    }

    const centroid0 = centroidCounts[0] ? centroidSums[0].map((s) => s / centroidCounts[0]) : [0, 0, 0];
    const centroid1 = centroidCounts[1] ? centroidSums[1].map((s) => s / centroidCounts[1]) : [0, 0, 0];

    const centroid0Scaled = centroid0.map((v) => v * CLUSTER_CENTER_SPREAD);
    const centroid1Scaled = centroid1.map((v) => v * CLUSTER_CENTER_SPREAD);

    for (let i = 0; i < n; i++) {
      const cluster = clusters?.[i] ?? 0;
      const base = basePositions[i];

      const centroid = cluster === 0 ? centroid0 : centroid1;
      const centroidScaled = cluster === 0 ? centroid0Scaled : centroid1Scaled;

      // Expand points relative to their cluster centroid (makes both clusters visually spread).
      const vx = base[0] - centroid[0];
      const vy = base[1] - centroid[1];
      const vz = base[2] - centroid[2];

      positions[i * 3] = centroidScaled[0] + vx * CLUSTER_INTERNAL_SPREAD;
      positions[i * 3 + 1] = centroidScaled[1] + vy * CLUSTER_INTERNAL_SPREAD;
      positions[i * 3 + 2] = centroidScaled[2] + vz * CLUSTER_INTERNAL_SPREAD;

      const c = cluster === 0 ? clusterA : clusterB;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [points3D, clusters]);

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

  const centerLineSegmentsGeo = useMemo(() => {
    const maxSegments = Math.max(1, points3D.length);
    const pos = new Float32Array(maxSegments * 2 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }, [points3D.length]);

  const lineSegmentsRef = useRef();
  const centerLineSegmentsRef = useRef();

  useFrame(() => {
    if (!showEdges || points3D.length === 0 || !pointsRef.current?.geometry) return;

    const pointPositions = pointsRef.current.geometry.attributes.position.array;
    const newPointIndex = points3D.length - 1;

    if (edgeMode === 'center' && centerLineSegmentsRef.current?.geometry) {
      const posAttr = centerLineSegmentsRef.current.geometry.attributes.position;
      const posArr = posAttr.array;
      let idx = 0;
      for (let i = 0; i < points3D.length; i++) {
        if (isAnimatingRef.current && i === newPointIndex) continue;
        const x = pointPositions[i * 3];
        const y = pointPositions[i * 3 + 1];
        const z = pointPositions[i * 3 + 2];
        if (Math.abs(x) < 1e-6 && Math.abs(y) < 1e-6 && Math.abs(z) < 1e-6) continue;
        posArr[idx * 6] = 0;
        posArr[idx * 6 + 1] = 0;
        posArr[idx * 6 + 2] = 0;
        posArr[idx * 6 + 3] = x;
        posArr[idx * 6 + 4] = y;
        posArr[idx * 6 + 5] = z;
        idx++;
      }
      posAttr.needsUpdate = true;
      centerLineSegmentsRef.current.computeLineDistances();
      centerLineSegmentsRef.current.geometry.setDrawRange(0, idx * 2);
    } else if (edgeMode === 'points' && lineSegmentsRef.current?.geometry) {
      const posAttr = lineSegmentsRef.current.geometry.attributes.position;
      const posArr = posAttr.array;
      let idx = 0;
      for (const [i, j] of validEdges) {
        if (isAnimatingRef.current && (i === newPointIndex || j === newPointIndex)) continue;
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
    }
  });

  return (
    <>
      <group ref={groupRef}>
        {referenceFrameMode === 'planes' ? (
          <AxisPlanes showXZ={showXZ} showXY={showXY} showYZ={showYZ} />
        ) : (
          <AxisLines
            showAxisX={showAxisX}
            showAxisY={showAxisY}
            showAxisZ={showAxisZ}
          />
        )}
        <OriginPoint />
        {points3D.length > 0 && (
          <>
            <points ref={pointsRef} geometry={pointGeometry}>
              <pointsMaterial size={POINT_SIZE} vertexColors sizeAttenuation transparent opacity={0.9} />
            </points>
            {selectedIndex != null &&
              selectedIndex >= 0 &&
              selectedIndex < points3D.length && (
                null
              )}
            {showEdges && edgeMode === 'points' && (
              <lineSegments ref={lineSegmentsRef} geometry={lineSegmentsGeo}>
                <lineBasicMaterial
                  color="#333"
                  transparent
                  opacity={LINE_BASE_OPACITY}
                />
              </lineSegments>
            )}
            {showEdges && edgeMode === 'center' && (
              <lineSegments ref={centerLineSegmentsRef} geometry={centerLineSegmentsGeo}>
                <lineDashedMaterial
                  color="#333"
                  dashSize={0.08}
                  gapSize={0.06}
                  transparent
                  opacity={LINE_BASE_OPACITY}
                />
              </lineSegments>
            )}
          </>
        )}
      </group>
      {points3D.length > 0 && (
        <>
          <EmphasisRing
            selectedIndex={selectedIndex}
            pointsRef={pointsRef}
            pointCount={points3D.length}
            rotatingGroupRef={groupRef}
          />
          <EmphasisRing
            selectedIndex={secondarySelectedIndex}
            pointsRef={pointsRef}
            pointCount={points3D.length}
            rotatingGroupRef={groupRef}
            dashColor="#5c5c5c"
          />
        </>
      )}
    </>
  );
}

function SceneContent({
  points3D,
  edges,
  clusters,
  autoRotateY,
  hoverBob,
  referenceFrameMode,
  coordOverlay,
  showXZ,
  showXY,
  showYZ,
  showAxisX,
  showAxisY,
  showAxisZ,
  showEdges,
  edgeMode,
  selectedIndex,
  secondarySelectedIndex,
}) {
  const controlsRef = useRef();

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-5, -5, 5]} intensity={0.4} />
      <PointsAndLines
        points3D={points3D}
        edges={edges}
        clusters={clusters}
        autoRotateY={autoRotateY}
        hoverBob={hoverBob}
        coordOverlay={coordOverlay}
        referenceFrameMode={referenceFrameMode}
        showXZ={showXZ}
        showXY={showXY}
        showYZ={showYZ}
        showAxisX={showAxisX}
        showAxisY={showAxisY}
        showAxisZ={showAxisZ}
        showEdges={showEdges}
        edgeMode={edgeMode}
        selectedIndex={selectedIndex}
        secondarySelectedIndex={secondarySelectedIndex}
      />
      <TrackballControls
        ref={controlsRef}
        target={[0, 0, 0]}
        dynamicDampingFactor={0.1}
      />
    </>
  );
}

export function VisualizationPanel({
  points3D,
  edges,
  selectedIndex,
  secondarySelectedIndex = null,
  clusters,
  panelRef,
  controlsRef,
  onTutorialAction,
  tutorialStepIndex,
  tutorialActive,
}) {
  const [pointerInsidePanel, setPointerInsidePanel] = useState(false);
  const [canvasDragging, setCanvasDragging] = useState(false);
  const dragStartRef = useRef(null);
  const dragTriggeredRef = useRef(false);
  const [referenceFrameMode, setReferenceFrameMode] = useState('axes'); // 'planes' | 'axes'
  const [showXZ, setShowXZ] = useState(false);
  const [showXY, setShowXY] = useState(false);
  const [showYZ, setShowYZ] = useState(false);
  const [showAxisX, setShowAxisX] = useState(true);
  const [showAxisY, setShowAxisY] = useState(true);
  const [showAxisZ, setShowAxisZ] = useState(true);
  const [showEdges, setShowEdges] = useState(true);
  const [edgeMode, setEdgeMode] = useState('points'); // 'points' | 'center'
  const [legendTop, setLegendTop] = useState(244);

  const leaderSvgRef = useRef();
  const leaderHorizLineRef = useRef();
  const leaderSlantLineRef = useRef();
  const leaderHorizLine2Ref = useRef();
  const leaderSlantLine2Ref = useRef();
  const coordLabelRef = useRef();
  const coordLabel2Ref = useRef();
  const distanceLabelRef = useRef();
  const distanceVertLineRef = useRef();

  const autoRotateY = !pointerInsidePanel;
  const hoverBob = pointerInsidePanel && !canvasDragging;
  const categoryCounts = useMemo(() => {
    const counts = [0, 0];
    const n = points3D.length;
    for (let i = 0; i < n; i++) {
      const c = clusters?.[i] ?? 0;
      if (c === 1) counts[1] += 1;
      else counts[0] += 1;
    }
    return counts;
  }, [clusters, points3D.length]);

  useEffect(() => {
    const endDrag = () => setCanvasDragging(false);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    return () => {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    };
  }, []);

  useEffect(() => {
    const updateLegendTop = () => {
      const controlsEl = controlsRef?.current;
      const panelEl = panelRef?.current;
      if (!controlsEl || !panelEl) return;
      const c = controlsEl.getBoundingClientRect();
      const p = panelEl.getBoundingClientRect();
      setLegendTop(Math.max(14, c.bottom - p.top + 10));
    };

    updateLegendTop();
    window.addEventListener('resize', updateLegendTop);
    const ro = new ResizeObserver(updateLegendTop);
    if (controlsRef?.current) ro.observe(controlsRef.current);
    if (panelRef?.current) ro.observe(panelRef.current);

    return () => {
      window.removeEventListener('resize', updateLegendTop);
      ro.disconnect();
    };
  }, [controlsRef, panelRef, referenceFrameMode, showXZ, showXY, showYZ, showAxisX, showAxisY, showAxisZ, showEdges, edgeMode]);

  return (
    <div
      className="viz-panel"
      ref={panelRef}
      onMouseEnter={() => setPointerInsidePanel(true)}
      onMouseLeave={() => {
        setPointerInsidePanel(false);
        setCanvasDragging(false);
      }}
    >
      <svg ref={leaderSvgRef} className="coord-leader-svg" aria-hidden="true">
        <defs>
          <marker
            id="vizCoordVertArrow"
            viewBox="0 0 10 10"
            refX={10}
            refY={5}
            markerWidth={6}
            markerHeight={6}
            orient="auto-start-reverse"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 10 5 L 0 10 Z" fill="rgba(0,0,0,0.45)" />
          </marker>
        </defs>
        <line ref={leaderHorizLineRef} x1="0" y1="0" x2="0" y2="0" stroke="rgba(0,0,0,0.55)" strokeWidth="1" strokeDasharray="4 4" visibility="hidden" />
        <line ref={leaderSlantLineRef} x1="0" y1="0" x2="0" y2="0" stroke="rgba(0,0,0,0.55)" strokeWidth="1" strokeDasharray="4 4" visibility="hidden" />
        <line ref={leaderHorizLine2Ref} x1="0" y1="0" x2="0" y2="0" stroke="rgba(0,0,0,0.45)" strokeWidth="1" strokeDasharray="4 4" visibility="hidden" />
        <line ref={leaderSlantLine2Ref} x1="0" y1="0" x2="0" y2="0" stroke="rgba(0,0,0,0.45)" strokeWidth="1" strokeDasharray="4 4" visibility="hidden" />
        <line
          ref={distanceVertLineRef}
          x1="0"
          y1="0"
          x2="0"
          y2="0"
          stroke="rgba(0,0,0,0.45)"
          strokeWidth="1"
          strokeDasharray="3 4"
          markerStart="url(#vizCoordVertArrow)"
          markerEnd="url(#vizCoordVertArrow)"
          visibility="hidden"
        />
      </svg>
      <div ref={coordLabelRef} className="coord-leader-text" />
      <div ref={distanceLabelRef} className="coord-leader-distance" />
      <div ref={coordLabel2Ref} className="coord-leader-text" />
      <div className="viz-legend" style={{ top: `${legendTop}px` }} aria-label="Category counts">
        <div className="viz-legend__title">Categories</div>
        <div className="viz-legend__row">
          <span className="viz-legend__dot viz-legend__dot--a" />
          <span>AI</span>
          <strong>{categoryCounts[0]}</strong>
        </div>
        <div className="viz-legend__row">
          <span className="viz-legend__dot viz-legend__dot--b" />
          <span>Food</span>
          <strong>{categoryCounts[1]}</strong>
        </div>
      </div>
      <div
        className="viz-toggles"
        ref={controlsRef}
        onPointerDownCapture={() => {
          if (tutorialActive && tutorialStepIndex === 4) onTutorialAction?.('controls');
        }}
        onChangeCapture={() => {
          if (tutorialActive && tutorialStepIndex === 4) onTutorialAction?.('controls');
        }}
      >
        <div className="viz-toggles__section">
          <div
            className="viz-toggles__edge-mode"
            role="group"
            aria-label="Reference frame"
          >
            <span className="viz-toggles__symbol" title="Planes">
              <IconPlanes />
            </span>
            <button
              type="button"
              className="viz-toggles__switch"
              role="switch"
              aria-checked={referenceFrameMode === 'axes'}
              aria-label={
                referenceFrameMode === 'axes'
                  ? 'Axes shown; switch to planes'
                  : 'Planes shown; switch to axes'
              }
              onClick={() =>
                setReferenceFrameMode((m) => (m === 'planes' ? 'axes' : 'planes'))
              }
            >
              <span
                className="viz-toggles__switch-thumb"
                data-checked={referenceFrameMode === 'axes'}
              />
            </button>
            <span className="viz-toggles__symbol" title="Axes">
              <IconAxes />
            </span>
          </div>
          {referenceFrameMode === 'planes' ? (
            <>
              <label className="viz-toggles__row">
                <input type="checkbox" checked={showXZ} onChange={(e) => setShowXZ(e.target.checked)} />
                <span className="viz-toggles__swatch viz-toggles__swatch--xz" />
                <span>XZ</span>
              </label>
              <label className="viz-toggles__row">
                <input type="checkbox" checked={showXY} onChange={(e) => setShowXY(e.target.checked)} />
                <span className="viz-toggles__swatch viz-toggles__swatch--xy" />
                <span>XY</span>
              </label>
              <label className="viz-toggles__row">
                <input type="checkbox" checked={showYZ} onChange={(e) => setShowYZ(e.target.checked)} />
                <span className="viz-toggles__swatch viz-toggles__swatch--yz" />
                <span>YZ</span>
              </label>
            </>
          ) : (
            <>
              <label className="viz-toggles__row">
                <input
                  type="checkbox"
                  checked={showAxisX}
                  onChange={(e) => setShowAxisX(e.target.checked)}
                />
                <span className="viz-toggles__swatch viz-toggles__swatch--axis-x" />
                <span>X</span>
              </label>
              <label className="viz-toggles__row">
                <input
                  type="checkbox"
                  checked={showAxisY}
                  onChange={(e) => setShowAxisY(e.target.checked)}
                />
                <span className="viz-toggles__swatch viz-toggles__swatch--axis-y" />
                <span>Y</span>
              </label>
              <label className="viz-toggles__row">
                <input
                  type="checkbox"
                  checked={showAxisZ}
                  onChange={(e) => setShowAxisZ(e.target.checked)}
                />
                <span className="viz-toggles__swatch viz-toggles__swatch--axis-z" />
                <span>Z</span>
              </label>
            </>
          )}
        </div>
        <div className="viz-toggles__divider" />
        <div className="viz-toggles__section">
          <label className="viz-toggles__row">
            <input type="checkbox" checked={showEdges} onChange={(e) => setShowEdges(e.target.checked)} />
            <span>Edges</span>
          </label>
          <div
            className="viz-toggles__edge-mode"
            role="group"
            aria-label="Edge style"
          >
            <span className="viz-toggles__symbol" title="Between points">
              <IconEdgesBetweenPoints />
            </span>
            <button
              type="button"
              className="viz-toggles__switch"
              role="switch"
              aria-checked={edgeMode === 'center'}
              aria-label={
                edgeMode === 'center'
                  ? 'Edges from center; switch to between points'
                  : 'Edges between points; switch to from center'
              }
              onClick={() => setEdgeMode((m) => (m === 'points' ? 'center' : 'points'))}
            >
              <span className="viz-toggles__switch-thumb" data-checked={edgeMode === 'center'} />
            </button>
            <span className="viz-toggles__symbol" title="From center">
              <IconEdgesFromCenter />
            </span>
          </div>
        </div>
        <div className="viz-toggles__divider" />
      </div>
      <Canvas
        camera={{ position: [2, 2, 10], fov: 48 }}
        frameloop="always"
        onPointerDown={(e) => {
          setCanvasDragging(true);
          dragStartRef.current = { x: e.clientX, y: e.clientY };
          dragTriggeredRef.current = false;
        }}
        onPointerMove={(e) => {
          if (!tutorialActive || tutorialStepIndex !== 3) return;
          if (!dragStartRef.current || dragTriggeredRef.current) return;
          const dx = e.clientX - dragStartRef.current.x;
          const dy = e.clientY - dragStartRef.current.y;
          if (dx * dx + dy * dy >= 12 * 12) {
            dragTriggeredRef.current = true;
            onTutorialAction?.('drag');
          }
        }}
        onPointerUp={() => {
          dragStartRef.current = null;
          dragTriggeredRef.current = false;
          setCanvasDragging(false);
        }}
      >
        <SceneContent
          points3D={points3D}
          edges={edges}
          clusters={clusters}
          autoRotateY={autoRotateY}
          hoverBob={hoverBob}
          referenceFrameMode={referenceFrameMode}
          showXZ={showXZ}
          showXY={showXY}
          showYZ={showYZ}
          showAxisX={showAxisX}
          showAxisY={showAxisY}
          showAxisZ={showAxisZ}
          showEdges={showEdges}
          edgeMode={edgeMode}
          selectedIndex={selectedIndex}
          secondarySelectedIndex={secondarySelectedIndex}
          coordOverlay={{
            leaderSvgRef,
            leaderHorizLineRef,
            leaderSlantLineRef,
            leaderHorizLine2Ref,
            leaderSlantLine2Ref,
            coordLabelRef,
            coordLabel2Ref,
            distanceLabelRef,
            distanceVertLineRef,
          }}
        />
      </Canvas>
    </div>
  );
}
