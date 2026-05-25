import { parse } from 'date-fns';

/**
 * Parses a single Instagram exported HTML file.
 * @param {string} htmlString - Raw HTML content
 * @param {number} fileIndex  - Index of this file among all uploaded files (0 = first uploaded).
 *                              Used as a tiebreaker when merging messages across files.
 * @returns {{ participants: string[], messages: object[], assumedOwner: string|null }}
 */
export function parseInstagramHTML(htmlString, fileIndex = 0) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');

  // Strategy 1: Direct children of <main> — prevents picking up nested ._a6-g in the header
  let messageNodes = [];
  const mainEl = doc.querySelector('main');
  if (mainEl) {
    messageNodes = Array.from(mainEl.children).filter(el =>
      el.classList.contains('_a6-g') ||
      (el.classList.contains('pam') && el.classList.contains('uiBoxWhite'))
    );
  }

  // Strategy 2: .pam.uiBoxWhite but exclude anything inside <header> or <aside>
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

  const totalNodes = messageNodes.length;
  const messages = [];
  const senderSet = new Set();

  messageNodes.forEach((node, domIndex) => {
    // 1. Sender
    let sender = 'Unknown';
    const senderNode =
      node.querySelector('h2._a6-h') ||
      node.querySelector('h2') ||
      node.querySelector('._a6-h');
    if (senderNode) sender = senderNode.textContent.trim();
    senderSet.add(sender);

    // 2. Timestamp
    let timestampStr = '';
    const timeNode = node.querySelector('._a6-o');
    if (timeNode?.textContent) timestampStr = timeNode.textContent.trim();

    let timestamp = null;
    if (timestampStr) {
      let parsedTime = new Date(timestampStr);
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
          if (!isNaN(pt)) { parsedTime = pt; break; }
        }
      }
      if (!isNaN(parsedTime)) timestamp = parsedTime;
    }

    // 3. Content
    let content = '';
    const contentNode =
      node.querySelector('._a6-p') ||
      (node.children.length > 1 ? node.children[1] : null);
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

    // 4. Message type
    let type = 'text';
    if (content.includes('You sent an attachment.')) {
      type = 'attachment';
      content = '📎 ' + content.replace('You sent an attachment.', '').trim();
    } else if (content.match(/Reacted.*to your message/)) {
      type = 'reaction';
      content = '💬 ' + content;
    }

    messages.push({
      // Within a file: htmlOrder 0 = oldest (last in HTML, first after invert).
      // Used as tertiary sort key when two messages in the same file share a timestamp.
      htmlOrder: totalNodes - 1 - domIndex,
      // fileIndex used as secondary sort key when two messages from different files share a timestamp.
      fileIndex,
      id: `f${fileIndex}-${domIndex}`,
      sender,
      content,
      timestamp,
      type,
    });
  });

  const participants = Array.from(senderSet).filter(s => s !== 'Unknown');

  // Detect file owner from <title>
  let assumedOwner = null;
  const titleNode = doc.querySelector('title');
  if (titleNode && participants.length >= 2) {
    const titleText = titleNode.textContent.trim();
    const otherPerson = participants.find(p => titleText.includes(p) || p.includes(titleText));
    if (otherPerson) {
      assumedOwner = participants.find(p => p !== otherPerson);
    }
  }

  return { participants, messages, assumedOwner };
}

/**
 * Merges results from multiple parsed files into a single sorted message array.
 *
 * Sort order (to preserve correctness across files):
 *   1. timestamp       — cross-file chronological ordering
 *   2. fileIndex       — tiebreaker: lower file index = earlier in conversation
 *   3. htmlOrder       — tiebreaker: within same file + same timestamp, preserve HTML sequence
 *
 * @param {Array} parsedFiles  — array of { participants, messages, assumedOwner }
 * @returns {{ participants: string[], messages: object[], assumedOwner: string|null, conflict: boolean }}
 */
export function mergeParseResults(parsedFiles) {
  if (parsedFiles.length === 0) return { participants: [], messages: [], assumedOwner: null, conflict: false };
  if (parsedFiles.length === 1) {
    const f = parsedFiles[0];
    // Single file: use pure htmlOrder (avoids timestamp-sort breaking same-minute sequences)
    const sorted = [...f.messages].sort((a, b) => a.htmlOrder - b.htmlOrder);
    return { participants: f.participants, messages: sorted, assumedOwner: f.assumedOwner, conflict: false };
  }

  // Collect all unique participant names across all files
  const allParticipants = new Set();
  parsedFiles.forEach(f => f.participants.forEach(p => allParticipants.add(p)));

  // Conflict: more than 2 unique names means files are from different conversations
  const uniqueParticipants = Array.from(allParticipants);
  const conflict = uniqueParticipants.length > 2;

  // Determine assumedOwner — take from whichever file detected it first
  const assumedOwner = parsedFiles.find(f => f.assumedOwner)?.assumedOwner || null;

  // Merge all messages
  const allMessages = parsedFiles.flatMap(f => f.messages);

  // Sort: timestamp → fileIndex → htmlOrder
  allMessages.sort((a, b) => {
    const tA = a.timestamp?.getTime() ?? 0;
    const tB = b.timestamp?.getTime() ?? 0;
    if (tA !== tB) return tA - tB;
    if (a.fileIndex !== b.fileIndex) return a.fileIndex - b.fileIndex;
    return a.htmlOrder - b.htmlOrder;
  });

  return {
    participants: uniqueParticipants,
    messages: allMessages,
    assumedOwner,
    conflict,
  };
}
