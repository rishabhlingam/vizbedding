import { useState } from 'react';

export function DataEntryPanel({ sentences, onAddSentence, onUpdateVisualization }) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const text = input.trim();
    if (text) {
      onAddSentence(text);
      setInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="data-entry-panel">
      <h3>Sentences</h3>
      <p className="sentence-count">{sentences.length} sentences loaded</p>
      <div className="sentence-list">
        {sentences.map((s, i) => (
          <div key={i} className="sentence-row">
            {s}
          </div>
        ))}
      </div>
      <div className="add-section">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a sentence..."
          rows={2}
        />
        <button onClick={handleAdd} className="btn-add">
          Add sentence
        </button>
        <button onClick={onUpdateVisualization} className="btn-update">
          Update visualization
        </button>
      </div>
    </div>
  );
}
