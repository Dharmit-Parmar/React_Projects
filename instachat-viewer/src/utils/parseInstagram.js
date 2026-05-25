import { parse } from 'date-fns';

export function parseInstagramHTML(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // Strategy 1: Only grab DIRECT CHILDREN of <main> that are message blocks.
  // This prevents picking up nested ._a6-g divs inside the header or other sections.
  let messageNodes = [];
  const mainEl = doc.querySelector('main');
  if (mainEl) {
    messageNodes = Array.from(mainEl.children).filter(el =>
      el.classList.contains('_a6-g') ||
      (el.classList.contains('pam') && el.classList.contains('uiBoxWhite'))
    );
  }

  // Strategy 2: If main not found, try all .pam.uiBoxWhite (but exclude those inside header/aside)
  if (messageNodes.length === 0) {
    messageNodes = Array.from(doc.querySelectorAll('.pam.uiBoxWhite')).filter(el => {
      let parent = el.parentElement;
      while (parent) {
        if (parent.tagName === 'HEADER' || parent.tagName === 'ASIDE') return false;
        parent = parent.parentElement;
      }
      return true;
    });
  }

  // Strategy 3: Structural fallback
  if (messageNodes.length === 0) {
    const allDivs = Array.from(doc.querySelectorAll('div'));
    messageNodes = allDivs.filter(div => {
      const heading = div.querySelector('h2') || div.querySelector('._a6-h');
      const time = div.querySelector('._a6-o');
      return heading && time;
    });
  }

  // *** CRITICAL: Record the HTML document order BEFORE any processing.
  // querySelectorAll guarantees document order (top-to-bottom).
  // Instagram exports newest messages first, so we number them in reverse:
  // htmlOrder=0 means the OLDEST message (last in HTML), htmlOrder=N means NEWEST (first in HTML).
  // We will then sort ascending by htmlOrder to display oldest→newest.
  const totalNodes = messageNodes.length;

  const messages = [];
  const senderSet = new Set();

  messageNodes.forEach((node, domIndex) => {
    // 1. Extract Sender
    let sender = 'Unknown';
    const senderNode = node.querySelector('h2._a6-h') || node.querySelector('h2') || node.querySelector('._a6-h');
    if (senderNode) {
      sender = senderNode.textContent.trim();
    }
    senderSet.add(sender);

    // 2. Extract Timestamp
    let timestampStr = '';
    const timeNode = node.querySelector('._a6-o');
    if (timeNode && timeNode.textContent) {
      timestampStr = timeNode.textContent.trim();
    }

    let timestamp = null;
    if (timestampStr) {
      // Try native parsing first
      let parsedTime = new Date(timestampStr);

      // If native parsing fails, try date-fns with known Instagram export formats
      if (isNaN(parsedTime)) {
        const cleanStr = timestampStr.replace(/,/g, '').replace(/\s+/g, ' ').trim();
        const formats = [
          'MMM d yyyy h:mm a',
          'MMM dd yyyy h:mm a',
          'MMMM d yyyy h:mm a',
          'MMM d yyyy H:mm',
          'd MMM yyyy h:mm a',
        ];

        for (const f of formats) {
          const pt = parse(cleanStr, f, new Date());
          if (!isNaN(pt)) {
            parsedTime = pt;
            break;
          }
        }
      }

      if (!isNaN(parsedTime)) {
        timestamp = parsedTime;
      }
    }

    // 3. Extract Content
    let content = '';
    const contentNode = node.querySelector('._a6-p') || (node.children.length > 1 ? node.children[1] : null);
    if (contentNode) {
      const textPieces = [];
      const extractText = (n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const t = n.textContent.trim();
          if (t) textPieces.push(t);
        } else if (n.nodeType === Node.ELEMENT_NODE) {
          n.childNodes.forEach(extractText);
        }
      };
      extractText(contentNode);
      content = textPieces.join('\n');
    }

    // 4. Handle message types for MVP
    let type = 'text';
    if (content.includes('You sent an attachment.')) {
      type = 'attachment';
      content = '📎 ' + content.replace('You sent an attachment.', '').trim();
    } else if (content.match(/Reacted.*to your message/)) {
      type = 'reaction';
      content = '💬 ' + content;
    }

    messages.push({
      // htmlOrder: 0 = first in HTML = newest. We invert so 0 = oldest.
      // This is the source-of-truth for ordering — never sort by timestamp.
      htmlOrder: totalNodes - 1 - domIndex,
      id: domIndex,
      sender,
      content,
      timestamp,
      type,
    });
  });

  // Sort ONLY by HTML position (oldest first). Never sort by timestamp —
  // Instagram only records minute-level precision, causing same-minute messages to lose their order.
  messages.sort((a, b) => a.htmlOrder - b.htmlOrder);

  const participants = Array.from(senderSet).filter(s => s !== 'Unknown');

  // Try to find the file owner from the <title> tag
  let assumedOwner = null;
  const titleNode = doc.querySelector('title');
  if (titleNode && participants.length >= 2) {
    const titleText = titleNode.textContent.trim();
    // Title contains the OTHER person's name; the file owner is the one NOT in the title
    const otherPerson = participants.find(p => titleText.includes(p) || p.includes(titleText));
    if (otherPerson) {
      assumedOwner = participants.find(p => p !== otherPerson);
    }
  }

  return {
    participants,
    messages,
    assumedOwner,
  };
}
