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
  } catch (_) {}
}

function saveCache() {
  try {
    const obj = Object.fromEntries(cache);
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch (_) {}
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
    // Take top-k nearest neighbors by similarity (always show some edges)
    const indices = sims
      .map((s, j) => ({ j, s }))
      .sort((a, b) => b.s - a.s)
      .slice(1, k + 1)
      .map((x) => x.j);
    for (const j of indices) {
      if (i < j || !edges.some((e) => e[0] === j && e[1] === i)) {
        edges.push([i, j, sims[j]]);
      }
    }
  }
  return edges;
}

export function projectTo3D(embeddings) {
  const arr = embeddings.map((e) => Array.from(e));
  return pcaTo3D(arr, 3);
}

loadCache();
