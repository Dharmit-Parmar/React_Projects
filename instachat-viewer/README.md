# 📱 InstaChat Viewer

> Turn your exported Instagram DMs into a beautiful, WhatsApp-style chat UI — clean, readable, and interactive.

Instagram's "Download Your Data" export spits out a wall of unstyled HTML. **InstaChat Viewer** parses it and renders it as a modern messaging interface — right in your browser, with zero uploads to any server.

---

## ✨ Features

- **Drag & drop upload** — drop your `message_1.html` file directly onto the page
- **Instagram-accurate message order** — uses HTML document order, not timestamps, so same-minute messages are always correct
- **Bubble chat UI** — left/right layout with Instagram-style gradient bubbles
- **Date separators** — clean dividers between days
- **Timestamp reveal** — hover (desktop) or swipe left (mobile) on any bubble to see its exact time
- **Perspective toggle** — switch who is "you" and who is "them" with one click
- **Jump to Date calendar** — interactive calendar that highlights only the days you actually chatted; click any highlighted date to scroll there instantly
- **Auto-detects participants** — reads the file owner from the HTML title; falls back to a "Which one is you?" prompt if needed
- **Fully client-side** — your chat data never leaves your device

---

## 🚀 Getting Started

```bash
# Clone the repo
git clone https://github.com/your-username/instachat-viewer.git
cd instachat-viewer

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📥 How to Export Your Instagram DMs

1. Open Instagram → **Settings**
2. Go to **Your activity** → **Download your information**
3. Select **Messages** and choose **HTML** format
4. Download and unzip the file
5. Find your conversation inside `your_instagram_activity/messages/inbox/<conversation>/message_1.html`
6. Upload it to InstaChat Viewer

---

## 🛠 Tech Stack

| | |
|---|---|
| Framework | React (Vite) |
| Styling | Vanilla CSS |
| Parsing | Native `DOMParser` |
| Date handling | `date-fns` |
| Touch gestures | `react-swipeable` |
| Icons | `lucide-react` |

---

## 📸 Screenshot

> Upload your file and see your chat rendered beautifully in seconds.

---

## 🔒 Privacy

**No data ever leaves your browser.** The app runs entirely client-side using the `FileReader` API. No backend, no analytics, no storage.

---

*Built with ❤️ to make Instagram memories actually readable.*
