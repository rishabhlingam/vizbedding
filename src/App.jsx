import { useState, useEffect, useCallback } from 'react';
import { DataEntryPanel } from './components/DataEntryPanel';
import { VisualizationPanel } from './components/VisualizationPanel';
import {
  computeEmbeddings,
  projectTo3D,
  getNearestNeighbors,
} from './embedding/embeddingService';
import { SEED_SENTENCES } from './data/seedSentences';
import './App.css';

export default function App() {
  const [sentences, setSentences] = useState(SEED_SENTENCES);
  const [points3D, setPoints3D] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const updateVisualization = useCallback(async () => {
    if (sentences.length === 0) {
      setPoints3D([]);
      setEdges([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setProgress({ status: 'loading' });
    try {
      const { embeddings } = await computeEmbeddings(sentences, setProgress);
      if (embeddings.length === 0) {
        setPoints3D([]);
        setEdges([]);
        setLoading(false);
        return;
      }
      const positions = projectTo3D(embeddings);
      const edgeList = getNearestNeighbors(embeddings, 4);
      setPoints3D(positions);
      setEdges(edgeList);
    } catch (err) {
      setError(err.message);
      setPoints3D([]);
      setEdges([]);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [sentences]);

  useEffect(() => {
    updateVisualization();
  }, [updateVisualization]);

  const handleAddSentence = (text) => {
    setSentences((prev) => [...prev, text.trim()]);
  };

  const handleClear = () => {
    setSentences([]);
    setSelectedIndex(null);
  };

  const handleSelectSentence = (index) => {
    setSelectedIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">VIZBEDDING</h1>
      </header>
      <main className="app-main">
        <section className="viz-section">
          <VisualizationPanel points3D={points3D} edges={edges} selectedIndex={selectedIndex} />
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
            sentences={sentences}
            onAddSentence={handleAddSentence}
            onClear={handleClear}
            selectedIndex={selectedIndex}
            onSelectSentence={handleSelectSentence}
          />
        </aside>
      </main>
    </div>
  );
}
