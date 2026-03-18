import { useState, useEffect, useCallback } from 'react';
import { DataEntryPanel } from './components/DataEntryPanel';
import { VisualizationPanel } from './components/VisualizationPanel';
import { TooltipOverlay } from './components/TooltipOverlay';
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
  const [tooltip, setTooltip] = useState(null);
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
      const { embeddings, sentences: validSentences } = await computeEmbeddings(
        sentences,
        setProgress
      );
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

  const handleHoverPoint = (index, x, y) => {
    if (index == null) {
      setTooltip(null);
      return;
    }
    const content = sentences[index] || '';
    setTooltip({ x, y, content, sub: null, wrap: true });
  };

  const handleHoverEdge = (edge, x, y) => {
    if (!edge) {
      setTooltip(null);
      return;
    }
    const [i, j, sim] = edge;
    const s1 = sentences[i] || '';
    const s2 = sentences[j] || '';
    const content = `${s1.slice(0, 40)}${s1.length > 40 ? '…' : ''} ↔ ${s2.slice(0, 40)}${s2.length > 40 ? '…' : ''}`;
    const sub = `Cosine similarity: ${(sim * 100).toFixed(1)}%`;
    setTooltip({ x, y, content, sub });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">VIZBEDDING</h1>
      </header>
      <main className="app-main">
        <section className="viz-section">
          <VisualizationPanel
            points3D={points3D}
            edges={edges}
            sentences={sentences}
            onHoverPoint={handleHoverPoint}
            onHoverEdge={handleHoverEdge}
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
            sentences={sentences}
            onAddSentence={handleAddSentence}
            onUpdateVisualization={updateVisualization}
          />
        </aside>
      </main>
      <TooltipOverlay tooltip={tooltip} />
    </div>
  );
}
