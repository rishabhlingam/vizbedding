import { pcaTo3D } from '../utils/pca.js';

import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = false;

let extractor = null;

let cache = new Map();
const CACHE_KEY = 'vizbedding_embeddings_xenova_all-MiniLM-L6-v2';

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cache = new Map(Object.entries(parsed));
    }
  } catch {
    // ignore cache read failures
  }
}

function saveCache() {
  try {
    const obj = Object.fromEntries(cache);
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    // ignore cache write failures
  }
}

export function getCachedEmbedding(sentence) {
  const key = sentence.trim().toLowerCase();
  const c = cache.get(key);
  if (c) return new Float32Array(c);
  return null;
}

export function setCachedEmbedding(sentence, embedding) {
  const key = sentence.trim().toLowerCase();
  cache.set(key, Array.from(embedding));
  saveCache();
}

async function loadModel(onProgress) {
  if (!extractor) {
    extractor = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      {
        progress_callback: (data) => {
          if (onProgress) onProgress(data);
        },
      }
    );
  }
  return extractor;
}

export async function computeEmbeddings(sentences, onProgress) {
  const unique = [...new Set(sentences.map((s) => s.trim()).filter(Boolean))];
  const toCompute = unique.filter((s) => !getCachedEmbedding(s));

  if (toCompute.length === 0) {
    const valid = sentences.map((s) => s.trim()).filter(Boolean);
    const all = valid.map((s) => getCachedEmbedding(s));
    return { embeddings: all, sentences: valid };
  }

  const model = await loadModel(onProgress);
  if (onProgress) onProgress({ status: 'compute' });

  const output = await model(toCompute, {
    pooling: 'mean',
    normalize: true,
  });

  const embeddings = output.tolist();
  toCompute.forEach((s, i) => setCachedEmbedding(s, embeddings[i]));

  const valid = sentences.map((s) => s.trim()).filter(Boolean);
  const all = valid.map((s) => getCachedEmbedding(s));
  return { embeddings: all, sentences: valid };
}

export function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

export function getNearestNeighbors(embeddings, k = 4) {
  const n = embeddings.length;
  const edges = [];
  for (let i = 0; i < n; i++) {
    const sims = embeddings.map((_, j) =>
      i === j ? -Infinity : cosineSimilarity(embeddings[i], embeddings[j])
    );
    // Take top-k nearest neighbors by similarity (self has -Inf so sorts last)
    const indices = sims
      .map((s, j) => ({ j, s }))
      .sort((a, b) => b.s - a.s)
      .slice(0, k)
      .filter((x) => x.j !== i)
      .map((x) => x.j);
    for (const j of indices) {
      if (i < j || !edges.some((e) => e[0] === j && e[1] === i)) {
        edges.push([i, j, sims[j]]);
      }
    }
  }
  return edges;
}

/** One edge per unordered pair (i, j), with cosine similarity as weight. */
export function getCompleteGraphEdges(embeddings) {
  const n = embeddings.length;
  const edges = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      edges.push([i, j, cosineSimilarity(embeddings[i], embeddings[j])]);
    }
  }
  return edges;
}

/**
 * Edges only between pairs closer than maxDistance in projected 3D (PCA space).
 * Lets clusters stand out instead of wiring every pair.
 */
export function getEdgesWithinDistance(positions, maxDistance, embeddings) {
  const n = positions.length;
  if (n < 2) return [];
  const mdSq = maxDistance * maxDistance;
  const edges = [];
  for (let i = 0; i < n; i++) {
    const pi = positions[i];
    for (let j = i + 1; j < n; j++) {
      const pj = positions[j];
      const dx = pi[0] - pj[0];
      const dy = pi[1] - pj[1];
      const dz = pi[2] - pj[2];
      if (dx * dx + dy * dy + dz * dz <= mdSq) {
        const w = embeddings
          ? cosineSimilarity(embeddings[i], embeddings[j])
          : 1;
        edges.push([i, j, w]);
      }
    }
  }
  return edges;
}

/**
 * From a candidate edge list, keep a subset so each vertex has at most
 * `maxPerVertex` incident edges. Prefers shorter edges (Euclidean distance in
 * `positions`, same space as getEdgesWithinDistance).
 *
 * Greedy: sort candidates by length ascending, add [i,j,w] only if
 * degree(i) < maxPerVertex and degree(j) < maxPerVertex.
 */
export function limitEdgesPerVertex(edges, positions, maxPerVertex) {
  if (!edges.length || maxPerVertex <= 0) return [];
  const n = positions.length;
  const degree = new Array(n).fill(0);

  const scored = edges.map(([i, j, w]) => {
    const pi = positions[i];
    const pj = positions[j];
    const dx = pi[0] - pj[0];
    const dy = pi[1] - pj[1];
    const dz = pi[2] - pj[2];
    const distSq = dx * dx + dy * dy + dz * dz;
    return { i, j, w, distSq };
  });
  scored.sort((a, b) => a.distSq - b.distSq);

  const out = [];
  for (const { i, j, w } of scored) {
    if (degree[i] < maxPerVertex && degree[j] < maxPerVertex) {
      out.push([i, j, w]);
      degree[i]++;
      degree[j]++;
    }
  }
  return out;
}

/** PCA-space cutoff; tune to show tighter or looser local neighborhoods. */
export const DEFAULT_EDGE_MAX_DISTANCE = 0.40;

/** Max incident edges per point after distance filtering. */
export const DEFAULT_MAX_EDGES_PER_VERTEX = 4;

export function projectTo3D(embeddings) {
  const arr = embeddings.map((e) => Array.from(e));
  return pcaTo3D(arr, 3);
}

loadCache();
