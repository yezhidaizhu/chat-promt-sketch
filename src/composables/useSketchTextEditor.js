import { nextTick } from "vue";

const padding = 6;
const minWidth = 48;
const defaultWidth = 240;
const lineHeight = 1.25;
const minSize = 12;
const maxSize = 160;

export function useSketchTextEditor(options) {
  const { commands, selectedIndex, activeTool, strokeColor, selectionCursor, textEditor, textValue, clone, pushHistory, announce, render, selectCommand, normalizePoint, pixelPoint, eventPoint, getStageSize, getContext, input } = options;
  let transform = null;

  function measureTextWidth(command, text) {
    const context = getContext(); if (!context) return Array.from(text).length * command.size * 0.6;
    context.save(); context.font = `600 ${command.size}px Inter, sans-serif`; const width = context.measureText(text).width; context.restore(); return width;
  }
  function wrapText(command, text, width) {
    const lines = [];
    text.split("\n").forEach((paragraph) => { if (!paragraph) { lines.push(""); return; } let line = ""; Array.from(paragraph).forEach((character) => { const candidate = line + character; if (line && measureTextWidth(command, candidate) > width) { lines.push(line); line = character; } else line = candidate; }); lines.push(line); });
    return lines.length ? lines : [""];
  }
  function textLayout(command, text = command.text) {
    const stageSize = getStageSize(); const naturalWidth = Math.max(minWidth, ...text.split("\n").map((line) => measureTextWidth(command, line || " ")));
    const width = command.width ? Math.max(minWidth, command.width * stageSize.width) : naturalWidth;
    const lines = command.width ? wrapText(command, text, width) : text.split("\n"); const height = command.size * lineHeight;
    return { width, height: Math.max(height, lines.length * height), lineHeight: height, lines };
  }
  function textEditorBounds(command) {
    const point = pixelPoint(command); const layout = textLayout(command, textValue.value);
    return { x: point.x - padding, y: point.y - padding, width: layout.width + padding * 2, height: layout.height + padding * 2 };
  }
  function startText(point) {
    const stageSize = getStageSize(); const normalized = normalizePoint(point); const previous = clone();
    commands.value.push({ type: "text", text: "", x: normalized.x, y: normalized.y, color: strokeColor.value, size: 32, width: Math.min(defaultWidth, Math.max(minWidth, stageSize.width - point.x - 24)) / stageSize.width });
    beginTextEdit(commands.value.length - 1, previous, true);
  }
  function beginTextEdit(index, previous = clone(), isNew = false) {
    const command = commands.value[index]; if (command?.type !== "text") return; const stageSize = getStageSize();
    if (!command.width) command.width = Math.min(defaultWidth, textLayout(command).width) / stageSize.width;
    selectCommand(index); textEditor.value = { index, previous, isNew }; textValue.value = command.text; render(); nextTick(() => input.value?.focusAtEnd());
  }
  function commitText() {
    if (!textEditor.value) return; const editor = textEditor.value; const command = commands.value[editor.index]; const text = textValue.value.replace(/\r/g, "").trimEnd(); textEditor.value = null;
    if (!command) { selectedIndex.value = -1; render(); return; }
    if (!text.trim()) { if (editor.isNew) { commands.value = editor.previous; selectedIndex.value = -1; render(); } else { commands.value.splice(editor.index, 1); selectedIndex.value = -1; pushHistory(editor.previous); announce("文字已删除"); } return; }
    command.text = text; activeTool.value = "select"; selectedIndex.value = editor.index; selectionCursor.value = "grab";
    if (JSON.stringify(editor.previous) !== JSON.stringify(commands.value)) { pushHistory(editor.previous); announce(editor.isNew ? "文字已添加" : "文字已更新"); } else render();
  }
  function cancelText() { if (!textEditor.value) return; const editor = textEditor.value; commands.value = editor.previous; textEditor.value = null; textValue.value = ""; selectedIndex.value = editor.isNew ? -1 : Math.min(editor.index, commands.value.length - 1); render(); input.value?.focus(); }
  function scaleGeometry(bounds, handleId) {
    const { x: left, y: top, width, height } = bounds; const right = left + width; const bottom = top + height; const centerX = (left + right) / 2;
    return { nw: [{ x: left, y: top }, { x: right, y: bottom }], n: [{ x: centerX, y: top }, { x: centerX, y: bottom }], ne: [{ x: right, y: top }, { x: left, y: bottom }], se: [{ x: right, y: bottom }, { x: left, y: top }], s: [{ x: centerX, y: bottom }, { x: centerX, y: top }], sw: [{ x: left, y: bottom }, { x: right, y: top }] }[handleId];
  }
  function resizeTextCommand(command, point, state) {
    const { id } = state.handle; const bounds = state.originalBounds; const stageSize = getStageSize(); const editorPadding = state.draft ? padding : 0;
    if (["e", "w"].includes(id)) { const width = Math.max(minWidth, id === "w" ? bounds.x + bounds.width - point.x - editorPadding * 2 : point.x - bounds.x - editorPadding * 2); command.width = width / stageSize.width; command.x = (id === "w" ? bounds.x + bounds.width - width - editorPadding : bounds.x + editorPadding) / stageSize.width; command.y = (bounds.y + editorPadding) / stageSize.height; return; }
    const geometry = scaleGeometry(bounds, id); if (!geometry) return; const [handle, anchor] = geometry; const vector = { x: handle.x - anchor.x, y: handle.y - anchor.y }; const pointer = { x: point.x - anchor.x, y: point.y - anchor.y };
    const raw = (pointer.x * vector.x + pointer.y * vector.y) / (vector.x ** 2 + vector.y ** 2); const contentWidth = Math.max(minWidth, bounds.width - editorPadding * 2); const scale = Math.min(maxSize / state.originalCommand.size, Math.max(Math.max(minSize / state.originalCommand.size, minWidth / contentWidth), raw));
    command.size = Math.round(state.originalCommand.size * scale * 10) / 10; const applied = command.size / state.originalCommand.size; command.width = (contentWidth * applied) / stageSize.width; const layout = textLayout(command, state.draft ? textValue.value : command.text); const outerWidth = layout.width + editorPadding * 2; const outerHeight = layout.height + editorPadding * 2; let x = anchor.x; let y = anchor.y; if (id.includes("w")) x -= outerWidth; else if (!id.includes("e")) x -= outerWidth / 2; if (id.includes("n")) y -= outerHeight; command.x = (x + editorPadding) / stageSize.width; command.y = (y + editorPadding) / stageSize.height;
  }
  function startTextTransform(event, type, handleId = null) { const command = commands.value[textEditor.value?.index]; if (!command) return; const point = eventPoint(event); transform = { type, handle: handleId ? { id: handleId } : null, start: normalizePoint(point), originalCommand: clone(command), originalBounds: textEditorBounds(command), draft: true }; event.currentTarget.setPointerCapture(event.pointerId); }
  function moveTextTransform(event) { if (!transform || !textEditor.value) return; const command = commands.value[textEditor.value.index]; const point = eventPoint(event); if (transform.type === "move") { const normalized = normalizePoint(point); command.x = transform.originalCommand.x + normalized.x - transform.start.x; command.y = transform.originalCommand.y + normalized.y - transform.start.y; } else resizeTextCommand(command, point, transform); }
  function finishTextTransform(event) { if (!transform) return; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); transform = null; nextTick(() => input.value?.focus()); }
  return { textLayout, textEditorBounds, startText, beginTextEdit, commitText, cancelText, resizeTextCommand, startTextTransform, moveTextTransform, finishTextTransform, textEditorPadding: padding };
}
