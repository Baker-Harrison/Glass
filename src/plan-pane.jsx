import React, { useState, useEffect } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Plus, Square, LoaderCircle } from "lucide-react";
function TodoText({ text, onCommit }) {
  const [draft, setDraft] = useState(text);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(text);
  }, [text, focused]);
  return (
    <input
      aria-label="Todo content"
      value={draft}
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        if (draft !== text) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}
export default function PlanPane({ plan, onSave, onBuild, busy }) {
  const [editing, setEditing] = useState(false),
    [body, setBody] = useState(plan.content);
  return (
    <div className="plan-pane">
      <div className="plan-toolbar">
        <span>Plans › {plan.title}</span>
        <button
          onClick={() => {
            setBody(plan.content);
            setEditing(!editing);
          }}
        >
          {editing ? "Cancel" : "Edit"}
        </button>
        <button className="build-plan" disabled={busy} onClick={onBuild}>
          Build
        </button>
      </div>
      <article className="plan-document">
        {editing ? (
          <>
            <textarea
              aria-label="Edit plan"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <button
              className="save-plan"
              onClick={async () => {
                await onSave({ ...plan, content: body });
                setEditing(false);
              }}
            >
              Save plan
            </button>
          </>
        ) : (
          <Markdown remarkPlugins={[remarkGfm]}>{plan.content}</Markdown>
        )}
        <div className="todo-heading">
          <span>{plan.todos.length} To-dos</span>
          <button
            onClick={() =>
              onSave({
                ...plan,
                todos: [
                  ...plan.todos,
                  {
                    id: crypto.randomUUID(),
                    text: "New task",
                    status: "pending",
                  },
                ],
              })
            }
          >
            <Plus size={11} />
            New
          </button>
        </div>
        {plan.todos.map((todo) => (
          <div className="plan-todo" key={todo.id}>
            <button
              title={"Status: " + todo.status}
              onClick={() =>
                onSave({
                  ...plan,
                  todos: plan.todos.map((t) =>
                    t.id === todo.id
                      ? {
                          ...t,
                          status:
                            t.status === "completed" ? "pending" : "completed",
                        }
                      : t,
                  ),
                })
              }
            >
              {todo.status === "completed" ? (
                <Check size={13} />
              ) : todo.status === "in_progress" ? (
                <LoaderCircle size={13} />
              ) : (
                <Square size={13} />
              )}
            </button>
            <TodoText
              text={todo.text}
              onCommit={(text) =>
                onSave({
                  ...plan,
                  todos: plan.todos.map((t) =>
                    t.id === todo.id ? { ...t, text } : t,
                  ),
                })
              }
            />
          </div>
        ))}
      </article>
    </div>
  );
}
