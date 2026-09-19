(function () {
  "use strict";

  window.PracticeCodeCompletion = { attach };

  function attach(editor, { popup, list, trigger, announcement } = {}) {
    const engine = window.PracticeCompletionEngine;
    if (!editor || !popup || !list || !engine) {
      if (trigger) trigger.hidden = true;
      return null;
    }

    let result = null;
    let selected = 0;
    let snapshot = null;
    let composing = false;
    let applying = false;
    let pointerInList = false;
    let requestFrame = null;
    const mirror = document.createElement("div");
    mirror.setAttribute("aria-hidden", "true");
    mirror.style.cssText = "position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;white-space:pre;overflow:hidden;height:0;";
    editor.parentElement.append(mirror);

    editor.addEventListener("input", (event) => {
      if (applying) return;
      if (composing || event.isComposing || event.inputType === "historyUndo" || event.inputType === "historyRedo") {
        close();
        return;
      }
      request(false);
    });
    editor.addEventListener("compositionstart", () => {
      composing = true;
      close();
    });
    editor.addEventListener("compositionend", () => {
      composing = false;
      // The final composition input may arrive before or after compositionend.
      requestFrame = requestAnimationFrame(() => {
        requestFrame = null;
        request(false);
      });
    });
    editor.addEventListener("blur", () => {
      if (!pointerInList) close();
    });
    editor.addEventListener("pointerdown", close);
    editor.addEventListener("scroll", close);
    editor.addEventListener("select", () => {
      if (!applying && snapshot && (editor.selectionStart !== snapshot.cursor || editor.selectionEnd !== snapshot.cursor)) close();
    });
    window.addEventListener("resize", close);

    // Keep textarea focus when choosing with a mouse. Touch can still scroll the list.
    list.addEventListener("pointerdown", () => { pointerInList = true; });
    list.addEventListener("mousedown", (event) => event.preventDefault());
    document.addEventListener("pointerup", () => {
      if (!pointerInList) return;
      pointerInList = false;
      setTimeout(() => { if (document.activeElement !== editor) close(); }, 0);
    });
    document.addEventListener("pointercancel", () => {
      pointerInList = false;
      close();
    });
    list.addEventListener("click", (event) => {
      const option = event.target.closest("[data-completion-index]");
      if (option) accept(Number(option.dataset.completionIndex));
    });
    trigger?.addEventListener("mousedown", (event) => event.preventDefault());
    trigger?.addEventListener("click", () => {
      editor.focus({ preventScroll: true });
      request(true);
    });

    function close() {
      if (requestFrame !== null) {
        cancelAnimationFrame(requestFrame);
        requestFrame = null;
      }
      popup.hidden = true;
      result = null;
      snapshot = null;
      editor.removeAttribute("aria-activedescendant");
      trigger?.setAttribute("aria-expanded", "false");
      if (announcement) announcement.textContent = "";
    }

    function request(explicit) {
      if (composing || document.activeElement !== editor || editor.selectionStart !== editor.selectionEnd) {
        close();
        return;
      }
      const previousLabel = result?.items[selected]?.label;
      const next = engine.getCompletions(editor.value, editor.selectionStart, { explicit });
      if (!next?.items.length) {
        close();
        if (explicit && announcement) announcement.textContent = "当前位置没有补全建议。";
        return;
      }
      result = next;
      snapshot = { code: editor.value, cursor: editor.selectionStart };
      selected = Math.max(0, next.items.findIndex((item) => item.label === previousLabel));
      list.replaceChildren(...next.items.map((item, index) => {
        const option = document.createElement("div");
        option.id = `code-completion-option-${index}`;
        option.className = "completion-option";
        option.dataset.completionIndex = String(index);
        option.setAttribute("role", "option");
        const name = document.createElement("span");
        name.className = "completion-name";
        name.textContent = item.label;
        const detail = document.createElement("span");
        detail.className = "completion-detail";
        detail.textContent = item.detail;
        option.title = `${item.label} · ${item.detail}`;
        option.append(name, detail);
        return option;
      }));
      popup.hidden = false;
      trigger?.setAttribute("aria-expanded", "true");
      positionPopup();
      if (popup.hidden) return;
      select(selected);
      if (announcement) announcement.textContent = `${next.items.length} 条补全建议。上下方向键选择，Tab 或 Enter 插入。`;
    }

    function select(index) {
      selected = (index + result.items.length) % result.items.length;
      [...list.children].forEach((option, i) => option.setAttribute("aria-selected", String(i === selected)));
      const active = list.children[selected];
      editor.setAttribute("aria-activedescendant", active.id);
      // Scroll only the suggestions, never the editor or the surrounding page.
      if (active.offsetTop < list.scrollTop) list.scrollTop = active.offsetTop;
      if (active.offsetTop + active.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = active.offsetTop + active.offsetHeight - list.clientHeight;
      }
    }

    function accept(index = selected) {
      if (!result || !snapshot || editor.value !== snapshot.code || editor.selectionStart !== snapshot.cursor || editor.selectionEnd !== snapshot.cursor) {
        close();
        return;
      }
      const { from, to } = result;
      const item = result.items[index];
      if (!item) return;
      close();
      applying = true;
      try {
        editor.focus({ preventScroll: true });
        editor.setSelectionRange(from, to);
        // Native insertion keeps completion as an undoable edit in supporting browsers.
        let inserted = false;
        try { inserted = document.execCommand("insertText", false, item.insertText); } catch (_) { /* Use the textarea fallback. */ }
        if (!inserted) {
          editor.setRangeText(item.insertText, from, to, "end");
          editor.dispatchEvent(new Event("input", { bubbles: true }));
        }
      } finally {
        applying = false;
      }
      if (announcement) announcement.textContent = `已插入 ${item.label}。`;
    }

    function positionPopup() {
      const style = getComputedStyle(editor);
      for (const property of ["fontFamily", "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "tabSize", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]) {
        mirror.style[property] = style[property];
      }
      mirror.style.width = `${editor.clientWidth}px`;
      const marker = document.createElement("span");
      marker.textContent = "\u200b";
      mirror.replaceChildren(document.createTextNode(editor.value.slice(0, editor.selectionStart)), marker);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.7;
      const x = editor.offsetLeft + marker.offsetLeft - editor.scrollLeft;
      const y = editor.offsetTop + marker.offsetTop - editor.scrollTop;
      const wrap = editor.parentElement;
      if (y + lineHeight < 0 || y > wrap.clientHeight || x < editor.offsetLeft || x > wrap.clientWidth) {
        close();
        return;
      }
      const below = wrap.clientHeight - y - lineHeight - 8;
      const above = y - 8;
      const showBelow = below >= Math.min(150, result.items.length * 34 + 28) || below >= above;
      popup.style.maxHeight = `${Math.max(52, showBelow ? below : above)}px`;
      popup.style.left = `${Math.max(8, Math.min(x, wrap.clientWidth - popup.offsetWidth - 8))}px`;
      popup.style.top = `${Math.max(4, showBelow ? y + lineHeight + 2 : y - popup.offsetHeight - 2)}px`;
    }

    function handleKeydown(event) {
      if (composing || event.isComposing || event.keyCode === 229) {
        close();
        return false;
      }
      if (event.ctrlKey && !event.altKey && !event.metaKey && (event.code === "Space" || event.key === " ")) {
        event.preventDefault();
        request(true);
        return true;
      }
      if (popup.hidden) return false;
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
        close();
        return false;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        select(selected + (event.key === "ArrowDown" ? 1 : -1));
        return true;
      }
      if (event.key === "Tab" || event.key === "Enter") {
        // A fully typed name must not swallow a normal newline or indentation.
        if (result.items[selected].insertText === editor.value.slice(result.from, result.to) && editor.selectionStart === result.to) {
          close();
          return false;
        }
        event.preventDefault();
        accept();
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close();
        return true;
      }
      if (["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.key)) close();
      return false;
    }

    return { close, handleKeydown };
  }
})();
