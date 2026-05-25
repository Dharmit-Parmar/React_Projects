import React, { useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { Virtuoso } from 'react-virtuoso';
import ChatBubble from './ChatBubble';
import DateSeparator from './DateSeparator';

export default function ChatWindow({ messages, selfName, jumpDate, setJumpDate, jumpToMessageId, setJumpToMessageId, searchQuery }) {
  const virtuosoRef = useRef(null);

  // Pre-process messages into a flat list of items containing separators and messages
  const items = useMemo(() => {
    const flatList = [];
    let lastDateKey = null;

    messages.forEach((msg, index) => {
      const msgDateKey = msg.timestamp ? format(msg.timestamp, 'yyyy-MM-dd') : null;
      
      if (msgDateKey && msgDateKey !== lastDateKey) {
        flatList.push({
          type: 'date',
          id: `date-${msgDateKey}`,
          date: msg.timestamp
        });
        lastDateKey = msgDateKey;
      }

      let showSenderName = false;
      if (index === 0 || messages[index - 1].sender !== msg.sender || 
          (msgDateKey && format(messages[index - 1].timestamp, 'yyyy-MM-dd') !== msgDateKey)) {
        showSenderName = true;
      }

      flatList.push({
        type: 'message',
        id: msg.id,
        msg: msg,
        isSelf: msg.sender === selfName,
        showSenderName
      });
    });

    return flatList;
  }, [messages, selfName]);

  // Jump to Date effect
  useEffect(() => {
    if (jumpDate && virtuosoRef.current) {
      setTimeout(() => {
        const targetIndex = items.findIndex(
          item => item.type === 'date' && format(item.date, 'yyyy-MM-dd') === jumpDate
        );
        if (targetIndex !== -1 && virtuosoRef.current) {
          virtuosoRef.current.scrollToIndex({
            index: targetIndex,
            align: 'start',
            behavior: 'smooth'
          });
        }
      }, 50);
      setJumpDate(null);
    }
  }, [jumpDate, items, setJumpDate]);

  // Jump to Message effect (from Search)
  useEffect(() => {
    if (jumpToMessageId && virtuosoRef.current) {
      const targetIndex = items.findIndex(item => item.id === jumpToMessageId);
      if (targetIndex !== -1) {
        virtuosoRef.current.scrollToIndex({
          index: targetIndex,
          align: 'center',
          behavior: 'smooth'
        });
      }
      // We don't reset jumpToMessageId here because the search bar might need to stay active 
      // on the same ID if the user clicks next/prev rapidly.
    }
  }, [jumpToMessageId, items]);

  return (
    <div className="chat-window">
      <Virtuoso
        ref={virtuosoRef}
        className="chat-virtuoso"
        data={items}
        initialTopMostItemIndex={items.length > 0 ? items.length - 1 : 0}
        itemContent={(index, item) => {
          if (item.type === 'date') {
            return (
              <div data-date={format(item.date, 'yyyy-MM-dd')} style={{ paddingTop: index === 0 ? '20px' : '0' }}>
                <DateSeparator date={item.date} />
              </div>
            );
          } else {
            return (
              <div style={{ paddingBottom: index === items.length - 1 ? '20px' : '0' }}>
                <ChatBubble 
                  message={item.msg} 
                  isSelf={item.isSelf} 
                  showSenderName={item.showSenderName} 
                  searchQuery={searchQuery}
                />
              </div>
            );
          }
        }}
      />
    </div>
  );
}
