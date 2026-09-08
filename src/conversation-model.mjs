export function textOf(message) {
  return typeof message.content === "string"
    ? message.content
    : (message.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
}
export function userText(message) {
  const text = textOf(message).replace(
    /^\[(?:Plan mode: inspect and plan only\.|Ask mode: answer without making changes\.)\]\n/,
    "",
  );
  const prefix = "Implement this approved plan. Update todos as you work.\n\n";
  if (text.startsWith(prefix)) {
    try {
      const plan = JSON.parse(text.slice(prefix.length));
      return `Build this plan: ${plan.title}`;
    } catch {}
  }
  return text;
}
const keyOf = (m) =>
  m.role === "toolResult" ? `tool:${m.toolCallId}` : `${m.role}:${m.timestamp}`;
export function applyMessageEvent(messages, event) {
  if (!["message_start", "message_update", "message_end"].includes(event.type))
    return messages;
  const message = event.message;
  const key = keyOf(message);
  let index = messages.findIndex((m) => keyOf(m) === key);
  if (index < 0) return [...messages, message];
  const next = [...messages];
  next[index] = message;
  return next;
}
export function groupTurns(messages) {
  const turns = [];
  let turn;
  for (const message of messages) {
    if (message.role === "user") {
      turn = { user: message, messages: [] };
      turns.push(turn);
    } else {
      if (!turn) {
        turn = { messages: [] };
        turns.push(turn);
      }
      turn.messages.push(message);
    }
  }
  return turns;
}

export function turnContent(messages) {
  const assistants = messages.filter((message) => message.role === "assistant");
  const last = assistants.at(-1);
  const hasTools = last?.content?.some?.((part) => part.type === "toolCall");
  const final = last && !hasTools ? last : null;
  const work = assistants.flatMap((message) => {
    const parts = Array.isArray(message.content)
      ? message.content
      : [{ type: "text", text: message.content || "" }];
    return parts.flatMap((part, index) => {
      if (part.type === "thinking" && part.thinking?.trim()) {
        const timing = message.glassTiming?.thinking?.[index];
        return [{ ...part, timing }];
      }
      return part.type === "toolCall" ||
        (part.type === "text" && part.text?.trim() && message !== final)
        ? [part]
        : [];
    });
  });
  return { work, final };
}

export function messageAge(timestamp, now = Date.now()) {
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (!minutes) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
