import React, { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { format } from 'date-fns';

export default function ChatBubble({ message, isSelf, showSenderName, searchQuery }) {
  const [showTime, setShowTime] = useState(false);

  const handlers = useSwipeable({
    onSwipedLeft: () => { if (isSelf) setShowTime(true); else setShowTime(true); },
    onSwipedRight: () => { setShowTime(false); },
    trackMouse: false
  });

  const timeString = format(message.timestamp, 'p'); // e.g. 10:30 AM

  // Helper function to highlight text
  const renderHighlightedText = (text, query) => {
    if (!query || !query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="highlight">{part}</mark> 
        : part
    );
  };

  return (
    <div 
      className={`chat-bubble-wrapper ${isSelf ? 'self' : 'other'}`}
      {...handlers}
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
      {!isSelf && showSenderName && (
        <div className="sender-name">{message.sender}</div>
      )}
      
      <div className="bubble-content-row">
        {!isSelf && (
          <div className="avatar">
            {message.sender.charAt(0)}
          </div>
        )}

        <div className={`chat-bubble ${isSelf ? 'bubble-self' : 'bubble-other'}`}>
          <div className="message-text">
            {message.content.split('\n').map((line, i) => (
              <React.Fragment key={i}>
                {renderHighlightedText(line, searchQuery)}
                {i !== message.content.split('\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className={`timestamp-reveal ${showTime ? 'visible' : ''}`}>
          {timeString}
        </div>
      </div>
    </div>
  );
}
