import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DataEntryPanel } from './components/DataEntryPanel';
import { VisualizationPanel } from './components/VisualizationPanel';
import { TutorialTour } from './components/TutorialTour';
import {
  computeEmbeddings,
  projectTo3D,
  getEdgesWithinDistance,
  limitEdgesPerVertex,
  DEFAULT_EDGE_MAX_DISTANCE,
  DEFAULT_MAX_EDGES_PER_VERTEX,
  cosineSimilarity,
} from './embedding/embeddingService';
import {
  CATEGORY_FOOD,
  CATEGORY_TECH,
  SEED_CATEGORIES,
  SEED_SENTENCES,
} from './data/seedSentences';
import './App.css';

const MAX_USER_SENTENCES = 10;
const GITHUB_REPO_URL = 'https://github.com/rishabhlingam/vizbedding';

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
  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);

  const sentenceListRef = useRef(null);
  const clearButtonRef = useRef(null);
  const textEntryRef = useRef(null);
  const vizPanelRef = useRef(null);
  const vizControlsRef = useRef(null);

  const seedCount = SEED_SENTENCES.length;
  const seedIndicesByCategory = useMemo(() => {
    const tech = [];
    const food = [];
    for (let i = 0; i < seedCount; i++) {
      if (SEED_CATEGORIES[i] === CATEGORY_FOOD) food.push(i);
      else tech.push(i);
    }
    return { tech, food };
  }, [seedCount]);

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
      // - seed categories are explicit in seedSentences.js (not position-based)
      // - user sentences are assigned by cosine similarity to those centroids
      const dim = embeddings[0].length;
      const meanForIndices = (indices) => {
        const v = new Float32Array(dim);
        const count = indices.length;
        if (count <= 0) return v;
        for (const i of indices) {
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

      const centroidTech = meanForIndices(seedIndicesByCategory.tech);
      const centroidFood = meanForIndices(seedIndicesByCategory.food);

      const clusters = new Array(allSentences.length).fill(0);
      for (let i = 0; i < seedCount; i++) {
        clusters[i] = SEED_CATEGORIES[i] === CATEGORY_FOOD ? CATEGORY_FOOD : CATEGORY_TECH;
      }
      for (let i = seedCount; i < allSentences.length; i++) {
        const e = embeddings[i];
        const simTech = cosineSimilarity(e, centroidTech);
        const simFood = cosineSimilarity(e, centroidFood);
        clusters[i] = simTech >= simFood ? CATEGORY_TECH : CATEGORY_FOOD;
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
  }, [allSentences, seedCount, seedIndicesByCategory]);

  useEffect(() => {
    updateVisualization();
  }, [updateVisualization]);

  const handleAddSentence = (text) => {
    if (userSentences.length >= MAX_USER_SENTENCES) return;
    setUserSentences((prev) => [...prev, text.trim()]);
    setSelectedIndex(null);
    setSecondarySelectedIndex(null);

    if (tourActive && tourStepIndex === 5) {
      setTourStepIndex((s) => Math.min(s + 1, 6));
    }
  };

  const handleClear = () => {
    setUserSentences([]);
    setSelectedIndex(null);
    setSecondarySelectedIndex(null);

    if (tourActive && tourStepIndex === 6) {
      closeTour();
    }
  };

  const handleSelectSentence = useCallback((index, event) => {
    const mod = event?.ctrlKey || event?.metaKey;
    if (mod) {
      if (selectedIndex == null) return;
      const nextSecondary =
        index === selectedIndex
          ? null
          : secondarySelectedIndex === index
            ? null
            : index;
      setSecondarySelectedIndex(nextSecondary);
      if (tourActive && tourStepIndex === 2 && nextSecondary != null) {
        setTourStepIndex((s) => Math.min(s + 1, 6));
      }
      return;
    }

    const nextPrimary = selectedIndex === index ? null : index;
    setSelectedIndex(nextPrimary);
    setSecondarySelectedIndex(null);
    if (tourActive && tourStepIndex === 1 && nextPrimary != null) {
      setTourStepIndex((s) => Math.min(s + 1, 6));
    }
  }, [secondarySelectedIndex, selectedIndex, tourActive, tourStepIndex]);

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

  const displaySentencesMeta = useMemo(() => {
    const seeds = sentencesMeta.slice(0, seedCount);
    const users = sentencesMeta.slice(seedCount);
    const techSeeds = [];
    const foodSeeds = [];
    for (let i = 0; i < seeds.length; i++) {
      if (SEED_CATEGORIES[i] === CATEGORY_FOOD) foodSeeds.push(seeds[i]);
      else techSeeds.push(seeds[i]);
    }
    const interleavedSeeds = [];
    const maxLen = Math.max(techSeeds.length, foodSeeds.length);
    for (let i = 0; i < maxLen; i++) {
      if (techSeeds[i]) interleavedSeeds.push(techSeeds[i]);
      if (foodSeeds[i]) interleavedSeeds.push(foodSeeds[i]);
    }
    return [...interleavedSeeds, ...users];
  }, [seedCount, sentencesMeta]);

  const tourSteps = useMemo(() => {
    return [
      {
        title: 'How VIZBEDDING works',
        body: 'Each sentence is turned into an embedding vector, then projected to 3D space using Principal Component Analysis (PCA) for visualization. Points are colored red or blue according to which of the two clusters (I like Food and AI) they are closest to in embedding space (not in the 3D space).',
        placement: 'between',
        targets: [sentenceListRef, vizPanelRef],
        primaryActionLabel: 'Next',
      },
      {
        title: 'Pick a sentence',
        body: 'Click on any of the sentence to find its embedding in the 3D visualization',
        placement: 'overVizLeft',
        targets: [sentenceListRef],
        primaryActionLabel: 'Next',
      },
      {
        title: 'Compare two sentences',
        body: 'Now ctrl/cmd + click on another sentence to get the Euclidean distance between the two points.',
        placement: 'overVizLeft',
        targets: [sentenceListRef],
        primaryActionLabel: 'Next',
      },
      {
        title: 'Rotate the plot',
        body: 'Click and drag on the visualization panel to rotate the it.',
        placement: 'vizTopRight',
        targets: [vizPanelRef],
        primaryActionLabel: 'Next',
      },
      {
        title: 'Controls',
        body: 'Use the above switched to toggle between different views',
        placement: 'belowTarget',
        targets: [vizControlsRef],
        primaryActionLabel: 'Next',
      },
      {
        title: 'Add your own sentences',
        body: 'Type in your sentences and press enter or Add sentence button to add your text to the visualization. For best results, use short phrases relevant to the two categories. You can add up to 10 sentences.',
        placement: 'leftOfTarget',
        targets: [textEntryRef],
        primaryActionLabel: 'Next',
      },
      {
        title: 'Clear your sentences',
        body: 'Press the Clear Viz Button to remove the sentences you added from the visualization.',
        placement: 'leftOfTarget',
        targets: [clearButtonRef],
        primaryActionLabel: 'Finish',
      },
    ];
  }, []);

  const closeTour = useCallback(() => {
    setTourActive(false);
    setTourStepIndex(0);
  }, []);

  const goNext = useCallback(() => {
    setTourStepIndex((s) => {
      const next = s + 1;
      if (next >= tourSteps.length) {
        setTourActive(false);
        return 0;
      }
      return next;
    });
  }, [tourSteps.length]);

  const goBack = useCallback(() => {
    setTourStepIndex((s) => Math.max(0, s - 1));
  }, []);

  const onTutorialAction = useCallback((type) => {
    // Steps that can auto-advance from VisualizationPanel:
    // - Step 4 (index 3): drag rotate
    // - Step 5 (index 4): controls interaction
    if (!tourActive) return;
    if (tourStepIndex === 3 && type === 'drag') goNext();
    if (tourStepIndex === 4 && type === 'controls') goNext();
  }, [goNext, tourActive, tourStepIndex]);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">VIZBEDDING</h1>
        <div className="app-header-actions">
          <button
            type="button"
            className="btn-tutorial"
            onClick={() => {
              setTourStepIndex(0);
              setTourActive(true);
            }}
          >
            Tutorial
          </button>
          <a
            className="btn-github"
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open GitHub repository"
            title="Open GitHub repository"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path
                fill="currentColor"
                d="M8 0C3.58 0 0 3.58 0 8a8.01 8.01 0 0 0 5.47 7.59c.4.07.55-.17.55-.38
                   0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                   -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07
                   -.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2
                   -.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 4 0c1.53-1.04 2.2-.82
                   2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75
                   -3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01
                   8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
              />
            </svg>
          </a>
        </div>
      </header>
      <main className="app-main">
        <section className="viz-section">
          <VisualizationPanel
            points3D={points3D}
            edges={edges}
            selectedIndex={selectedIndex}
            secondarySelectedIndex={secondarySelectedIndex}
            clusters={clustersByIndex}
            panelRef={vizPanelRef}
            controlsRef={vizControlsRef}
            onTutorialAction={onTutorialAction}
            tutorialActive={tourActive}
            tutorialStepIndex={tourStepIndex}
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
            sentencesMeta={displaySentencesMeta}
            seedCount={seedCount}
            userSentenceCount={userSentences.length}
            maxUserSentences={MAX_USER_SENTENCES}
            onAddSentence={handleAddSentence}
            onClear={handleClear}
            selectedIndex={selectedIndex}
            secondarySelectedIndex={secondarySelectedIndex}
            onSelectSentence={handleSelectSentence}
            onRemoveUserSentence={handleRemoveUserSentence}
            sentenceListRef={sentenceListRef}
            clearButtonRef={clearButtonRef}
            textEntryRef={textEntryRef}
          />
        </aside>
      </main>

      <TutorialTour
        active={tourActive}
        step={tourStepIndex}
        totalSteps={tourSteps.length}
        targets={tourSteps[tourStepIndex]?.targets}
        placement={tourSteps[tourStepIndex]?.placement}
        title={tourSteps[tourStepIndex]?.title}
        body={tourSteps[tourStepIndex]?.body}
        primaryActionLabel={tourSteps[tourStepIndex]?.primaryActionLabel}
        showBack={tourStepIndex > 0}
        onNext={goNext}
        onBack={goBack}
        onClose={closeTour}
      />
    </div>
  );
}
