import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';

export default function ChatSearch({ messages, onJumpToMessage, onSearchQueryChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen && onSearchQueryChange) {
      onSearchQueryChange(''); // Clear highlight when closed
    }
  }, [isOpen, onSearchQueryChange]);

  // When query changes, find all matches
  useEffect(() => {
    if (onSearchQueryChange) {
      onSearchQueryChange(query);
    }

    if (!query.trim()) {
      setResults([]);
      setCurrentIndex(-1);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const matches = [];
    
    // Search all messages
    messages.forEach((msg) => {
      if (msg.content && msg.content.toLowerCase().includes(lowerQuery)) {
        matches.push(msg.id);
      }
    });

    setResults(matches);
    if (matches.length > 0) {
      setCurrentIndex(matches.length - 1); // Start at most recent (bottom)
      onJumpToMessage(matches[matches.length - 1]);
    } else {
      setCurrentIndex(-1);
    }
  }, [query, messages, onJumpToMessage]);

  const handleNext = () => {
    if (results.length === 0) return;
    // Next means moving down the page (newer messages, higher index)
    const newIdx = currentIndex < results.length - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(newIdx);
    onJumpToMessage(results[newIdx]);
  };

  const handlePrev = () => {
    if (results.length === 0) return;
    // Prev means moving up the page (older messages, lower index)
    const newIdx = currentIndex > 0 ? currentIndex - 1 : results.length - 1;
    setCurrentIndex(newIdx);
    onJumpToMessage(results[newIdx]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        handlePrev(); // Shift+Enter goes up
      } else {
        handleNext(); // Enter goes down
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
    }
  };

  if (!isOpen) {
    return (
      <button 
        className="icon-button" 
        onClick={() => setIsOpen(true)}
        title="Search (Cmd+F substitute)"
      >
        <Search size={20} />
      </button>
    );
  }

  return (
    <div className="chat-search-container">
      <div className="chat-search-input-wrapper">
        <Search size={14} className="search-icon-small" />
        <input 
          ref={inputRef}
          type="text"
          className="chat-search-input"
          placeholder="Search..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {results.length > 0 && (
          <span className="search-count">
            {currentIndex + 1} of {results.length}
          </span>
        )}
      </div>
      
      <div className="chat-search-controls">
        <button className="search-control-btn" onClick={handlePrev} disabled={results.length === 0} title="Previous match (Shift+Enter)">
          <ChevronUp size={16} />
        </button>
        <button className="search-control-btn" onClick={handleNext} disabled={results.length === 0} title="Next match (Enter)">
          <ChevronDown size={16} />
        </button>
        <div className="search-divider" />
        <button className="search-control-btn close" onClick={() => { setIsOpen(false); setQuery(''); }}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
