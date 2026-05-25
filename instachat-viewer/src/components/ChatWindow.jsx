import React, { useEffect, useRef } from 'react';
import { format } from 'date-fns';
import ChatBubble from './ChatBubble';
import DateSeparator from './DateSeparator';

export default function ChatWindow({ messages, selfName, jumpDate, setJumpDate }) {
  const containerRef = useRef(null);

  // Jump to Date effect
  useEffect(() => {
    if (jumpDate && containerRef.current) {
      const separator = containerRef.current.querySelector(`[data-date="${jumpDate}"]`);
      if (separator) {
        separator.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      // Reset jump date after scrolling so it can be re-triggered
      setJumpDate(null);
    }
  }, [jumpDate, setJumpDate]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (containerRef.current && !jumpDate) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages.length]); // Only on first load of these messages

  const elements = [];
  let lastDateKey = null;

  messages.forEach((msg, index) => {
    const msgDateKey = format(msg.timestamp, 'yyyy-MM-dd');
    
    // Add DateSeparator if day changed
    if (msgDateKey !== lastDateKey) {
      elements.push(<DateSeparator key={`date-${msgDateKey}`} date={msg.timestamp} />);
      lastDateKey = msgDateKey;
    }

    const isSelf = msg.sender === selfName;
    
    // Check if we need to show the sender name (only first in sequence)
    let showSenderName = false;
    if (index === 0 || messages[index - 1].sender !== msg.sender || format(messages[index - 1].timestamp, 'yyyy-MM-dd') !== msgDateKey) {
      showSenderName = true;
    }

    elements.push(
      <ChatBubble 
        key={msg.id} 
        message={msg} 
        isSelf={isSelf} 
        showSenderName={showSenderName} 
      />
    );
  });

  return (
    <div className="chat-window" ref={containerRef}>
      <div className="chat-content">
        {elements}
      </div>
    </div>
  );
}
