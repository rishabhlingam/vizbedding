# VIZBEDDING

**VIZBEDDING** is a small browser app for exploring [sentence embeddings](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2): each phrase becomes a vector, those vectors are projected into 3D for display, and you can inspect how similar different sentences are—without sending text to a server or configuring API keys.

**Live site:** [https://vizbedding.vercel.app/](https://vizbedding.vercel.app/)

<!-- Optional: add screenshots under e.g. `docs/screenshots/` and uncomment or adjust the lines below. -->

<!--
<p align="center">
  <img src="docs/screenshots/main-view.png" alt="Main view: 3D embedding cloud and sentence list" width="720" />
</p>
<p align="center">
  <img src="docs/screenshots/tutorial.png" alt="In-app tutorial overlay" width="360" />
  &nbsp;
  <img src="docs/screenshots/similarity.png" alt="Selecting sentences and similarity edges" width="360" />
</p>
-->

## Features

- **Embeddings in the browser** — Uses [Transformers.js](https://github.com/xenova/transformers.js) with `Xenova/all-MiniLM-L6-v2` (~23 MB on first load from CDN). No backend; no API keys.
- **3D visualization** — [Three.js](https://threejs.org/) + React Three Fiber: points in PCA-projected space, gentle rotation, orbit controls.
- **Two themed seed clusters** — Built-in sentences split between **tech / AI** and **food / cooking**; colors show which cluster each point is associated with (seed labels + centroid-based assignment for your own sentences).
- **Similarity graph** — Edges between nearby points in 3D (with per-vertex limits); hover shows **cosine similarity** between connected sentences.
- **Selection & comparison** — Click a sentence to highlight its point. **Ctrl**/**⌘** + click a second sentence to see the **Euclidean distance** between the two points in 3D.
- **Your own text** — Add up to 10 custom sentences, **Update visualization** refreshes embeddings; **Clear** removes only your additions (seeds stay).
- **Tutorial** — Guided tour from the header explains PCA coloring, selection, rotation, controls, and data entry.
- **Embedding cache** — Repeated sentences are reused via `localStorage` to avoid recomputation.

## How it works (short)

1. Each sentence is embedded with mean pooling and L2-normalized vectors (same family as common sentence-transformer usage).
2. All embedding vectors are projected to three dimensions with **PCA** (`src/utils/pca.js`) for visualization only—neighborhoods are suggestive, not exact high-dimensional geometry.
3. Point colors reflect **two clusters** derived from seed categories and centroid similarity for user text (see `App.jsx`), not k-means in 3D.
4. **Edges** are built from pairs that are close in the **projected** 3D space, then trimmed so each point has at most a few edges; edge tooltips use **cosine similarity** in embedding space.

## Quick start

Try the deployed app at [https://vizbedding.vercel.app/](https://vizbedding.vercel.app/), or run locally:

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The first run downloads the model; progress is shown in the UI.

### Production build

```bash
npm run build
npm run preview   # local preview of the production build
```

Static output is emitted to `dist/` (suitable for GitHub Pages, Netlify, Vercel, or any static host).

## Configuration

- **GitHub link in the app** — Set `GITHUB_REPO_URL` in `src/App.jsx` to your real repository URL so the header icon points to this repo.

## Tech stack

| Area | Choice |
|------|--------|
| UI | React 19, Vite 5 |
| 3D | three.js, @react-three/fiber, @react-three/drei |
| Embeddings | @xenova/transformers (feature-extraction pipeline) |

## Development

```bash
npm run lint
```

Inference runs on the **main thread** for broad browser compatibility (see comments in the codebase around worker limitations).

## License

No license file is present in this repository yet. Add a `LICENSE` file when you are ready to specify terms.
