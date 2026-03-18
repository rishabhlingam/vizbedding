import { useState } from 'react';

export function DataEntryPanel({ sentences, onAddSentence, onClear }) {
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
      <button onClick={onClear} className="btn-clear">
        Clear viz
      </button>
      <h3>Sentences</h3>
      <p className="sentence-count">{sentences.length} sentences</p>
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
      </div>
    </div>
  );
}
