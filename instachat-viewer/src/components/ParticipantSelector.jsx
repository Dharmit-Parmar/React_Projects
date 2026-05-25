import React from 'react';

export default function ParticipantSelector({ participants, onSelect }) {
  return (
    <div className="participant-selector">
      <h2>Which one is you?</h2>
      <p>We couldn't automatically determine who you are in this conversation.</p>
      <div className="buttons">
        {participants.map(p => (
          <button key={p} className="btn-primary" onClick={() => onSelect(p)}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
