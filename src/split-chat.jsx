import React, { useEffect, useRef, useState } from "react";
import { X, ArrowUp, Square, Plus, FileText } from "lucide-react";
import Conversation from "./conversation.jsx";
import ModelPicker from "./model-picker.jsx";
import Question from "./question.jsx";
import PlanPane from "./plan-pane.jsx";
import { applyMessageEvent } from "./conversation-model.mjs";
const api = (name, args) => window.glass.invoke(name, args);
export default function SplitChat({
  initialId,
  history,
  models,
  project,
  file,
  onClose,
  onSelect,
  onRefresh,
  onOpenLink,
  onOpenImage,
  onOverlayChange,
}) {
  const [id, setId] = useState(initialId || null),
    [messages, setMessages] = useState([]),
    [mode, setMode] = useState("agent"),
    [model, setModel] = useState(models[0]?.id || ""),
    [effort, setEffort] = useState("medium"),
    [busy, setBusy] = useState(false),
    [draft, updateDraft] = useState(() => {
      try {
        return (
          JSON.parse(localStorage.getItem("glass.splitDrafts.v1") || "{}")[
            initialId || "new:" + project
          ] || ""
        );
      } catch {
        return "";
      }
    }),
    [error, setError] = useState(""),
    [question, setQuestion] = useState(null),
    [plan, setPlan] = useState(null),
    [showPlan, setShowPlan] = useState(false),
    [queued, setQueued] = useState([]),
    [editing, setEditing] = useState(null),
    [context, setContext] = useState(null);
  const active = useRef(id),
    bottom = useRef(null),
    input = useRef(null),
    following = useRef(true),
    sending = useRef(false),
    loaded = useRef(false),
    opening = useRef(0),
    beforeEdit = useRef(null),
    draftRef = useRef(draft);
  draftRef.current = draft;
  const readDrafts = () => {
    try {
      return JSON.parse(localStorage.getItem("glass.splitDrafts.v1") || "{}");
    } catch {
      return {};
    }
  };
  const setDraft = (value) => {
    const next = typeof value === "function" ? value(draftRef.current) : value;
    draftRef.current = next;
    const drafts = readDrafts();
    drafts[active.current || "new:" + project] = next;
    localStorage.setItem("glass.splitDrafts.v1", JSON.stringify(drafts));
    updateDraft(next);
  };
  const run = async (fn) => {
    try {
      setError("");
      return await fn();
    } catch (error) {
      setError(
        error.message.replace(
          /^Error invoking remote method '[^']+': Error: /,
          "",
        ),
      );
    }
  };
  const apply = (result) => {
    active.current = result.id;
    setId(result.id);
    onSelect(result.id);
    setMessages(result.messages);
    setMode(result.mode);
    setModel(result.modelId);
    setEffort(result.thinkingLevel || "medium");
    setBusy(!!result.busy);
    setQuestion(result.question || null);
    setPlan(result.plan || null);
    setQueued(result.queued || []);
    setShowPlan(false);
  };
  const open = async (next) =>
    run(async () => {
      const revision = ++opening.current;
      setEditing(null);
      beforeEdit.current = null;
      setContext(null);
      following.current = true;
      if (!next) {
        active.current = null;
        setId(null);
        onSelect(null);
        setMessages([]);
        setQuestion(null);
        setPlan(null);
        setQueued([]);
        setBusy(false);
        updateDraft(readDrafts()["new:" + project] || "");
        return;
      }
      const result = await api("agent:create", { id: next });
      if (revision !== opening.current) return;
      apply(result);
      updateDraft(readDrafts()[next] || "");
      await api("conversation:update", { id: next, read: true });
      onRefresh();
    });
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    if (
      initialId &&
      history.some((item) => item.id === initialId && item.cwd === project)
    )
      void open(initialId);
    else void open(null);
  }, []);
  useEffect(
    () =>
      window.glass.subscribe((event) => {
        if (event.sessionId !== active.current) return;
        if (event.type === "session_settings") {
          if (event.mode) setMode(event.mode);
          if (event.modelId) setModel(event.modelId);
          if (event.thinkingLevel) setEffort(event.thinkingLevel);
        }
        if (event.type === "question") setQuestion(event);
        if (["question_cancelled", "question_answered"].includes(event.type))
          setQuestion(null);
        if (event.type === "plan") {
          setPlan(event.plan);
          if (event.created) setShowPlan(true);
        }
        if (event.type === "error") {
          setError(event.message);
          setBusy(false);
        }
        if (event.type === "agent_event") {
          const e = event.event;
          if (
            ["message_start", "message_update", "message_end"].includes(e.type)
          )
            setMessages((value) => applyMessageEvent(value, e));
          if (e.type === "agent_start") setBusy(true);
          if (e.type === "agent_end") {
            setBusy(false);
            void api("conversation:update", {
              id: active.current,
              read: true,
            }).then(onRefresh);
          }
          if (e.type === "queue_update")
            setQueued([...e.steering, ...e.followUp]);
        }
      }),
    [],
  );
  useEffect(() => {
    if (following.current)
      bottom.current?.scrollIntoView({ behavior: "instant" });
  }, [messages, question]);
  useEffect(() => () => onOverlayChange(false), []);
  const send = () =>
    run(async () => {
      if (!draft.trim() || sending.current) return;
      sending.current = true;
      try {
        let current = active.current;
        const wasNew = !current;
        if (editing) {
          const result = await api("agent:fork", {
            id: current,
            timestamp: editing,
            before: true,
          });
          const drafts = readDrafts();
          drafts[current] = beforeEdit.current?.draft || "";
          localStorage.setItem("glass.splitDrafts.v1", JSON.stringify(drafts));
          apply(result);
          current = result.id;
          setEditing(null);
          beforeEdit.current = null;
        }
        if (!current) {
          const result = await api("agent:create", { mode, modelId: model });
          apply(result);
          current = result.id;
          await api("agent:model", { id: current, thinkingLevel: effort });
        }
        const text =
          draft +
          (context ? "\n\nFile context:\n" + JSON.stringify([context]) : "");
        await api("agent:prompt", { id: current, text });
        if (wasNew) {
          const drafts = readDrafts();
          delete drafts["new:" + project];
          localStorage.setItem("glass.splitDrafts.v1", JSON.stringify(drafts));
        }
        setDraft("");
        setContext(null);
        setBusy(true);
        following.current = true;
        onRefresh();
      } finally {
        sending.current = false;
      }
    });
  return (
    <section className="chat secondary-chat" aria-label="Split conversation">
      <div className="chat-toolbar">
        <select
          aria-label="Split conversation"
          value={id || ""}
          onChange={(event) => open(event.target.value)}
        >
          <option value="">New conversation</option>
          {history
            .filter((item) => item.cwd === project && !item.archived)
            .map((item) => (
              <option value={item.id} key={item.id}>
                {item.title}
              </option>
            ))}
        </select>
        <button aria-label="New split conversation" onClick={() => open(null)}>
          <Plus size={13} />
        </button>
        <button aria-label="Close split conversation" onClick={onClose}>
          <X size={13} />
        </button>
      </div>
      {showPlan && plan ? (
        <div className="split-plan">
          <button className="split-back" onClick={() => setShowPlan(false)}>
            Back to chat
          </button>
          <PlanPane
            plan={plan}
            busy={busy}
            onSave={(next) =>
              run(async () => {
                setPlan(next);
                await api("plan:save", { id: active.current, plan: next });
              })
            }
            onBuild={() =>
              run(async () => {
                await api("plan:build", { id: active.current });
                setMode("agent");
                setBusy(true);
                setShowPlan(false);
              })
            }
          />
        </div>
      ) : (
        <>
          <div
            className="conversation"
            onScroll={(event) => {
              const el = event.currentTarget;
              following.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 100;
            }}
          >
            <div className="messages">
              <Conversation
                messages={messages}
                busy={busy}
                stoppedTurns={
                  history.find((item) => item.id === id)?.stoppedTurns || []
                }
                onOpenLink={onOpenLink}
                onOpenImage={onOpenImage}
                onOpenPlan={() => setShowPlan(true)}
                onRetry={(text, user, _browser, files) => {
                  if (!editing) beforeEdit.current = { draft, context };
                  setDraft(text);
                  setEditing(user.timestamp);
                  setContext(files?.[0] || null);
                  input.current?.focus();
                }}
                onFork={(turn) =>
                  run(async () => {
                    apply(
                      await api("agent:fork", {
                        id: active.current,
                        timestamp: turn.messages.at(-1)?.timestamp,
                      }),
                    );
                    onRefresh();
                  })
                }
              />
            </div>
            <div ref={bottom} />
          </div>
          <div className="split-composer-wrap">
            {question && (
              <Question
                key={question.id}
                question={question}
                onAnswer={(answers) =>
                  run(async () => {
                    await api("question:answer", {
                      sessionId: active.current,
                      id: question.id,
                      answers,
                    });
                    setQuestion(null);
                  })
                }
              />
            )}
            {plan && mode === "plan" && !question && (
              <button
                className="split-plan-card"
                onClick={() => setShowPlan(true)}
              >
                <FileText size={13} />
                <span>
                  Review Plan<strong>{plan.title}</strong>
                </span>
              </button>
            )}
            {error && <div className="error">{error}</div>}
            {queued.length > 0 && (
              <div className="queued-message">
                {queued.length} queued{" "}
                {queued.length === 1 ? "message" : "messages"}
              </div>
            )}
            <div className="composer">
              <div className="editing-message" hidden={!editing}>
                <span>Editing message</span>
                <button
                  onClick={() => {
                    setEditing(null);
                    if (beforeEdit.current) {
                      setDraft(beforeEdit.current.draft);
                      setContext(beforeEdit.current.context);
                    }
                    beforeEdit.current = null;
                  }}
                >
                  Cancel
                </button>
              </div>
              {context && (
                <div className="selection-chip">
                  <FileText size={12} />
                  <span>{context.path.split("/").pop()}</span>
                  <button
                    aria-label="Remove split file context"
                    onClick={() => setContext(null)}
                  >
                    <X size={11} />
                  </button>
                </div>
              )}
              <textarea
                ref={input}
                aria-label="Split message"
                placeholder={
                  mode === "plan"
                    ? "Plan changes"
                    : messages.length
                      ? "Send follow-up"
                      : "Ask anything…"
                }
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    send();
                  }
                }}
              />
              <div className="composer-bottom">
                <button
                  aria-label="Attach current file to split chat"
                  disabled={!file}
                  onClick={() =>
                    setContext({ path: project + "/" + file.path })
                  }
                >
                  <Plus size={14} />
                </button>
                <select
                  aria-label="Split mode"
                  value={mode}
                  disabled={busy}
                  onChange={(event) => {
                    const next = event.target.value;
                    run(async () => {
                      if (active.current)
                        await api("agent:mode", {
                          id: active.current,
                          mode: next,
                        });
                      setMode(next);
                    });
                  }}
                >
                  <option value="agent">Agent</option>
                  <option value="plan">Plan</option>
                  <option value="ask">Ask</option>
                </select>
                <ModelPicker
                  models={models}
                  model={model}
                  effort={effort}
                  busy={busy}
                  onOpenChange={onOverlayChange}
                  onSelect={(next) =>
                    run(async () => {
                      if (active.current)
                        await api("agent:model", {
                          id: active.current,
                          modelId: next,
                        });
                      setModel(next);
                    })
                  }
                  onEffort={(next) =>
                    run(async () => {
                      if (active.current)
                        await api("agent:model", {
                          id: active.current,
                          thinkingLevel: next,
                        });
                      setEffort(next);
                    })
                  }
                />
                {busy && !draft.trim() ? (
                  <button
                    className="send-button"
                    aria-label="Stop split response"
                    onClick={() =>
                      run(async () => {
                        const texts = await api("agent:stop", {
                          id: active.current,
                        });
                        if (texts?.length)
                          setDraft((value) =>
                            [value, ...texts].filter(Boolean).join("\n\n"),
                          );
                        setBusy(false);
                        setQuestion(null);
                      })
                    }
                  >
                    <Square size={12} />
                  </button>
                ) : (
                  <button
                    className="send-button"
                    aria-label="Send split message"
                    disabled={!draft.trim()}
                    onClick={send}
                  >
                    <ArrowUp size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
