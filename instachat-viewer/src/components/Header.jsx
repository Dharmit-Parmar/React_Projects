import React from 'react';
import { ArrowLeft, ArrowRightLeft } from 'lucide-react';
import JumpToDate from './JumpToDate';
import ChatSearch from './ChatSearch';

export default function Header({ otherName, onTogglePerspective, onReset, availableDates, onDateSelect, messages, onJumpToMessage, onSearchQueryChange }) {
  const avatarLetter = otherName ? otherName.charAt(0) : '?';

  return (
    <header className="chat-header">
      <div className="header-left">
        <button className="icon-button" onClick={onReset} title="Upload new file">
          <ArrowLeft size={20} />
        </button>
        <div className="header-avatar">{avatarLetter}</div>
        <h2 className="header-name">{otherName}</h2>
      </div>
      
      <div className="header-right">
        <ChatSearch 
          messages={messages} 
          onJumpToMessage={onJumpToMessage} 
          onSearchQueryChange={onSearchQueryChange} 
        />
        <button className="icon-button" onClick={onTogglePerspective} title="Switch View">
          <ArrowRightLeft size={20} />
        </button>
        <JumpToDate availableDates={availableDates} onDateSelect={onDateSelect} />
      </div>
    </header>
  );
}
