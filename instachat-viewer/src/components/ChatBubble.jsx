import React, { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';

export default React.memo(function ChatBubble({ message, isSelf, showSenderName, searchQuery }) {
  const [showTime, setShowTime] = useState(false);

  const handlers = useSwipeable({
    onSwipedLeft: () => setShowTime(true),
    onSwipedRight: () => setShowTime(false),
    trackMouse: false
  });

  const timeString = format(message.timestamp, 'p');

  // Prevent ReDoS (Regular Expression Denial of Service)
  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const renderHighlightedText = (text, query) => {
    // Sanitize content against XSS
    const cleanText = DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

    if (!query || !query.trim()) return cleanText;
    
    const safeQuery = escapeRegExp(query);
    const parts = cleanText.split(new RegExp(`(${safeQuery})`, 'gi'));
    
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
});
