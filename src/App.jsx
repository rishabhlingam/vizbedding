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
  const [tourActive, setTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);

  const sentenceListRef = useRef(null);
  const clearButtonRef = useRef(null);
  const textEntryRef = useRef(null);
  const vizPanelRef = useRef(null);
  const vizControlsRef = useRef(null);

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

  const tourSteps = useMemo(() => {
    return [
      {
        title: 'How VIZBEDDING works',
        body: 'Each sentence is turned into an embedding vector, then projected to 3D space using Principal Component Analysis (PCA) for visualization. Points are colored red or blue according to which of the two clusters (I like Food and Technology) they are closest to in embedding space (not in the 3D space).',
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
