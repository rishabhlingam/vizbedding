import { useMemo, useState } from 'react';

export function DataEntryPanel({
  sentencesMeta,
  seedCount,
  userSentenceCount,
  maxUserSentences,
  onAddSentence,
  onClear,
  selectedIndex,
  onSelectSentence,
  onRemoveUserSentence,
}) {
  const [input, setInput] = useState('');

  const canAddMore = userSentenceCount < maxUserSentences;
  const addDisabled = !canAddMore;

  const countLabel = useMemo(() => {
    const total = seedCount + userSentenceCount;
    return `${total} / ${seedCount + maxUserSentences} sentences`;
  }, [seedCount, userSentenceCount, maxUserSentences]);

  const handleAdd = () => {
    if (!canAddMore) return;
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
      <button type="button" onClick={onClear} className="btn-clear">
        Clear viz
      </button>
      <h3>Sentences</h3>
      <p className="sentence-count">{countLabel}</p>
      <div className="sentence-list">
        {sentencesMeta.map((s) => (
          <div
            key={s.index}
            className={[
              'sentence-row',
              s.cluster === 0 ? 'sentence-row--cluster-a' : 'sentence-row--cluster-b',
              selectedIndex === s.index ? 'sentence-row--selected' : '',
            ].join(' ')}
            onClick={() => onSelectSentence?.(s.index)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelectSentence?.(s.index)}
          >
            <div className="sentence-row__text">{s.text}</div>
            {!s.isSeed && (
              <button
                type="button"
                className="btn-sentence-remove"
                aria-label="Remove sentence"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveUserSentence?.(s.index);
                }}
              >
                ×
              </button>
            )}
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
          disabled={addDisabled}
        />
        <button type="button" onClick={handleAdd} className="btn-add" disabled={addDisabled}>
          Add sentence
        </button>
      </div>
    </div>
  );
}
