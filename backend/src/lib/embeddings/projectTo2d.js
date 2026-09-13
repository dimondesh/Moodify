/**
 * PCA → t-SNE projection for embedding scatter maps.
 * Mirrors embedding-visual/main.py (normalize → PCA → t-SNE → 2D).
 */

function l2NormalizeRows(matrix) {
  return matrix.map((row) => {
    let norm = 0;
    for (let i = 0; i < row.length; i++) norm += row[i] * row[i];
    norm = Math.sqrt(norm);
    if (norm === 0) return row.slice();
    return row.map((v) => v / norm);
  });
}

function centerColumns(matrix) {
  const n = matrix.length;
  const d = matrix[0].length;
  const mean = new Array(d).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < d; j++) mean[j] += matrix[i][j];
  }
  for (let j = 0; j < d; j++) mean[j] /= n;
  return matrix.map((row) => row.map((v, j) => v - mean[j]));
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function matVec(A, v) {
  return A.map((row) => dot(row, v));
}

function norm2(v) {
  return Math.sqrt(dot(v, v));
}

function normalizeVec(v) {
  const n = norm2(v) || 1;
  return v.map((x) => x / n);
}

/** Top-k eigenvectors of symmetric PSD matrix (power iteration + deflation). */
function topEigen(symmetric, k, iters = 120) {
  const n = symmetric.length;
  const eigs = [];
  const A = symmetric.map((row) => row.slice());

  for (let comp = 0; comp < k; comp++) {
    let v = normalizeVec(
      Array.from({ length: n }, (_, i) => Math.sin(i * 12.9898 + comp) * 43758.5453 % 1),
    );
    let lambda = 0;
    for (let t = 0; t < iters; t++) {
      const Av = matVec(A, v);
      lambda = dot(v, Av);
      v = normalizeVec(Av);
    }
    eigs.push({ vector: v, value: lambda });
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        A[i][j] -= lambda * v[i] * v[j];
      }
    }
  }
  return eigs;
}

function pca(matrix, nComponents) {
  const n = matrix.length;
  const d = matrix[0].length;
  const k = Math.max(1, Math.min(nComponents, n - 1, d));
  const X = centerColumns(matrix);

  if (d > n) {
    const G = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const s = dot(X[i], X[j]);
        G[i][j] = s;
        G[j][i] = s;
      }
    }
    const eigs = topEigen(G, k);
    return X.map((_, i) =>
      eigs.map(({ vector, value }) => {
        const scale = value > 0 ? Math.sqrt(value) : 0;
        return scale * vector[i];
      }),
    );
  }

  const C = Array.from({ length: d }, () => new Array(d).fill(0));
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < d; a++) {
      for (let b = a; b < d; b++) {
        C[a][b] += X[i][a] * X[i][b];
      }
    }
  }
  for (let a = 0; a < d; a++) {
    for (let b = a; b < d; b++) {
      C[a][b] /= Math.max(1, n - 1);
      C[b][a] = C[a][b];
    }
  }
  const eigs = topEigen(C, k);
  return X.map((row) => eigs.map(({ vector }) => dot(row, vector)));
}

function pairwiseSquaredDistances(X) {
  const n = X.length;
  const D = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let s = 0;
      for (let k = 0; k < X[i].length; k++) {
        const diff = X[i][k] - X[j][k];
        s += diff * diff;
      }
      D[i][j] = s;
      D[j][i] = s;
    }
  }
  return D;
}

function binarySearchSigma(distances, i, perplexity) {
  const n = distances.length;
  const target = Math.log(perplexity);
  let lo = 1e-20;
  let hi = 1e10;
  let beta = 1; // 1 / (2 sigma^2)

  for (let iter = 0; iter < 64; iter++) {
    let sumP = 0;
    let sumPd = 0;
    const Prow = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const p = Math.exp(-distances[i][j] * beta);
      Prow[j] = p;
      sumP += p;
      sumPd += distances[i][j] * p;
    }
    if (sumP < 1e-12) {
      beta *= 0.5;
      continue;
    }
    let entropy = Math.log(sumP) + (beta * sumPd) / sumP;
    const diff = entropy - target;
    if (Math.abs(diff) < 1e-5) break;
    if (diff > 0) {
      lo = beta;
      beta = (beta + hi) / 2;
    } else {
      hi = beta;
      beta = (beta + lo) / 2;
    }
  }
  return beta;
}

function computeP(X, perplexity) {
  const n = X.length;
  const D = pairwiseSquaredDistances(X);
  const P = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    const beta = binarySearchSigma(D, i, perplexity);
    let sum = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const p = Math.exp(-D[i][j] * beta);
      P[i][j] = p;
      sum += p;
    }
    if (sum === 0) continue;
    for (let j = 0; j < n; j++) P[i][j] /= sum;
  }

  // Joint probabilities: (p_j|i + p_i|j) / (2n)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p = (P[i][j] + P[j][i]) / (2 * n);
      P[i][j] = p;
      P[j][i] = p;
    }
  }
  return P;
}

function tsne(X, { perplexity, iterations = 750, learningRate = 200 } = {}) {
  const n = X.length;
  if (n < 2) return X.map(() => [0, 0]);

  const perp = Math.min(perplexity, Math.max(2, n - 1));
  const P = computeP(X, perp);

  // PCA init (first 2 comps), scaled like sklearn
  let Y = X.map((row, i) => [
    (row[0] || 0) * 1e-4 + (i % 2 === 0 ? 1e-4 : -1e-4),
    (row[1] || 0) * 1e-4 + (i % 3 === 0 ? 1e-4 : -1e-4),
  ]);
  const gains = Array.from({ length: n }, () => [1, 1]);
  const iY = Array.from({ length: n }, () => [0, 0]);

  for (let iter = 0; iter < iterations; iter++) {
    const num = Array.from({ length: n }, () => new Array(n).fill(0));
    let sumNum = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = Y[i][0] - Y[j][0];
        const dy = Y[i][1] - Y[j][1];
        const val = 1 / (1 + dx * dx + dy * dy);
        num[i][j] = val;
        num[j][i] = val;
        sumNum += 2 * val;
      }
    }
    sumNum = Math.max(sumNum, 1e-12);

    const exaggeration = iter < 100 ? 12 : 1;
    const momentum = iter < 250 ? 0.5 : 0.8;
    const dY = Array.from({ length: n }, () => [0, 0]);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const q = Math.max(num[i][j] / sumNum, 1e-12);
        const mult = 4 * (exaggeration * P[i][j] - q) * num[i][j];
        dY[i][0] += mult * (Y[i][0] - Y[j][0]);
        dY[i][1] += mult * (Y[i][1] - Y[j][1]);
      }
    }

    for (let i = 0; i < n; i++) {
      for (let d = 0; d < 2; d++) {
        const sameSign = Math.sign(dY[i][d]) === Math.sign(iY[i][d]);
        gains[i][d] = Math.max(sameSign ? gains[i][d] * 0.8 : gains[i][d] + 0.2, 0.01);
        iY[i][d] = momentum * iY[i][d] - learningRate * gains[i][d] * dY[i][d];
        Y[i][d] += iY[i][d];
      }
    }

    let meanX = 0;
    let meanY = 0;
    for (let i = 0; i < n; i++) {
      meanX += Y[i][0];
      meanY += Y[i][1];
    }
    meanX /= n;
    meanY /= n;
    for (let i = 0; i < n; i++) {
      Y[i][0] -= meanX;
      Y[i][1] -= meanY;
    }
  }

  return Y;
}

/**
 * @param {number[][]} embeddings
 * @returns {{ x: number, y: number }[]}
 */
export function projectEmbeddingsTo2d(embeddings) {
  if (!embeddings.length) return [];
  if (embeddings.length === 1) return [{ x: 0, y: 0 }];

  const normalized = l2NormalizeRows(embeddings);
  const nPca = Math.min(50, normalized.length - 1, normalized[0].length);
  const reduced = pca(normalized, nPca);

  // Tiny catalogs: PCA-2D is enough and more stable than t-SNE.
  if (embeddings.length < 5) {
    return reduced.map((row) => ({ x: row[0] || 0, y: row[1] || 0 }));
  }

  const perplexity = Math.min(30, Math.max(2, Math.floor((embeddings.length - 1) / 3)));
  const projection = tsne(reduced, {
    perplexity,
    iterations: embeddings.length < 100 ? 750 : 1000,
    learningRate: Math.max(100, embeddings.length / 2),
  });

  return projection.map(([x, y]) => ({ x, y }));
}
