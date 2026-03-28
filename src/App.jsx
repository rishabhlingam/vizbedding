import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataEntryPanel } from './components/DataEntryPanel';
import { VisualizationPanel } from './components/VisualizationPanel';
import {
  computeEmbeddings,
  projectTo3D,
  getEdgesWithinDistance,
  limitEdgesPerVertex,
  DEFAULT_EDGE_MAX_DISTANCE,
  DEFAULT_MAX_EDGES_PER_VERTEX,
  cosineSimilarity,
} from './embedding/embeddingService';
import { SEED_SENTENCES } from './data/seedSentences';
import './App.css';

const MAX_USER_SENTENCES = 10;

export default function App() {
  const [userSentences, setUserSentences] = useState([]);
  const [points3D, setPoints3D] = useState([]);
  const [edges, setEdges] = useState([]);
  const [clustersByIndex, setClustersByIndex] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  const seedCount = SEED_SENTENCES.length;
  const seedSplit = Math.floor(seedCount / 2); // first half = Cluster A, second half = Cluster B

  const allSentences = useMemo(
    () => [...SEED_SENTENCES, ...userSentences],
    [userSentences]
  );

  const updateVisualization = useCallback(async () => {
    if (allSentences.length === 0) {
      setPoints3D([]);
      setEdges([]);
      setClustersByIndex([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setProgress({ status: 'loading' });
    try {
      const { embeddings } = await computeEmbeddings(allSentences, setProgress);
      if (embeddings.length === 0 || embeddings.length !== allSentences.length) {
        setPoints3D([]);
        setEdges([]);
        setClustersByIndex([]);
        setLoading(false);
        return;
      }
      const positions = projectTo3D(embeddings);
      const candidates = getEdgesWithinDistance(
        positions,
        DEFAULT_EDGE_MAX_DISTANCE,
        embeddings
      );
      const edgeList = limitEdgesPerVertex(
        candidates,
        positions,
        DEFAULT_MAX_EDGES_PER_VERTEX
      );

      // Cluster assignment for stable 2-cluster pedagogy:
      // - seeds are split by order into Cluster A / B
      // - user sentences are assigned by cosine similarity to the seed centroids
      const dim = embeddings[0].length;
      const mean = (start, end) => {
        const v = new Float32Array(dim);
        const count = end - start;
        if (count <= 0) return v;
        for (let i = start; i < end; i++) {
          const e = embeddings[i];
          for (let d = 0; d < dim; d++) v[d] += e[d];
        }
        for (let d = 0; d < dim; d++) v[d] /= count;
        // L2 normalize so cosine similarity is dot product.
        let norm = 0;
        for (let d = 0; d < dim; d++) norm += v[d] * v[d];
        norm = Math.sqrt(norm) || 1;
        for (let d = 0; d < dim; d++) v[d] /= norm;
        return v;
      };

      const centroidA = mean(0, seedSplit);
      const centroidB = mean(seedSplit, seedCount);

      const clusters = new Array(allSentences.length).fill(0);
      for (let i = 0; i < seedCount; i++) {
        clusters[i] = i < seedSplit ? 0 : 1;
      }
      for (let i = seedCount; i < allSentences.length; i++) {
        const e = embeddings[i];
        const simA = cosineSimilarity(e, centroidA);
        const simB = cosineSimilarity(e, centroidB);
        clusters[i] = simA >= simB ? 0 : 1;
      }

      setPoints3D(positions);
      setEdges(edgeList);
      setClustersByIndex(clusters);
    } catch (err) {
      setError(err.message);
      setPoints3D([]);
      setEdges([]);
      setClustersByIndex([]);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [allSentences, seedCount, seedSplit]);

  useEffect(() => {
    updateVisualization();
  }, [updateVisualization]);

  const handleAddSentence = (text) => {
    if (userSentences.length >= MAX_USER_SENTENCES) return;
    setUserSentences((prev) => [...prev, text.trim()]);
    setSelectedIndex(null);
  };

  const handleClear = () => {
    setUserSentences([]);
    setSelectedIndex(null);
  };

  const handleSelectSentence = (index) => {
    setSelectedIndex((prev) => (prev === index ? null : index));
  };

  const handleRemoveUserSentence = (combinedIndex) => {
    if (combinedIndex < seedCount) return; // seeds are fixed
    const userIndex = combinedIndex - seedCount;
    setUserSentences((prev) => prev.filter((_, i) => i !== userIndex));
    setSelectedIndex(null);
  };

  const sentencesMeta = useMemo(() => {
    return allSentences.map((text, i) => ({
      index: i,
      text,
      isSeed: i < seedCount,
      cluster: clustersByIndex[i] ?? 0,
    }));
  }, [allSentences, clustersByIndex, seedCount]);

  const tutorialSteps = useMemo(
    () => [
      {
        title: 'Welcome to VIZBEDDING',
        body: 'Each sentence becomes a point in 3D embedding space. Points are colored by which of the two seed clusters they belong to.',
      },
      {
        title: 'Add sentences',
        body: 'Use the panel on the right to add up to 10 user sentences. When you add a sentence, the visualization recomputes embeddings locally in your browser.',
      },
      {
        title: 'Select a sentence',
        body: 'Click a sentence card to highlight its embedding with a dotted ring. The (x, y, z) coordinates for that point appear near the ring.',
      },
      {
        title: 'Reset view',
        body: 'If you get lost in orientation, use “Reset view” on the visualization panel to return to the initial camera orientation.',
      },
    ],
    []
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">VIZBEDDING</h1>
        <button
          type="button"
          className="btn-tutorial"
          onClick={() => {
            setTutorialStep(0);
            setTutorialOpen(true);
          }}
        >
          Tutorial
        </button>
      </header>
      <main className="app-main">
        <section className="viz-section">
          <VisualizationPanel
            points3D={points3D}
            edges={edges}
            selectedIndex={selectedIndex}
            clusters={clustersByIndex}
          />
          {loading && (
            <div className="loading-overlay">
              {progress?.status === 'compute' ? (
                <p>Computing embeddings…</p>
              ) : progress?.progress !== undefined ? (
                <p>Downloading model: {Math.round(progress.progress)}%</p>
              ) : (
                <p>Loading model… (first run downloads ~23MB)</p>
              )}
            </div>
          )}
          {error && (
            <div className="error-overlay">
              <p>{error}</p>
            </div>
          )}
        </section>
        <aside className="panel-section">
          <DataEntryPanel
            sentencesMeta={sentencesMeta}
            seedCount={seedCount}
            userSentenceCount={userSentences.length}
            maxUserSentences={MAX_USER_SENTENCES}
            onAddSentence={handleAddSentence}
            onClear={handleClear}
            selectedIndex={selectedIndex}
            onSelectSentence={handleSelectSentence}
            onRemoveUserSentence={handleRemoveUserSentence}
          />
        </aside>
      </main>

      {tutorialOpen && (
        <div className="tutorial-backdrop" role="presentation" onClick={() => setTutorialOpen(false)}>
          <div
            className="tutorial-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Tutorial"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tutorial-header">
              <div className="tutorial-step">
                Step {tutorialStep + 1} / {tutorialSteps.length}
              </div>
              <button
                type="button"
                className="tutorial-close"
                aria-label="Close tutorial"
                onClick={() => setTutorialOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="tutorial-title">{tutorialSteps[tutorialStep]?.title}</div>
            <div className="tutorial-body">{tutorialSteps[tutorialStep]?.body}</div>
            <div className="tutorial-actions">
              <button
                type="button"
                className="tutorial-btn"
                disabled={tutorialStep === 0}
                onClick={() => setTutorialStep((s) => Math.max(0, s - 1))}
              >
                Back
              </button>
              <button
                type="button"
                className="tutorial-btn tutorial-btn--primary"
                onClick={() => {
                  if (tutorialStep >= tutorialSteps.length - 1) {
                    setTutorialOpen(false);
                    return;
                  }
                  setTutorialStep((s) => s + 1);
                }}
              >
                {tutorialStep >= tutorialSteps.length - 1 ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
