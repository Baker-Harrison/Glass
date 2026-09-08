import React, { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
export default function TerminalPane({ api, onError, project, terminalId }) {
  const host = useRef(null);
  useEffect(() => {
    const term = new Terminal({
      fontFamily: "Menlo, monospace",
      fontSize: 12,
      cursorBlink: true,
      theme: {
        background: "#fdfcfb",
        foreground: "#4b4843",
        cursor: "#5d5850",
        selectionBackground: "#b8c9e080",
      },
      scrollback: 10000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host.current);
    fit.fit();
    let cancelled = false,
      ready = false,
      id = terminalId,
      sequence = 0;
    const pending = [];
    const resize = () => {
      fit.fit();
      if (id)
        api("terminal:resize", { id, cols: term.cols, rows: term.rows }).catch(
          (e) => onError(e.message),
        );
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);
    const receive = (event) => {
      if (event.id !== id) return;
      if (event.type === "terminal_data" && event.sequence > sequence) {
        sequence = event.sequence;
        term.write(event.data);
      }
      if (event.type === "terminal_exit") {
        term.write("\r\n[Process exited " + event.code + "]\r\n");
        term.options.disableStdin = true;
        term.options.cursorBlink = false;
      }
    };
    const unsubscribe = window.glass?.subscribe((event) => {
      if (!ready) pending.push(event);
      else receive(event);
    });
    api("terminal:snapshot", { id })
      .then((result) => {
        id = result.id;

        if (cancelled) return;
        sequence = result.sequence;
        term.write(result.output);
        if (result.exited) {
          term.write("\r\n[Process exited " + result.exitCode + "]\r\n");
          term.options.disableStdin = true;
          term.options.cursorBlink = false;
        }
        ready = true;
        pending.forEach(receive);
        resize();
        term.focus();
      })
      .catch((e) => onError(e.message));
    const input = term.onData((data) => {
      if (id)
        api("terminal:write", { id, data }).catch((e) => onError(e.message));
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
      observer.disconnect();
      input.dispose();
      term.dispose();
    };
  }, [project, terminalId]);
  return <div className="pty-terminal" ref={host} />;
}
