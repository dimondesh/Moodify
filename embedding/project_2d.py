"""
PCA → t-SNE projection for embedding scatter maps.
Same pipeline as embedding-visual/main.py (normalize → PCA → t-SNE → 2D).
sklearn uses Barnes-Hut by default — fine for multi-k catalogs.
"""

from __future__ import annotations

import numpy as np
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
from sklearn.preprocessing import normalize


def project_embeddings_to_2d(embeddings: list[list[float]]) -> dict:
    """
    Returns {"points": [{"x": float, "y": float}, ...], "method": "pca"|"pca+tsne"}.
    """
    if not embeddings:
        return {"points": [], "method": "pca"}

    matrix = np.asarray(embeddings, dtype=np.float64)
    if matrix.ndim != 2 or matrix.shape[0] == 0:
        return {"points": [], "method": "pca"}

    n, _dim = matrix.shape
    if n == 1:
        return {"points": [{"x": 0.0, "y": 0.0}], "method": "pca"}

    normalized = normalize(matrix)

    n_pca = min(50, n - 1, normalized.shape[1])
    pca = PCA(n_components=n_pca, random_state=42)
    reduced = pca.fit_transform(normalized)

    # Tiny catalogs: PCA-2D is enough and more stable than t-SNE.
    if n < 5:
        return {
            "points": [{"x": float(row[0]), "y": float(row[1] if n_pca > 1 else 0.0)} for row in reduced],
            "method": "pca",
        }

    perplexity = min(30, max(2, n - 1))
    # sklearn TSNE default method="barnes_hut" for n large enough
    tsne = TSNE(
        n_components=2,
        perplexity=float(min(perplexity, n - 1)),
        init="pca",
        learning_rate="auto",
        random_state=42,
    )
    projection = tsne.fit_transform(reduced)

    return {
        "points": [{"x": float(x), "y": float(y)} for x, y in projection],
        "method": "pca+tsne",
    }


if __name__ == "__main__":
    # Two tight clusters in 8-d
    rng = np.random.default_rng(0)
    cluster_a = np.concatenate(
        [np.ones((8, 4)), np.zeros((8, 4))], axis=1
    ) + rng.normal(0, 0.05, (8, 8))
    cluster_b = np.concatenate(
        [np.zeros((8, 4)), np.ones((8, 4))], axis=1
    ) + rng.normal(0, 0.05, (8, 8))
    result = project_embeddings_to_2d(np.vstack([cluster_a, cluster_b]).tolist())
    assert result["method"] == "pca+tsne", result["method"]
    assert len(result["points"]) == 16
    xs = [p["x"] for p in result["points"]]
    assert max(xs) - min(xs) > 1e-6
    print("project_2d.selfcheck: ok")
