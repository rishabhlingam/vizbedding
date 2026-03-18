# VIZBEDDING

A minimal web app for exploring sentence embeddings in 3D. Compute embeddings in-browser using Transformers.js, visualize them as an interactive particle cloud, and inspect cosine similarities between sentences.

## Features

- **In-browser embeddings** using `Xenova/all-MiniLM-L6-v2` (no API keys, no backend)
- **3D visualization** with Three.js: points arranged by semantic similarity, with slow rotation
- **Similarity edges** between nearest neighbors; hover to see cosine similarity
- **Data entry panel** to add sentences and refresh the visualization
- **Main-thread inference** (reliable across browsers; worker loading had compatibility issues)

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173. On first load, the model (~23MB) downloads from CDN; progress is shown. Once loaded, seed sentences are embedded and visualized. Add new sentences and click **Update visualization** to refresh.

## Tech stack

- React (Vite)
- Three.js + React Three Fiber
- @xenova/transformers (loaded from CDN to avoid bundler/ONNX issues)
