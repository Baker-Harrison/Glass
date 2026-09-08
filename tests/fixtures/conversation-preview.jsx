import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Conversation from "../../src/conversation.jsx";
import "../../src/style.css";
const started = Date.now();
const prompt = {
  role: "user",
  timestamp: started - 1500,
  content: [{ type: "text", text: "yo" }],
};
const response = {
  role: "assistant",
  timestamp: started - 1200,
  content: [
    {
      type: "thinking",
      thinking:
        "The user sent a casual greeting.\n\nI'll offer to help with their sample project.",
    },
    {
      type: "text",
      text: "Yo. What do you want to work on in the sample project?",
    },
  ],
  glassTiming: {
    startedAt: started - 1200,
    endedAt: started,
    thinking: { 0: { startedAt: started - 1200, endedAt: started - 200 } },
  },
};
function Preview() {
  const [messages, setMessages] = useState([prompt, response]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const stream = () => {
    const now = Date.now();
    setBusy(true);
    const first = {
      ...response,
      timestamp: now,
      content: [{ type: "thinking", thinking: "Checking the sample request…" }],
      glassTiming: { thinking: { 0: { startedAt: now } } },
    };
    setMessages([{ ...prompt, timestamp: now - 100 }, first]);
    setTimeout(() => {
      setMessages([
        { ...prompt, timestamp: now - 100 },
        {
          ...response,
          timestamp: now,
          glassTiming: {
            startedAt: now,
            endedAt: now + 1600,
            thinking: { 0: { startedAt: now, endedAt: now + 1100 } },
          },
        },
      ]);
      setBusy(false);
    }, 1600);
  };
  return (
    <>
      <header style={{ padding: 16, display: "flex", gap: 16 }}>
        <button onClick={stream} disabled={busy}>
          Replay stream
        </button>
        <span>Conversation UI fixture · synthetic content</span>
        <span role="status">{notice}</span>
      </header>
      <main style={{ maxWidth: 700, margin: "24px auto", padding: 20 }}>
        <Conversation
          messages={messages}
          busy={busy}
          onRetry={() => setNotice("Edit selected")}
          onFork={() => setNotice("Fork selected")}
          onOpenLink={() => {}}
        />
      </main>
    </>
  );
}
createRoot(document.getElementById("root")).render(<Preview />);
