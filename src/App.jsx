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
  const [secondarySelectedIndex, setSecondarySelectedIndex] = useState(null);
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
      setSelectedIndex(null);
      setSecondarySelectedIndex(null);
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
        setSelectedIndex(null);
        setSecondarySelectedIndex(null);
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
      setSelectedIndex(null);
      setSecondarySelectedIndex(null);
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
    setSecondarySelectedIndex(null);
  };

  const handleClear = () => {
    setUserSentences([]);
    setSelectedIndex(null);
    setSecondarySelectedIndex(null);
  };

  const handleSelectSentence = useCallback((index, event) => {
    const mod = event?.ctrlKey || event?.metaKey;
    if (mod) {
      setSecondarySelectedIndex((sec) => {
        if (selectedIndex == null) return sec;
        if (index === selectedIndex) return null;
        return sec === index ? null : index;
      });
      return;
    }
    setSelectedIndex((prev) => {
      if (prev === index) {
        setSecondarySelectedIndex(null);
        return null;
      }
      setSecondarySelectedIndex(null);
      return index;
    });
  }, [selectedIndex]);

  const handleRemoveUserSentence = (combinedIndex) => {
    if (combinedIndex < seedCount) return; // seeds are fixed
    const userIndex = combinedIndex - seedCount;
    setUserSentences((prev) => prev.filter((_, i) => i !== userIndex));
    setSelectedIndex(null);
    setSecondarySelectedIndex(null);
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
        body: 'Each sentence is turned into a vector with a small on-device model, then projected to 3D for display. Points are colored red or blue according to which of the two clusters they are closest to in embedding space (Technology vs Food).',
      },
      {
        title: 'Sentences panel',
        body: 'Use “Add sentence” to append up to 10 of your own lines; the app recomputes embeddings in the browser each time the list changes. (The first visit downloads the model). “Clear viz” removes only your added sentences and leaves the built-in seed list.',
      },
      {
        title: '3D view and controls',
        body: 'Drag on the plot to rotate the Visualization. Use the floating toggles to switch between plane-view vs. axis-view. Use the checkboxes to toggle the planes/axis, and turn edges on or off. The edges switch connects neayby points or points to the origin.',
      },
      {
        title: 'Selection and comparing points',
        body: 'Click a sentence row in the side panel to select it: a dashed ring marks the point, its (x, y, z) values appear on the right (colors match the axes), and a dashed leader links the label to the point. With one sentence already selected, Ctrl+click (Windows/Linux) or Cmd+click (Mac) a different row to add a second ring and a second coordinate readout; a vertical dashed line between those readouts shows the Euclidean distance between the two displayed positions. A normal click on another row picks a new primary and clears the comparison.',
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
            secondarySelectedIndex={secondarySelectedIndex}
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
            secondarySelectedIndex={secondarySelectedIndex}
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
