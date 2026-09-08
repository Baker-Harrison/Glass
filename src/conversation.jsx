import React, { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronRight,
  ChevronDown,
  Copy,
  Check,
  GitFork,
  RotateCcw,
  Terminal,
  FileText,
  Globe,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import {
  groupTurns,
  textOf,
  userText,
  turnContent,
  messageAge,
} from "./conversation-model.mjs";
function Tool({ call, result }) {
  const [open, setOpen] = useState(false);
  if (call.name === "ask_question" && result && !result.isError) {
    let answers;
    try {
      answers = JSON.parse(textOf(result));
    } catch {}
    if (Array.isArray(answers))
      return (
        <div className="answered-questions">
          <small>Answer</small>
          {(call.arguments?.questions || []).map((question, index) => (
            <div key={index}>
              <p>{question.title}</p>
              <strong>{answers[index] || "Skipped"}</strong>
            </div>
          ))}
        </div>
      );
  }
  const Icon =
    call.name === "bash"
      ? Terminal
      : call.name === "browser"
        ? Globe
        : FileText;
  const description =
    call.arguments?.description ||
    call.arguments?.path ||
    call.arguments?.pattern ||
    call.arguments?.title ||
    call.arguments?.action ||
    { ask_question: "a question", update_todos: "to-dos", create_plan: "plan" }[
      call.name
    ] ||
    call.name;
  const verb =
    {
      read: "Read",
      grep: "Searched",
      find: "Found files",
      ls: "Listed",
      edit: "Edited",
      write: "Wrote",
      ask_question: "Asked",
      create_plan: "Created",
      update_todos: "Updated",
      browser: "Browser",
      bash: "Ran",
    }[call.name] || "Ran";
  return (
    <div className="work-tool">
      <button onClick={() => setOpen(!open)}>
        <Icon size={12} />
        <span>
          {result ? (result.isError ? "Failed" : verb) : "Running"}{" "}
          {description}
        </span>
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>
      {open && (
        <div className="work-tool-content">
          {call.arguments?.command && <pre>{call.arguments.command}</pre>}
          {result && <pre>{textOf(result)}</pre>}
          {Array.isArray(result?.content) &&
            result.content
              .filter((part) => part.type === "image")
              .map((part, index) => (
                <img
                  className="tool-screenshot"
                  key={index}
                  alt="Browser screenshot"
                  src={`data:${part.mimeType};base64,${part.data}`}
                />
              ))}
        </div>
      )}
    </div>
  );
}
function Thought({ part, working, now, components, defaultOpen = false }) {
  const [open, setOpen] = useState(null);
  const expanded = open ?? (working || defaultOpen);
  const timing = part.timing;
  const running = working && !timing?.endedAt;
  const elapsed =
    timing?.startedAt != null
      ? Math.max(
          1,
          Math.round(((timing.endedAt ?? now) - timing.startedAt) / 1000),
        )
      : null;
  return (
    <div className="thought-step">
      <button
        className="thought-summary"
        aria-expanded={expanded}
        onClick={() => setOpen(!expanded)}
      >
        <span>{running ? "Thinking" : "Thought"}</span>
        {elapsed != null && (
          <span className="thought-duration">{elapsed}s</span>
        )}
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>
      {expanded && (
        <div className="thought-content">
          <Markdown remarkPlugins={[remarkGfm]} components={components}>
            {part.thinking}
          </Markdown>
        </div>
      )}
    </div>
  );
}

function Turn({
  turn,
  working,
  onRetry,
  onFork,
  onOpenPlan,
  onOpenLink,
  onOpenImage,
  stopped,
  now,
}) {
  const markdownComponents = {
    a: ({ href, children }) => (
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault();
          if (/^https?:\/\//i.test(href || "")) onOpenLink?.(href);
        }}
      >
        {children}
      </a>
    ),
  };
  const [expanded, setExpanded] = useState(null),
    [copied, setCopied] = useState(false);
  const assistant = turn.messages.filter((m) => m.role === "assistant");
  const { work, final } = turnContent(turn.messages);
  const finalMessages = final ? [final] : [];
  const groupedWork = work.some((part) => part.type !== "thinking");
  const workExpanded = expanded ?? working;
  const feedbackKey = `glass:feedback:${turn.user?.timestamp ?? final?.timestamp}`;
  const [feedback, setFeedback] = useState(() => {
    try {
      return localStorage.getItem(feedbackKey) || null;
    } catch {
      return null;
    }
  });
  const rate = (value) => {
    const next = feedback === value ? null : value;
    setFeedback(next);
    try {
      if (next) localStorage.setItem(feedbackKey, next);
      else localStorage.removeItem(feedbackKey);
    } catch {}
  };
  const wasStopped =
    stopped ||
    assistant.at(-1)?.stopReason === "aborted" ||
    /aborted|cancelled/i.test(assistant.at(-1)?.errorMessage || "") ||
    (turn.messages.at(-1)?.isError &&
      /cancelled|aborted/i.test(textOf(turn.messages.at(-1))));
  const userParts = turn.user
    ? userText(turn.user).split("\n\nSelected browser element:\n")
    : [];
  let browserContext,
    fileContexts = [];
  const contextMarker = userParts[0]?.includes("\n\nFile context:\n")
    ? "\n\nFile context:\n"
    : "\n\nFile context: ";
  const contextParts = userParts[0]?.split(contextMarker);
  if (contextParts?.length > 1) {
    try {
      const parsed = JSON.parse(contextParts[1]);
      fileContexts = Array.isArray(parsed) ? parsed : [parsed];
      userParts[0] = contextParts[0];
    } catch {}
  }
  if (userParts[1]?.includes("\n\nFile context:\n")) {
    const parts = userParts[1].split("\n\nFile context:\n");
    userParts[1] = parts[0];
    try {
      fileContexts = JSON.parse(parts[1]);
    } catch {}
  }

  try {
    browserContext = JSON.parse(userParts[1]);
  } catch {}
  fileContexts = Array.isArray(fileContexts)
    ? fileContexts.filter((file) => file && typeof file.path === "string")
    : [];
  const start = turn.user?.timestamp;
  const end =
    assistant.at(-1)?.glassTiming?.endedAt ?? turn.messages.at(-1)?.timestamp;
  const seconds =
    start && end ? Math.max(1, Math.round((end - start) / 1000)) : null;
  const duration = seconds
    ? seconds >= 60
      ? `${Math.floor(seconds / 60)}m ${seconds % 60}s`
      : `${seconds}s`
    : null;
  return (
    <section className="turn">
      {turn.user && (
        <div className="user-bubble">
          <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {userParts[0]}
          </Markdown>
          {Array.isArray(turn.user.content) &&
            turn.user.content
              .filter((part) => part.type === "image")
              .map((part, index) => (
                <a
                  className="message-image"
                  key={index}
                  href={`data:${part.mimeType};base64,${part.data}`}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenImage?.(`data:${part.mimeType};base64,${part.data}`);
                  }}
                >
                  <img
                    alt="Attached browser screenshot"
                    src={`data:${part.mimeType};base64,${part.data}`}
                  />
                </a>
              ))}
          {fileContexts.map((file, index) => (
            <div className="message-context" key={index}>
              <FileText size={11} />
              {file.path?.split("/").pop()}
              {file.startLine
                ? `:${file.startLine}${file.endLine !== file.startLine ? `–${file.endLine}` : ""}`
                : ""}
            </div>
          ))}
          {browserContext && (
            <div className="message-context">
              <Globe size={11} />
              {browserContext.selector}
            </div>
          )}
          <button
            className="retry-message"
            title="Edit and resend"
            aria-label="Edit and resend"
            onClick={() =>
              onRetry(userParts[0], turn.user, browserContext, fileContexts)
            }
          >
            <RotateCcw size={12} />
          </button>
        </div>
      )}
      {groupedWork && (
        <div className="work-group">
          <button
            className={`work-summary ${working ? "streaming" : ""}`}
            aria-expanded={workExpanded}
            onClick={() => setExpanded(!workExpanded)}
          >
            {working
              ? "Working"
              : duration
                ? `Worked for ${duration}`
                : "Worked"}
            {workExpanded ? (
              <ChevronDown size={11} />
            ) : (
              <ChevronRight size={11} />
            )}
          </button>
          {workExpanded && (
            <div className="work-steps">
              {work.map((part, index) =>
                part.type === "text" ? (
                  <div className="work-commentary" key={index}>
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {part.text}
                    </Markdown>
                  </div>
                ) : part.type === "thinking" ? (
                  <Thought
                    key={index}
                    part={part}
                    components={markdownComponents}
                    working={working}
                    now={now}
                  />
                ) : (
                  <Tool
                    key={part.id}
                    call={part}
                    result={turn.messages.find(
                      (m) =>
                        m.role === "toolResult" && m.toolCallId === part.id,
                    )}
                  />
                ),
              )}
            </div>
          )}
        </div>
      )}
      {!groupedWork &&
        work
          .filter((part) => part.type === "thinking")
          .map((part, index) => (
            <Thought
              key={index}
              part={part}
              components={markdownComponents}
              working={working && !textOf(final || {}).trim()}
              now={now}
              defaultOpen
            />
          ))}
      {working && !work.length && !textOf(final || {}).trim() && (
        <div className="thinking-status">Thinking</div>
      )}
      {work
        .filter(
          (part) =>
            part.type === "toolCall" &&
            part.name === "create_plan" &&
            turn.messages.some(
              (message) =>
                message.role === "toolResult" &&
                message.toolCallId === part.id &&
                !message.isError,
            ),
        )
        .map((part) => (
          <button
            key={part.id}
            className="created-plan-card"
            onClick={onOpenPlan}
          >
            <FileText size={16} />
            <span>
              <small>Created Plan</small>
              <strong>{part.arguments?.title || "Plan"}</strong>
            </span>
            <ChevronRight size={12} />
          </button>
        ))}
      {finalMessages.map((message, index) => (
        <div className="assistant-answer" key={index}>
          <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {textOf(message)}
          </Markdown>
          {message.errorMessage && !wasStopped && (
            <div className="error">{message.errorMessage}</div>
          )}
        </div>
      ))}
      {!working && wasStopped && <div className="stopped-message">Stopped</div>}
      {!working && finalMessages.some((message) => textOf(message).trim()) && (
        <div className="message-actions">
          <button
            title="Helpful"
            aria-label="Helpful"
            aria-pressed={feedback === "up"}
            onClick={() => rate("up")}
          >
            <ThumbsUp size={13} />
          </button>
          <button
            title="Not helpful"
            aria-label="Not helpful"
            aria-pressed={feedback === "down"}
            onClick={() => rate("down")}
          >
            <ThumbsDown size={13} />
          </button>
          <button
            title="Copy message"
            aria-label="Copy message"
            onClick={async () => {
              await navigator.clipboard.writeText(
                finalMessages.map(textOf).join("\n\n"),
              );
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          <button
            title="Fork conversation"
            aria-label="Fork conversation"
            onClick={() => onFork(turn)}
          >
            <GitFork size={13} />
          </button>
          {end && (
            <time
              className="message-age"
              dateTime={new Date(end).toISOString()}
              title={new Date(end).toLocaleString()}
            >
              {messageAge(end, now)}
            </time>
          )}
        </div>
      )}
    </section>
  );
}
export default function Conversation({
  messages,
  busy,
  onRetry,
  onFork,
  onOpenPlan,
  onOpenLink,
  onOpenImage,
  stoppedTurns = [],
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), busy ? 500 : 30000);
    return () => clearInterval(timer);
  }, [busy]);
  const turns = groupTurns(messages);
  return turns.map((turn, index) => (
    <Turn
      key={turn.user?.timestamp ?? index}
      turn={turn}
      now={now}
      working={busy && index === turns.length - 1}
      stopped={stoppedTurns.includes(turn.user?.timestamp)}
      onRetry={onRetry}
      onFork={onFork}
      onOpenPlan={onOpenPlan}
      onOpenLink={onOpenLink}
      onOpenImage={onOpenImage}
    />
  ));
}
