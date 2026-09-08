// Runs in the isolated browser page, with no access to desktop APIs.
export function designSelectionScript() {
  if (window.__glassCleanup) {
    window.__glassCleanup();
    return;
  }
  const picked = new Set();
  const overlay = document.createElement("div");
  overlay.dataset.glassInspector = "true";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: "2147483647",
  });
  const hover = document.createElement("div");
  Object.assign(hover.style, {
    position: "absolute",
    border: "2px solid #5494f5",
    background: "#5494f514",
    borderRadius: "2px",
    boxSizing: "border-box",
    display: "none",
  });
  const label = document.createElement("div");
  Object.assign(label.style, {
    position: "absolute",
    display: "none",
    color: "white",
    background: "#367de3",
    padding: "3px 7px",
    font: "11px system-ui",
    borderRadius: "3px",
    whiteSpace: "nowrap",
  });
  const hint = document.createElement("div");
  Object.assign(hint.style, {
    position: "absolute",
    bottom: "14px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "8px 12px",
    borderRadius: "8px",
    background: "#252525",
    color: "#fff",
    font: "12px system-ui",
    boxShadow: "0 4px 18px #0003",
    whiteSpace: "nowrap",
  });
  hint.textContent =
    "Click to select · ⌘ click to add · Shift drag a region · Esc to cancel";
  overlay.append(hover, label, hint);
  document.documentElement.append(overlay);
  let drag = null,
    region = null,
    dragged = false;
  const selectorFor = (el) => {
    if (
      el.id &&
      document.querySelectorAll("#" + CSS.escape(el.id)).length === 1
    )
      return "#" + CSS.escape(el.id);
    const path = [];
    for (
      let node = el;
      node?.nodeType === 1 && path.length < 10;
      node = node.parentElement
    ) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        part += "#" + CSS.escape(node.id);
        path.unshift(part);
        break;
      }
      const siblings = [...(node.parentElement?.children || [])].filter(
        (sibling) => sibling.tagName === node.tagName,
      );
      if (siblings.length > 1)
        part += ":nth-of-type(" + Math.max(1, siblings.indexOf(node) + 1) + ")";
      path.unshift(part);
      if (document.querySelectorAll(path.join(" > ")).length === 1) break;
    }
    return path.join(" > ");
  };
  const describe = (el) => {
    const style = getComputedStyle(el),
      rect = el.getBoundingClientRect(),
      xpath = [];
    for (let node = el; node?.nodeType === 1; node = node.parentElement) {
      const siblings = [...(node.parentElement?.children || [])].filter(
        (sibling) => sibling.tagName === node.tagName,
      );
      xpath.unshift(
        node.tagName.toLowerCase() +
          "[" +
          Math.max(1, siblings.indexOf(node) + 1) +
          "]",
      );
    }
    const attributes = Object.fromEntries(
      [...el.attributes]
        .filter((a) => !/^on/i.test(a.name))
        .map((a) => [a.name, a.value.slice(0, 500)]),
    );
    let component;
    const fiberKey = Object.keys(el).find((key) =>
      key.startsWith("__reactFiber$"),
    );
    for (
      let fiber = fiberKey ? el[fiberKey] : null, depth = 0;
      fiber && depth < 12;
      fiber = fiber.return, depth++
    ) {
      if (typeof fiber.type === "function") {
        component = {
          name: fiber.type.displayName || fiber.type.name || "Anonymous",
          props: Object.fromEntries(
            Object.entries(fiber.memoizedProps || {})
              .filter(
                ([key, value]) =>
                  key !== "children" &&
                  ["string", "number", "boolean"].includes(typeof value),
              )
              .slice(0, 20),
          ),
        };
        break;
      }
    }
    return {
      selector: selectorFor(el),
      xpath: "/" + xpath.join("/"),
      tag: el.tagName.toLowerCase(),
      text: el.innerText?.slice(0, 1500),
      html: el.outerHTML.slice(0, 5000),
      attributes,
      component,
      bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      styles: Object.fromEntries(
        [
          "display",
          "position",
          "color",
          "backgroundColor",
          "fontFamily",
          "fontSize",
          "fontWeight",
          "lineHeight",
          "padding",
          "margin",
          "gap",
          "border",
          "borderRadius",
          "width",
          "height",
        ].map((key) => [key, style[key]]),
      ),
    };
  };
  const place = (element, rect) =>
    Object.assign(element.style, {
      display: "block",
      left: rect.x + "px",
      top: rect.y + "px",
      width: rect.width + "px",
      height: rect.height + "px",
    });
  const clean = () => {
    overlay.remove();
    document.removeEventListener("pointermove", move, true);
    document.removeEventListener("pointerdown", down, true);
    document.removeEventListener("pointerup", up, true);
    document.removeEventListener("click", click, true);
    document.removeEventListener("keydown", key, true);
    delete window.__glassCleanup;
    console.log("__GLASS_DESIGN_OFF__");
  };
  const finish = (prompt) => {
    const elements = [...picked].filter((el) => el.isConnected).map(describe);
    const payload = {
      selector: region
        ? "Selected region"
        : elements.map((el) => el.selector).join(", "),
      elements,
      prompt,
      region,
      viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY },
    };
    clean();
    console.log("__GLASS_SELECTION__" + JSON.stringify(payload));
  };
  let composer;
  const showComposer = () => {
    const previousText = composer?.querySelector("textarea")?.value || "";
    composer?.remove();
    composer = document.createElement("div");
    const rect = region || [...picked].at(-1)?.getBoundingClientRect();
    if (!rect) return;
    Object.assign(composer.style, {
      position: "absolute",
      pointerEvents: "auto",
      left: Math.max(8, Math.min(rect.x + 8, innerWidth - 328)) + "px",
      top: Math.min(rect.y + rect.height + 8, innerHeight - 62) + "px",
      width: "310px",
      display: "flex",
      alignItems: "center",
      gap: "5px",
      padding: "6px",
      background: "#fff",
      border: "1px solid #dedede",
      borderRadius: "10px",
      boxShadow: "0 4px 18px #0002",
      font: "12px system-ui",
      color: "#333",
    });
    composer.setAttribute("role", "dialog");
    composer.setAttribute("aria-label", "Describe design change");
    const chip = document.createElement("span");
    chip.textContent = region
      ? "Region"
      : picked.size > 1
        ? picked.size + " elements"
        : [...picked][0]?.tagName.toLowerCase();
    Object.assign(chip.style, {
      fontSize: "11px",
      color: "#528ab1",
      background: "#eff5fa",
      padding: "3px 5px",
      borderRadius: "4px",
      whiteSpace: "nowrap",
    });
    const input = document.createElement("textarea");
    input.rows = 1;
    input.value = previousText;
    input.placeholder = "Describe the change";
    input.setAttribute("aria-label", "Describe the change");
    Object.assign(input.style, {
      border: "0",
      outline: "none",
      resize: "none",
      padding: "3px 0",
      minWidth: "0",
      flex: "1",
      font: "12px system-ui",
      background: "transparent",
      color: "#333",
      boxShadow: "none",
      margin: "0",
      lineHeight: "18px",
    });
    const attach = document.createElement("button");
    attach.textContent = "↗";
    attach.title = "Add to chat (⌘L)";
    attach.setAttribute("aria-label", "Add selection to chat");
    Object.assign(attach.style, {
      border: "0",
      background: "transparent",
      color: "#777",
      padding: "3px",
      font: "15px system-ui",
      cursor: "pointer",
    });
    attach.onclick = () => finish();
    const send = document.createElement("button");
    send.textContent = "↑";
    send.title = "Send design change";
    send.setAttribute("aria-label", "Send design change");
    Object.assign(send.style, {
      border: "0",
      background: "#222",
      color: "#fff",
      borderRadius: "50%",
      width: "22px",
      height: "22px",
      padding: "0",
      font: "15px system-ui",
      cursor: "pointer",
      flexShrink: "0",
    });
    send.onclick = () => {
      if (input.value.trim()) finish(input.value.trim());
    };
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        if (input.value.trim()) finish(input.value.trim());
      }
    });
    composer.append(chip, input, attach, send);
    overlay.append(composer);
    hover.style.display = "none";
    label.style.display = "none";
    hint.style.display = "none";
    overlay.querySelectorAll("[data-picked]").forEach((mark) => mark.remove());
    for (const element of picked) {
      const mark = document.createElement("div");
      mark.dataset.picked = "true";
      Object.assign(mark.style, {
        position: "absolute",
        border: "2px solid #5494f5",
        background: "#5494f510",
        boxSizing: "border-box",
      });
      place(mark, element.getBoundingClientRect());
      overlay.prepend(mark);
    }
    input.focus();
  };
  const move = (e) => {
    if (composer && !drag) return;
    if (drag) {
      region = {
        x: Math.min(drag.x, e.clientX),
        y: Math.min(drag.y, e.clientY),
        width: Math.abs(e.clientX - drag.x),
        height: Math.abs(e.clientY - drag.y),
      };
      place(hover, region);
      label.textContent =
        Math.round(region.width) + " × " + Math.round(region.height);
    } else {
      if (!(e.target instanceof Element)) return;
      const rect = e.target.getBoundingClientRect();
      place(hover, rect);
      label.textContent = selectorFor(e.target);
    }
    Object.assign(label.style, {
      display: "block",
      left: Math.max(0, parseFloat(hover.style.left)) + "px",
      top: Math.max(0, parseFloat(hover.style.top) - 24) + "px",
    });
  };
  const down = (e) => {
    if (overlay.contains(e.target)) return;
    if (e.shiftKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      drag = { x: e.clientX, y: e.clientY };
      dragged = false;
    }
  };
  const up = (e) => {
    if (!drag) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    drag = null;
    if (region?.width > 4 && region?.height > 4) {
      dragged = true;
      for (const el of document.body.querySelectorAll("*")) {
        if (overlay.contains(el)) continue;
        const r = el.getBoundingClientRect();
        if (
          r.width &&
          r.height &&
          r.x >= region.x &&
          r.y >= region.y &&
          r.right <= region.x + region.width &&
          r.bottom <= region.y + region.height
        ) {
          picked.add(el);
          if (picked.size >= 20) break;
        }
      }
      showComposer();
      const suppress = (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      document.addEventListener("click", suppress, {
        capture: true,
        once: true,
      });
      setTimeout(
        () => document.removeEventListener("click", suppress, true),
        250,
      );
    }
  };
  const click = (e) => {
    if (overlay.contains(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (dragged) {
      dragged = false;
      return;
    }
    if (!(e.target instanceof Element)) return;
    if (e.metaKey || e.ctrlKey) {
      if (picked.has(e.target)) picked.delete(e.target);
      else picked.add(e.target);
      overlay
        .querySelectorAll("[data-picked]")
        .forEach((mark) => mark.remove());
      for (const element of picked) {
        const mark = document.createElement("div");
        mark.dataset.picked = "true";
        Object.assign(mark.style, {
          position: "absolute",
          border: "2px solid #367de3",
          background: "#367de318",
          boxSizing: "border-box",
        });
        place(mark, element.getBoundingClientRect());
        overlay.append(mark);
      }
      hint.textContent =
        picked.size + " selected · ⌘ click to add · Enter to attach";
      if (picked.size) showComposer();
      return;
    }
    picked.clear();
    picked.add(e.target);
    showComposer();
  };
  const key = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      clean();
    } else if (
      (e.metaKey || e.ctrlKey) &&
      e.key.toLowerCase() === "l" &&
      picked.size
    ) {
      e.preventDefault();
      e.stopImmediatePropagation();
      finish();
    } else if (e.key === "Enter" && picked.size && !composer) {
      e.preventDefault();
      e.stopImmediatePropagation();
      showComposer();
    }
  };
  window.__glassCleanup = clean;
  console.log("__GLASS_DESIGN_ON__");
  document.addEventListener("pointermove", move, true);
  document.addEventListener("pointerdown", down, true);
  document.addEventListener("pointerup", up, true);
  document.addEventListener("click", click, true);
  document.addEventListener("keydown", key, true);
}
