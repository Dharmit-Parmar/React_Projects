import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import FileUpload from './components/FileUpload';
import Header from './components/Header';
import ChatWindow from './components/ChatWindow';
import ParticipantSelector from './components/ParticipantSelector';
import { parseInstagramHTML } from './utils/parseInstagram';
import './index.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selfName, setSelfName] = useState(null);
  const [jumpDate, setJumpDate] = useState(null);

  const handleFileParsed = (htmlContent) => {
    const data = parseInstagramHTML(htmlContent);
    setMessages(data.messages);
    setParticipants(data.participants);
    if (data.assumedOwner) {
      setSelfName(data.assumedOwner);
    }
  };

  const reset = () => {
    setMessages([]);
    setParticipants([]);
    setSelfName(null);
    setJumpDate(null);
  };

  const togglePerspective = () => {
    if (participants.length === 2 && selfName) {
      const newSelf = participants.find(p => p !== selfName);
      setSelfName(newSelf);
    }
  };

  const otherName = useMemo(() => {
    if (!selfName || participants.length < 2) return '';
    return participants.find(p => p !== selfName) || participants[0];
  }, [selfName, participants]);

  const availableDates = useMemo(() => {
    const dates = new Set();
    messages.forEach(msg => {
      dates.add(format(msg.timestamp, 'yyyy-MM-dd'));
    });
    return Array.from(dates);
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="app-container">
        <FileUpload onFileParsed={handleFileParsed} />
      </div>
    );
  }

  if (participants.length > 0 && !selfName) {
    return (
      <div className="app-container centered">
        <ParticipantSelector 
          participants={participants} 
          onSelect={setSelfName} 
        />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header 
        otherName={otherName} 
        onTogglePerspective={togglePerspective} 
        onReset={reset}
        availableDates={availableDates}
        onDateSelect={setJumpDate}
      />
      <ChatWindow 
        messages={messages} 
        selfName={selfName} 
        jumpDate={jumpDate} 
        setJumpDate={setJumpDate}
      />
    </div>
  );
}

export default App;
