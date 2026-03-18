/**
 * Simple PCA implementation: project high-dim vectors to 3D using top 3 principal components.
 * Uses the covariance method (no SVD - just eigendecomposition of covariance matrix).
 */
export function pcaTo3D(vectors, nComponents = 3) {
  if (vectors.length === 0) return [];
  const n = vectors.length;
  const dim = vectors[0].length;

  if (n === 1) return [[0, 0, 0]];
  if (n === 2) {
    const a = vectors[0];
    const b = vectors[1];
    const d = Math.sqrt(
      a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0)
    ) || 1;
    return [
      [-d / 2, 0, 0],
      [d / 2, 0, 0],
    ];
  }

  // Center the data
  const mean = new Float32Array(dim);
  for (let i = 0; i < n; i++) {
    for (let d = 0; d < dim; d++) {
      mean[d] += vectors[i][d];
    }
  }
  for (let d = 0; d < dim; d++) mean[d] /= n;

  const centered = vectors.map((v) => {
    const c = new Float32Array(dim);
    for (let d = 0; d < dim; d++) c[d] = v[d] - mean[d];
    return c;
  });

  // Compute covariance matrix (dim x dim)
  const cov = Array.from({ length: dim }, () => new Float32Array(dim));
  for (let i = 0; i < dim; i++) {
    for (let j = i; j < dim; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += centered[k][i] * centered[k][j];
      }
      cov[i][j] = cov[j][i] = sum / (n - 1 || 1);
    }
  }

  // Power iteration for top eigenvectors with proper deflation
  const components = [];

  for (let c = 0; c < nComponents; c++) {
    let v = new Float32Array(dim);
    for (let d = 0; d < dim; d++) v[d] = Math.random() - 0.5;

    // Orthogonalize against previous components (deflation)
    for (let prev = 0; prev < c; prev++) {
      let dot = 0;
      for (let d = 0; d < dim; d++) dot += v[d] * components[prev][d];
      for (let d = 0; d < dim; d++) v[d] -= dot * components[prev][d];
    }

    for (let iter = 0; iter < 50; iter++) {
      const newV = new Float32Array(dim);
      for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
          newV[i] += cov[i][j] * v[j];
        }
      }
      // Orthogonalize against previous components
      for (let prev = 0; prev < c; prev++) {
        let dot = 0;
        for (let d = 0; d < dim; d++) dot += newV[d] * components[prev][d];
        for (let d = 0; d < dim; d++) newV[d] -= dot * components[prev][d];
      }
      let norm = 0;
      for (let d = 0; d < dim; d++) norm += newV[d] * newV[d];
      norm = Math.sqrt(norm) || 1;
      for (let d = 0; d < dim; d++) v[d] = newV[d] / norm;
    }
    components.push([...v]);
  }

  // Project centered data onto components
  return vectors.map((_, i) => {
    const p = [0, 0, 0];
    for (let c = 0; c < nComponents; c++) {
      for (let d = 0; d < dim; d++) {
        p[c] += centered[i][d] * components[c][d];
      }
    }
    return p;
  });
}
