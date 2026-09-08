import React, { useState } from "react";
import { ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
export default function Question({ question, onAnswer }) {
  const [answers, setAnswers] = useState(question.questions.map(() => "")),
    [step, setStep] = useState(0),
    [other, setOther] = useState({}),
    [collapsed, setCollapsed] = useState(false),
    [sending, setSending] = useState(false);
  const current = question.questions[step],
    options = current.options ?? [],
    auth = question.sessionId === "auth";
  const update = (value) =>
    setAnswers((previous) =>
      previous.map((answer, index) => (index === step ? value : answer)),
    );
  const submit = async (skip) => {
    const values = answers.map((answer, index) =>
      index === step && skip ? "Skipped by user" : answer,
    );
    if (step < question.questions.length - 1) {
      setAnswers(values);
      setStep(step + 1);
      return;
    }
    setSending(true);
    try {
      await onAnswer(values);
    } finally {
      setSending(false);
    }
  };
  return (
    <section
      className="cursor-question"
      aria-label={auth ? "Sign in" : "Questions"}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey && answers[step].trim()) {
          event.preventDefault();
          submit(false);
        }
        if (!["INPUT", "TEXTAREA"].includes(event.target.tagName)) {
          const choice = event.key.toUpperCase().charCodeAt(0) - 65;
          if (choice >= 0 && choice < options.length) {
            update(
              typeof options[choice] === "string"
                ? options[choice]
                : options[choice].id,
            );
            setOther({ ...other, [step]: false });
          }
        }
      }}
    >
      <button
        className="question-heading"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>
          {auth ? "Sign in" : "Questions"}
          {question.questions.length > 1 &&
            ` · ${step + 1} of ${question.questions.length}`}
        </span>
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
      </button>
      {!collapsed && (
        <>
          <div className="question-title">{current.title}</div>
          <div className="question-choices">
            {options.map((option, index) => {
              const label = typeof option === "string" ? option : option.label,
                value = typeof option === "string" ? option : option.id;
              return (
                <button
                  className={`question-choice ${!other[step] && answers[step] === value ? "chosen" : ""}`}
                  key={index}
                  disabled={sending}
                  onClick={() => {
                    update(value);
                    setOther({ ...other, [step]: false });
                  }}
                >
                  <kbd>{String.fromCharCode(65 + index)}</kbd>
                  <span>{label}</span>
                </button>
              );
            })}
            {options.length > 0 ? (
              <div
                className={`question-choice other-choice ${other[step] ? "chosen" : ""}`}
              >
                <kbd>{String.fromCharCode(65 + options.length)}</kbd>
                {other[step] ? (
                  <textarea
                    autoFocus
                    aria-label="Other answer"
                    placeholder="Other…"
                    value={answers[step]}
                    onChange={(e) => update(e.target.value)}
                  />
                ) : (
                  <button
                    onClick={() => {
                      setOther({ ...other, [step]: true });
                      update("");
                    }}
                  >
                    Other…
                  </button>
                )}
              </div>
            ) : (
              <textarea
                className="question-free-text"
                aria-label={"Answer: " + current.title}
                placeholder="Type your answer…"
                value={answers[step]}
                onChange={(e) => update(e.target.value)}
              />
            )}
          </div>
          <div className="question-footer">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)}>
                <ArrowLeft size={11} />
                Back
              </button>
            )}
            <span className="spacer" />
            {!auth && (
              <button onClick={() => submit(true)} disabled={sending}>
                Skip
              </button>
            )}
            <button
              className="question-continue"
              disabled={sending || !answers[step].trim()}
              onClick={() => submit(false)}
            >
              {step === question.questions.length - 1 ? "Continue" : "Next"}{" "}
              <span>⏎</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
