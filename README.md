# Vizbedding

**Vizbedding** is a small browser app for understanding how [sentence embeddings](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) work through 3D visualization. You don't need no API keys and you can even add your own sentences to the vizualization to see where it goes!

**Give it a try at -** [https://vizbedding.vercel.app/](https://vizbedding.vercel.app/)

## Preview

<video src="media/preview.mp4" controls playsinline width="100%"></video>

## Why?

Most embedding demos, if at all they exist, either need a backend or feel like black boxes. When I was getting my hands dirty with text embeddings, I wished I had a tool that would visualize them in a 3D space and be tangible that I can play with (because playing is the best form of learning). But there were none I could find, so I made it.

## What?

Vizbedding embeds text with the help of **[Transformers.js](https://huggingface.co/docs/transformers.js/index)**, then **L2-normalizes** the embedding vectors, and then uses **Principal Component Analysis (PCA)** to project them onto a 3D space. **[Three.js](https://threejs.org/)** shows the points and a small **similarity graph**, edges connect points that are close in the projected space, with cosine similarity on hover. Built-in sentences are grouped into two themed seed clusters `AI` and `Food` (I like both). You can also add your own sentences which get a color based on the the nearer cluster. There is also a short in-app tutorial so someone new to follow along.


Important to note thet neighborhoods in 3D space are suggestive and not a perfect picture of high-dimensional space.

## Technologies

- **React**
- **Vite**
- **Three.js**
- **Transformers.js** (`@xenova/transformers`)

## Features

- **Embeddings in the browser:** Uses Transformers.js with `Xenova/all-MiniLM-L6-v2`. No backend; no API keys.
- **3D visualization:** PCA-projected points, rotation, and orbit controls.
- **Similarity graph:** Edges are generated between nearby points in the 3D space.
- **Selection and comparison:** `click` on the sentence on the right panel to find where it in the visualization. `click` and `ctrl/⌘ + second click` on two sentences to shows Euclidean distance between the two points in 3D.
- **Add your own text:** Add up to 10 custom sentences and see where they get plot and how the 3D visualization change.
- **Tutorial:** Guided tour from the header (PCA, selection, rotation, controls, data entry).
- **Embedding cache:** Repeated sentences reuse vectors via `localStorage`.

## How to run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The first run downloads the model.

### Production build

```bash
npm run build
npm run preview
```

Static output is in `dist/`.

### Lint

```bash
npm run lint
```

Inference runs on the **main thread** for broad browser compatibility.
