import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import FileUpload from './components/FileUpload';
import Header from './components/Header';
import ChatWindow from './components/ChatWindow';
import ParticipantSelector from './components/ParticipantSelector';
import { parseInstagramHTML, mergeParseResults } from './utils/parseInstagram';
import './index.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selfName, setSelfName] = useState(null);
  const [jumpDate, setJumpDate] = useState(null);
  const [jumpToMessageId, setJumpToMessageId] = useState(null);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [conflict, setConflict] = useState(false);
  const [conflictDismissed, setConflictDismissed] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  // Called with an array of { html, fileIndex } objects (one per uploaded file)
  const handleFilesParsed = (fileResults) => {
    setIsLoading(true);
    setLoadingText('Parsing HTML...');

    // Use setTimeout to allow the browser to paint the loading state
    setTimeout(() => {
      // Parse each file with its fileIndex so the merger can tiebreak correctly
      const parsedFiles = fileResults.map(({ html, fileIndex }) =>
        parseInstagramHTML(html, fileIndex)
      );

      setLoadingText('Merging messages...');

      setTimeout(() => {
        const merged = mergeParseResults(parsedFiles);

        setMessages(merged.messages);
        setParticipants(merged.participants);
        setConflict(merged.conflict);
        setConflictDismissed(false);

        // Set selfName if auto-detected
        if (merged.assumedOwner && merged.participants.includes(merged.assumedOwner)) {
          setSelfName(merged.assumedOwner);
        } else {
          setSelfName(null);
        }
        setIsLoading(false);
      }, 50);
    }, 50);
  };

  const reset = () => {
    setMessages([]);
    setParticipants([]);
    setSelfName(null);
    setJumpDate(null);
    setJumpToMessageId(null);
    setActiveSearchQuery('');
    setConflict(false);
    setConflictDismissed(false);
  };

  const togglePerspective = () => {
    if (participants.length >= 2 && selfName) {
      const remaining = participants.filter(p => p !== selfName);
      setSelfName(remaining[0]);
    }
  };

  const otherName = useMemo(() => {
    if (!selfName || participants.length < 2) return '';
    return participants.find(p => p !== selfName) || participants[1];
  }, [selfName, participants]);

  const availableDates = useMemo(() => {
    const dates = new Set();
    messages.forEach(msg => {
      if (msg.timestamp) dates.add(format(msg.timestamp, 'yyyy-MM-dd'));
    });
    return Array.from(dates);
  }, [messages]);

  // ── Upload screen ──────────────────────────────────────────────────────────
  if (messages.length === 0) {
    return (
      <div className="app-container">
        {isLoading && (
          <div className="loading-overlay">
            <Loader2 className="spinner" size={48} />
            <h2>{loadingText}</h2>
            <p>This may take a moment for large files...</p>
          </div>
        )}
        <FileUpload 
          onFilesParsed={handleFilesParsed} 
          onLoadingState={(text) => { setIsLoading(true); setLoadingText(text); }} 
        />
      </div>
    );
  }

  // ── Participant selection (fallback) ───────────────────────────────────────
  if (!selfName) {
    return (
      <div className="app-container centered">
        <ParticipantSelector
          participants={participants}
          onSelect={setSelfName}
        />
      </div>
    );
  }

  // ── Chat view ──────────────────────────────────────────────────────────────
  return (
    <div className="app-container">
      <Header
        otherName={otherName}
        onTogglePerspective={togglePerspective}
        onReset={reset}
        availableDates={availableDates}
        onDateSelect={setJumpDate}
        messages={messages}
        onJumpToMessage={setJumpToMessageId}
        onSearchQueryChange={setActiveSearchQuery}
      />

      {/* Conflict warning banner */}
      {conflict && !conflictDismissed && (
        <div className="conflict-banner">
          <AlertTriangle size={16} className="conflict-icon" />
          <span>
            <strong>Heads up:</strong> These files seem to be from different conversations
            ({participants.length} participants detected). Messages may be mixed.
          </span>
          <button className="conflict-dismiss" onClick={() => setConflictDismissed(true)}>
            <X size={14} />
          </button>
        </div>
      )}

      <ChatWindow
        messages={messages}
        selfName={selfName}
        jumpDate={jumpDate}
        setJumpDate={setJumpDate}
        jumpToMessageId={jumpToMessageId}
        setJumpToMessageId={setJumpToMessageId}
        searchQuery={activeSearchQuery}
      />
    </div>
  );
}

export default App;
