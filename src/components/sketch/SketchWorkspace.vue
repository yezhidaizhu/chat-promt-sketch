<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { getStroke } from "perfect-freehand";
import ColorPalette from "./ColorPalette.vue";
import ObjectContextMenu from "./ObjectContextMenu.vue";
import OutputActions from "./OutputActions.vue";
import SketchToolbar from "./SketchToolbar.vue";
import StrokeSizeControl from "./StrokeSizeControl.vue";
import StrokeSizePreview from "./StrokeSizePreview.vue";
import SketchTextEditor from "./SketchTextEditor.vue";
import ImageDropOverlay from "./ImageDropOverlay.vue";
import { useHistory } from "../../composables/useHistory.js";
import { useSketchState } from "../../composables/useSketchState.js";
import { useSketchControls } from "../../composables/useSketchControls.js";
import { useSketchImageImport } from "../../composables/useSketchImageImport.js";
import { useSketchOutput } from "../../composables/useSketchOutput.js";
import { useSketchDialogLayout } from "../../composables/useSketchDialogLayout.js";
import { closePopover, openPopover } from "../../composables/usePopover.js";
import { locale } from "../../locales/index.js";

const props = defineProps({ modelValue: Boolean, submit: { type: Function, default: null }, embedded: Boolean, initialLayout: { type: String, default: "ratio" }, layout: { type: String, default: null } });
const emit = defineEmits(["update:modelValue", "update:layout", "download"]);
const copy = locale.sketch;
const teleportTarget = inject("TeleportTarget", "body");
const dialog = ref(null), stageContainer = ref(null), konvaStage = ref(null), documentGroup = ref(null), transformer = ref(null), textInput = ref(null);
const stageSize = ref({ width: 1, height: 1 }), zoom = ref(1), pan = ref({ x: 0, y: 0 }), panMode = ref(false), spacePressed = ref(false), isPanning = ref(false);
const draft = ref(null), eraserPreview = ref(null), textEditor = ref(null), textValue = ref(""), objectContextMenu = ref(null), statusMessage = ref(""), strokeSizePreviewVisible = ref(false), backgroundPreviewColor = ref(null), pointerCursor = ref({ x: 0, y: 0, visible: false }), selectionCursor = ref("default");
const nodes = new Map();
let gesture, transformPrevious, observer, sequence = 0;
const { activeTool, activeShape, strokeColor, strokeSize, backgroundColor, commands, selectedId, activePopover, controlsOutside, canvasRatio, selectedCommand, hasContent } = useSketchState();
const background = computed(() => backgroundPreviewColor.value || backgroundColor.value);
const minZoom = .25, maxZoom = 4;
const textEditorPadding = 6;
const zoomPercent = computed(() => Math.round(zoom.value * 100));
const selectionOrder = computed(() => commands.value.findIndex((item) => item.id === selectedId.value));
const canMoveBackward = computed(() => selectionOrder.value > 0), canMoveForward = computed(() => selectionOrder.value >= 0 && selectionOrder.value < commands.value.length - 1);
const { drawingRatio, ratioValue, dialogStyle, interfaceFullscreen, browserFullscreen, isFullscreen, effectiveControlsOutside, changeCanvasRatio, toggleBrowserFullscreen } = useSketchDialogLayout({ dialog, stage: stageContainer, controlsOutside, canvasRatio, commands, initialLayout: props.initialLayout, getLayout: () => props.layout, getEmbedded: () => props.embedded, getModelValue: () => props.modelValue, emitLayout: (value) => emit("update:layout", value), resizeCanvases, announce });
const documentSize = computed(() => ({ width: 1000 * drawingRatio.value, height: 1000 }));
const documentTransform = computed(() => { const fit = Math.min(Math.max(1, stageSize.value.width - 96) / documentSize.value.width, Math.max(1, stageSize.value.height - 96) / 1000); const scale = fit * zoom.value; return { x: (stageSize.value.width - documentSize.value.width * scale) / 2 + pan.value.x, y: (stageSize.value.height - 1000 * scale) / 2 + pan.value.y, scale }; });
const stageConfig = computed(() => ({ ...stageSize.value }));
const documentConfig = computed(() => ({ x: documentTransform.value.x, y: documentTransform.value.y, scaleX: documentTransform.value.scale, scaleY: documentTransform.value.scale }));
const transformerConfig = computed(() => {
  const inverse = 1 / Math.max(.001, documentTransform.value.scale);
  const baseSize = 6 * inverse;
  const padding = 2 * inverse;
  return {
    enabledAnchors: ["top-left", "top-center", "top-right", "middle-right", "bottom-right", "bottom-center", "bottom-left", "middle-left"],
    borderStroke: "#a3e635",
    borderStrokeWidth: 1 * inverse,
    anchorFill: "#fff",
    anchorStrokeWidth: 0,
    anchorSize: baseSize,
    anchorCornerRadius: baseSize / 2,
    rotateAnchorAngle: 180,
    rotateAnchorOffset: 24 * inverse,
    rotateLineVisible: true,
    flipEnabled: false,
    keepRatio: true,
    shiftBehavior: "default",
    rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
    rotationSnapTolerance: 5,
    padding,
    anchorStyleFunc: (anchor) => {
      anchor.fill("#fff");
      anchor.strokeWidth(0);
      if (anchor.hasName("rotater")) {
        anchor.width(14 * inverse);
        anchor.height(14 * inverse);
        anchor.cornerRadius(7 * inverse);
        anchor.offsetX(7 * inverse);
        anchor.offsetY(7 * inverse);
        anchor.rotation(-anchor.getParent().rotation());
        anchor.sceneFunc((context, shape) => {
          const canvas = context._context;
          const center = 7 * inverse;
          canvas.save();
          canvas.beginPath();
          canvas.arc(center, center, center, 0, Math.PI * 2);
          canvas.fillStyle = "#fff";
          canvas.fill();
          canvas.strokeStyle = "#171717";
          canvas.lineWidth = 2;
          canvas.lineCap = "round";
          canvas.lineJoin = "round";
          canvas.translate(1.9 * inverse, 1.9 * inverse);
          canvas.scale(.425 * inverse, .425 * inverse);
          canvas.stroke(new Path2D("M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"));
          canvas.stroke(new Path2D("M3 3v5h5"));
          canvas.restore();
        });
        anchor.hitFunc((context, shape) => {
          context.beginPath();
          context.arc(7 * inverse, 7 * inverse, 7 * inverse, 0, Math.PI * 2);
          context.closePath();
          context.fillStrokeShape(shape);
        });
        return;
      }
      const horizontal = ["top-center", "bottom-center"].some((name) => anchor.hasName(name));
      const vertical = ["middle-right", "middle-left"].some((name) => anchor.hasName(name));
      if (horizontal) {
        anchor.width(7 * inverse);
        anchor.height(3 * inverse);
        anchor.cornerRadius(1.5 * inverse);
      } else if (vertical) {
        anchor.width(3 * inverse);
        anchor.height(7 * inverse);
        anchor.cornerRadius(1.5 * inverse);
      } else {
        anchor.width(baseSize);
        anchor.height(baseSize);
        anchor.cornerRadius(baseSize / 2);
      }
      let offsetX = anchor.width() / 2;
      let offsetY = anchor.height() / 2;
      if (["top-left", "middle-left", "bottom-left"].some((name) => anchor.hasName(name))) offsetX += padding;
      if (["top-right", "middle-right", "bottom-right"].some((name) => anchor.hasName(name))) offsetX -= padding;
      if (["top-left", "top-center", "top-right"].some((name) => anchor.hasName(name))) offsetY += padding;
      if (["bottom-left", "bottom-center", "bottom-right"].some((name) => anchor.hasName(name))) offsetY -= padding;
      anchor.offsetX(offsetX);
      anchor.offsetY(offsetY);
    },
    boundBoxFunc: (oldBox, box) => Math.abs(box.width) < 12 * inverse || Math.abs(box.height) < 12 * inverse ? oldBox : box,
  };
});
const canvasCursor = computed(() => isPanning.value ? "grabbing" : panMode.value || spacePressed.value ? "grab" : activeTool.value === "select" ? selectionCursor.value : activeTool.value === "text" ? "text" : activeTool.value === "shape" ? "crosshair" : pointerCursor.value.visible && ["pen", "eraser"].includes(activeTool.value) ? "none" : "default");
const pointerCursorStyle = computed(() => ({ width: `${Math.max(6, strokeSize.value)}px`, height: `${Math.max(6, strokeSize.value)}px`, left: `${pointerCursor.value.x}px`, top: `${pointerCursor.value.y}px`, backgroundColor: activeTool.value === "eraser" ? "#a8a8a8" : strokeColor.value, opacity: pointerCursor.value.visible && ["pen", "eraser"].includes(activeTool.value) && !isPanning.value && !panMode.value ? 1 : 0 }));
const menuStyle = computed(() => objectContextMenu.value ? { left: `${Math.max(8, Math.min(stageSize.value.width - 176, objectContextMenu.value.x))}px`, top: `${Math.max(8, Math.min(stageSize.value.height - 154, objectContextMenu.value.y))}px` } : {});
const textEditorStyle = computed(() => {
  const item = selectedCommand.value;
  if (!item || textEditor.value?.id !== item.id) return {};
  const node = objectNode(item.id)?.findOne(".sketch-text");
  const scale = documentTransform.value.scale;
  const lineCount = Math.max(1, textValue.value.split("\n").length);
  const height = Math.max(node?.height() || 0, item.fontSize * 1.25 * lineCount);
  const angle = (item.rotation || 0) * Math.PI / 180;
  const offsetX = (-textEditorPadding * Math.cos(angle) + textEditorPadding * Math.sin(angle)) * scale;
  const offsetY = (-textEditorPadding * Math.sin(angle) - textEditorPadding * Math.cos(angle)) * scale;
  return {
    left: `${documentTransform.value.x + item.x * scale + offsetX}px`,
    top: `${documentTransform.value.y + item.y * scale + offsetY}px`,
    width: `${item.width}px`,
    height: `${height}px`,
    color: item.color,
    fontSize: `${item.fontSize}px`,
    lineHeight: 1.25,
    transformOrigin: "0 0",
    transform: `rotate(${item.rotation || 0}deg) scale(${scale})`,
  };
});

const { canUndo, canRedo, clone, pushHistory, undo, redo } = useHistory(() => commands.value, (restored, message, context) => { commands.value = restored; if (context?.backgroundColor) backgroundColor.value = context.backgroundColor; selectedId.value = null; refresh(); announce(message); }, refresh, () => ({ backgroundColor: backgroundColor.value }), { undo: copy.messages.undone, redo: copy.messages.redone });
const controls = useSketchControls({ state: { activeTool, activeShape, strokeColor, strokeSize, commands, selectedId, activePopover, controlsOutside, canvasRatio, textEditor, selectedCommand }, clone, pushHistory, render: refresh, resizeCanvases, announce, commitText, onRatioChange: changeCanvasRatio, getCurrentRatio: () => interfaceFullscreen.value ? "fill" : canvasRatio.value, getDocumentScale: () => documentTransform.value.scale });
const { imageInput, imageLoading, imageDragActive, getImage, openImagePicker, addImage, handleImageDragEnter, handleImageDragOver, handleImageDragLeave, handleImageDrop } = useSketchImageImport({ stage: stageContainer, documentSize, commands, activeTool, selectedId, clone, pushHistory, announce, documentPoint: pointFromNative, setPanMode });
const { copySucceeded, attaching, copyCanvas, downloadCanvas, attachCanvas } = useSketchOutput({ hasContent, createOutputCanvas, getSubmit: () => props.submit, emitDownload: (name) => emit("download", name), announce, close: closeDialog });

function announce(message) { statusMessage.value = ""; requestAnimationFrame(() => { statusMessage.value = message; }); }
function id() { return crypto.randomUUID?.() || `sketch-object-${Date.now()}-${sequence += 1}`; }
function stageNode() { return konvaStage.value?.getNode(); }
function documentNode() { return documentGroup.value?.getNode(); }
function command(idValue) { return commands.value.find((item) => item.id === idValue); }
function objectNode(idValue) { return nodes.get(idValue); }
function registerNode(idValue, component) { if (component) nodes.set(idValue, component.getNode?.() || component); else nodes.delete(idValue); }
function eventScreenPoint(event) { const stage = stageNode(); if (!stage) return null; if (event?.evt) return stage.getPointerPosition(); stage.setPointersPositions(event); return stage.getPointerPosition(); }
function point(event) { const screen = eventScreenPoint(event), group = documentNode(); if (!screen || !group) return { x: 0, y: 0, pressure: .5 }; return { ...group.getAbsoluteTransform().copy().invert().point(screen), pressure: event?.evt?.pressure || event?.pressure || .5 }; }
function pointFromNative(event) { return point(event); }
function screenPoint(docPoint) { return documentNode()?.getAbsoluteTransform().point(docPoint) || docPoint; }
function targetCommand(node) { for (let current = node; current; current = current.getParent?.()) { const target = command(current.getAttr?.("commandId")); if (target) return target; } return null; }
function isTransformerTarget(node) { for (let current = node; current; current = current.getParent?.()) { if (current.getClassName?.() === "Transformer") return true; } return false; }
function refresh() { nextTick(() => { syncTransformer(); cacheMasks(); stageNode()?.batchDraw(); }); }
function syncTransformer() { const node = objectNode(selectedId.value), current = transformer.value?.getNode?.(); if (!current) return; current.nodes(node && activeTool.value === "select" ? [node] : []); current.getLayer()?.batchDraw(); }
function cacheMasks() { const ratio = Math.min(4, Math.max(1, (window.devicePixelRatio || 1) * documentTransform.value.scale)); commands.value.forEach((item) => { const node = objectNode(item.id); if (!node) return; node.clearCache(); if (item.masks?.length) node.cache({ pixelRatio: ratio }); }); }
function resizeCanvases() { const element = stageContainer.value; if (!element?.clientWidth || !element.clientHeight) return; stageSize.value = { width: element.clientWidth, height: element.clientHeight }; stageNode()?.size(stageSize.value); refresh(); }
function config(item) { return { id: item.id, commandId: item.id, name: "sketch-object", x: item.x, y: item.y, rotation: item.rotation || 0, draggable: activeTool.value === "select" && textEditor.value?.id !== item.id, onMouseenter: selectionEnter, onMouseleave: selectionLeave, onDragstart: dragStart, onDragend: dragEnd, onTransformstart: transformStart, onTransformend: transformEnd }; }
function lineConfig(item) { return { x: 0, y: 0, width: item.width, height: item.height, stroke: item.color, strokeWidth: item.strokeWidth, lineCap: "round", lineJoin: "round" }; }
function textConfig(item) { return { name: "sketch-text", x: 0, y: -2, text: item.text, width: item.width, fontSize: item.fontSize, fontFamily: "Inter, sans-serif", fontStyle: "600", lineHeight: 1.25, fill: item.color, opacity: textEditor.value?.id === item.id ? 0 : 1, visible: true }; }
function imageConfig(item) { return { x: 0, y: 0, image: getImage(item.assetId), width: item.width, height: item.height }; }
function freehandOutline(item) { return getStroke(item.points.map((p) => [p.x, p.y, p.pressure]), { size: item.strokeWidth, thinning: item.usePressure ? .45 : 0, smoothing: .85, streamline: .28, simulatePressure: false, last: true }); }
function outlineBounds(outline) { const xs = outline.map((p) => p[0]), ys = outline.map((p) => p[1]); return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) }; }
function freehandConfig(item, preview = false) { const outline = freehandOutline(item), bounds = outline.length ? outlineBounds(outline) : { x: 0, y: 0, width: 1, height: 1 }; return { ...bounds, fill: preview ? "rgba(168,168,168,.5)" : item.color, listening: !preview, sceneFunc: freehandScene(outline, bounds) }; }
function maskConfig(mask) { const outline = freehandOutline(mask), bounds = outline.length ? outlineBounds(outline) : { x: 0, y: 0, width: 1, height: 1 }; return { ...bounds, fill: "#000", globalCompositeOperation: "destination-out", listening: false, sceneFunc: freehandScene(outline, bounds) }; }
function freehandScene(outline, bounds) { return (context, shape) => { if (!outline.length) return; const local = outline.map((point) => [point[0] - bounds.x, point[1] - bounds.y]); context.beginPath(); context.moveTo(...local[0]); for (let index = 1; index < local.length; index += 1) { const current = local[index], next = local[(index + 1) % local.length]; context.quadraticCurveTo(current[0], current[1], (current[0] + next[0]) / 2, (current[1] + next[1]) / 2); } context.closePath(); context.fillStrokeShape(shape); }; }
function heartConfig(item) { return { ...lineConfig(item), sceneFunc: (context, shape) => { const { width: w, height: h } = item; context.beginPath(); context.moveTo(w / 2, h * .28); context.bezierCurveTo(w / 2, h * .12, w * .43, 0, w * .27, 0); context.bezierCurveTo(w * .12, 0, 0, h * .12, 0, h * .3); context.bezierCurveTo(0, h * .5, w * .08, h * .72, w / 2, h); context.bezierCurveTo(w * .92, h * .72, w, h * .5, w, h * .3); context.bezierCurveTo(w, h * .12, w * .88, 0, w * .73, 0); context.bezierCurveTo(w * .57, 0, w / 2, h * .12, w / 2, h * .28); context.closePath(); context.fillStrokeShape(shape); } }; }
function polygonConfig(item, sides, rotation = 0) { return { ...lineConfig(item), x: item.width / 2, y: item.height / 2, sides, radius: .5, rotation, scaleX: item.width, scaleY: item.height }; }
function starConfig(item) { return { ...lineConfig(item), x: item.width / 2, y: item.height / 2, numPoints: 5, innerRadius: .21, outerRadius: .5, scaleX: item.width, scaleY: item.height }; }
function normalizePen(item, next) { let x = next.x - item.x, y = next.y - item.y; if (x < 0) { item.x += x; item.points.forEach((p) => { p.x -= x; }); x = 0; } if (y < 0) { item.y += y; item.points.forEach((p) => { p.y -= y; }); y = 0; } item.points.push({ x, y, pressure: next.pressure }); }
function createPen(next) { return { id: id(), type: "pen", x: next.x, y: next.y, rotation: 0, points: [{ x: 0, y: 0, pressure: next.pressure }], color: strokeColor.value, strokeWidth: strokeSize.value / documentTransform.value.scale, usePressure: false, masks: [] }; }
function createShape(next) { return { id: id(), type: "shape", shape: activeShape.value, x: next.x, y: next.y, rotation: 0, width: 1, height: 1, points: [0, 0, 1, 1], color: strokeColor.value, strokeWidth: strokeSize.value / documentTransform.value.scale, masks: [] }; }
function updateShape(item, from, to) { const x = Math.min(from.x, to.x), y = Math.min(from.y, to.y); item.x = x; item.y = y; item.width = Math.max(1, Math.abs(to.x - from.x)); item.height = Math.max(1, Math.abs(to.y - from.y)); item.points = [from.x - x, from.y - y, to.x - x, to.y - y]; }
function eraserAt(next) { const item = targetCommand(stageNode()?.getIntersection(screenPoint(next))); if (item) gesture.targets.add(item.id); }
function appendEraser(next) { const points = eraserPreview.value.points, last = points.at(-1), count = Math.max(1, Math.ceil(Math.hypot(next.x - last.x, next.y - last.y) / 8)); for (let i = 1; i <= count; i += 1) { const sample = { x: last.x + (next.x - last.x) * i / count, y: last.y + (next.y - last.y) * i / count, pressure: next.pressure }; points.push(sample); eraserAt(sample); } }
function maskFor(item, eraser) { const inverse = objectNode(item.id)?.getAbsoluteTransform().copy().invert(); return inverse && { strokeWidth: eraser.strokeWidth, usePressure: false, points: eraser.points.map((p) => ({ ...inverse.point(screenPoint(p)), pressure: p.pressure })) }; }
function handleDown(event) { const native = event.evt, next = point(event); if (native.button === 1 || native.button === 0 && (panMode.value || spacePressed.value)) { gesture = { type: "pan", last: eventScreenPoint(event) }; isPanning.value = true; return; } if (native.button) return; closePopover(); if (isTransformerTarget(event.target)) return; const hit = targetCommand(event.target); if (activeTool.value === "select") { selectedId.value = hit?.id || null; refresh(); return; } if (activeTool.value === "text") { if (hit?.type === "text") editText(hit.id); else gesture = { type: "text", point: next }; return; } const previous = clone(); if (activeTool.value === "pen") { draft.value = createPen(next); draft.value.usePressure = native.pointerType === "pen"; gesture = { type: "pen", previous }; } else if (activeTool.value === "shape") { draft.value = createShape(next); gesture = { type: "shape", from: next, previous }; } else if (activeTool.value === "eraser") { eraserPreview.value = { points: [next], strokeWidth: strokeSize.value / documentTransform.value.scale, usePressure: false }; gesture = { type: "eraser", previous, targets: new Set() }; eraserAt(next); } }
function handleMove(event) { const next = point(event), screen = eventScreenPoint(event); if (screen) pointerCursor.value = { x: screen.x, y: screen.y, visible: true }; if (!gesture) return; if (gesture.type === "pan") { pan.value = { x: pan.value.x + screen.x - gesture.last.x, y: pan.value.y + screen.y - gesture.last.y }; gesture.last = screen; return; } if (gesture.type === "text") return; if (gesture.type === "pen") normalizePen(draft.value, next); else if (gesture.type === "shape") updateShape(draft.value, gesture.from, next); else appendEraser(next); }
function finishGesture(event, cancelled = false) { if (!gesture) return; const current = gesture; gesture = null; isPanning.value = false; if (current.type === "pan" || cancelled) { draft.value = null; eraserPreview.value = null; return; } if (current.type === "text") { newText(current.point); return; } const next = point(event); if (current.type === "pen") { normalizePen(draft.value, next); commands.value.push(draft.value); draft.value = null; pushHistory(current.previous); announce(copy.messages.contentAdded); } else if (current.type === "shape") { updateShape(draft.value, current.from, next); if (Math.hypot(draft.value.width, draft.value.height) > 4) { commands.value.push(draft.value); selectedId.value = draft.value.id; activeTool.value = "select"; pushHistory(current.previous); announce(copy.messages.contentAdded); } draft.value = null; } else { appendEraser(next); current.targets.forEach((idValue) => { const item = command(idValue), mask = item && maskFor(item, eraserPreview.value); if (mask) (item.masks ||= []).push(mask); }); eraserPreview.value = null; if (current.targets.size) { pushHistory(current.previous); announce(copy.messages.contentErased); } } refresh(); }
function cancelGesture(event) { finishGesture(event, true); }
function selectionEnter() { if (activeTool.value === "select") selectionCursor.value = "grab"; }
function selectionLeave() { if (activeTool.value === "select" && !transformPrevious) selectionCursor.value = "default"; }
function dragStart(event) { const item = targetCommand(event.target); if (!item) return; selectedId.value = item.id; selectionCursor.value = "grabbing"; transformPrevious = clone(); }
function dragEnd(event) { const item = targetCommand(event.target); if (!item || !transformPrevious) return; item.x = event.target.x(); item.y = event.target.y(); item.rotation = event.target.rotation(); selectionCursor.value = "grab"; pushHistory(transformPrevious); transformPrevious = null; announce(copy.messages.objectMoved); refresh(); }
function scaleMask(mask, x, y) { return { ...mask, strokeWidth: mask.strokeWidth * ((Math.abs(x) + Math.abs(y)) / 2), points: mask.points.map((p) => ({ ...p, x: p.x * x, y: p.y * y })) }; }
function transformStart() { transformPrevious = clone(); }
function transformEnd(event) { const item = selectedCommand.value, node = event.target; if (!item || !transformPrevious) return; const x = node.scaleX(), y = node.scaleY(), strokeScale = (Math.abs(x) + Math.abs(y)) / 2; if (item.type === "pen") { item.points = item.points.map((p) => ({ ...p, x: p.x * x, y: p.y * y })); item.strokeWidth *= strokeScale; } else if (item.type === "shape") { item.width *= x; item.height *= y; item.points = item.points.map((p, i) => p * (i % 2 ? y : x)); item.strokeWidth *= strokeScale; } else if (item.type === "text") { item.width *= x; item.fontSize = Math.max(12, Math.min(160, item.fontSize * y)); } else { item.width *= x; item.height *= y; } item.masks = (item.masks || []).map((mask) => scaleMask(mask, x, y)); item.x = node.x(); item.y = node.y(); item.rotation = node.rotation(); node.scale({ x: 1, y: 1 }); pushHistory(transformPrevious); transformPrevious = null; announce(copy.messages.objectResized); refresh(); }
function newText(next) { const previous = clone(), item = { id: id(), type: "text", x: next.x, y: next.y, rotation: 0, text: "", width: 240, fontSize: 32, color: strokeColor.value, masks: [] }, editor = { id: item.id, previous, isNew: true }; commands.value.push(item); selectedId.value = item.id; activeTool.value = "select"; textEditor.value = editor; textValue.value = ""; refresh(); nextTick(() => textInput.value?.focusAtEnd()); }
function editText(idValue) { const item = command(idValue); if (!item || item.type !== "text") return; selectedId.value = idValue; textEditor.value = { id: idValue, previous: clone(), isNew: false }; textValue.value = item.text; activeTool.value = "select"; refresh(); nextTick(() => { objectNode(idValue)?.findOne(".sketch-text")?.opacity(0); textInput.value?.focusAtEnd(); }); }
function commitText() { const editor = textEditor.value, item = editor && command(editor.id); if (!editor || !item) return; textEditor.value = null; item.text = textValue.value.replace(/\r/g, "").trimEnd(); const textNode = objectNode(item.id)?.findOne(".sketch-text"); textNode?.visible(true); textNode?.opacity(1); if (!item.text.trim()) { commands.value = editor.isNew ? editor.previous : commands.value.filter((entry) => entry.id !== item.id); selectedId.value = null; if (!editor.isNew) pushHistory(editor.previous); } else if (JSON.stringify(editor.previous) !== JSON.stringify(commands.value)) { pushHistory(editor.previous); announce(editor.isNew ? copy.messages.textAdded : copy.messages.textUpdated); } refresh(); }
function cancelText() { const editor = textEditor.value; if (!editor) return; commands.value = editor.previous; selectedId.value = editor.isNew ? null : editor.id; textEditor.value = null; textValue.value = ""; refresh(); }
function contextMenu(event) { event.preventDefault(); const item = targetCommand(stageNode()?.getIntersection(eventScreenPoint(event))); if (!item) return; selectedId.value = item.id; activeTool.value = "select"; objectContextMenu.value = eventScreenPoint(event); refresh(); }
function moveItem(next, message) { const from = selectionOrder.value; if (from < 0 || from === next) return; const previous = clone(), [item] = commands.value.splice(from, 1); commands.value.splice(Math.max(0, Math.min(next, commands.value.length)), 0, item); objectContextMenu.value = null; pushHistory(previous); announce(message); refresh(); }
function zoomBy(factor, focus = { x: stageSize.value.width / 2, y: stageSize.value.height / 2 }) { const next = Math.max(minZoom, Math.min(maxZoom, zoom.value * factor)); if (next === zoom.value) return false; const before = { x: (focus.x - documentTransform.value.x) / documentTransform.value.scale, y: (focus.y - documentTransform.value.y) / documentTransform.value.scale }, fit = documentTransform.value.scale / zoom.value; zoom.value = Math.round(next * 1000) / 1000; const scale = fit * zoom.value; pan.value = { x: focus.x - (stageSize.value.width - documentSize.value.width * scale) / 2 - before.x * scale, y: focus.y - (stageSize.value.height - 1000 * scale) / 2 - before.y * scale }; refresh(); return true; }
function setPanMode(value = !panMode.value) { panMode.value = value; }
function resetView() { zoom.value = 1; pan.value = { x: 0, y: 0 }; refresh(); announce(copy.messages.canvasViewReset); }
function toggleView(anchor) { if (activePopover.value === "view") return closePopover(); openPopover("view", anchor, { togglePan: () => setPanMode(), zoomIn: () => zoomBy(1.2), zoomOut: () => zoomBy(1 / 1.2), reset: resetView }, { get zoomPercent() { return zoomPercent.value; }, get panActive() { return panMode.value; }, get canZoomIn() { return zoom.value < maxZoom; }, get canZoomOut() { return zoom.value > minZoom; } }); }
function createOutputCanvas() { const stage = stageNode(), t = transformer.value?.getNode?.(), visible = t?.visible(), preview = eraserPreview.value; if (!stage) return null; if (t) t.visible(false); eraserPreview.value = null; stage.draw(); const output = stage.toCanvas({ pixelRatio: window.devicePixelRatio || 1 }); if (t) t.visible(visible); eraserPreview.value = preview; stage.batchDraw(); return output; }
function clearCanvas() { const previous = clone(); commands.value = []; selectedId.value = null; pushHistory(previous); closePopover(); resetView(); announce(copy.messages.canvasCleared); }
function backgroundMenu(anchor) { if (activePopover.value === "background") return closePopover(); openPopover("background", anchor, { preview: (color) => { backgroundPreviewColor.value = color; refresh(); }, select: (color) => { if (color === backgroundColor.value) return; const previous = clone(), previousColor = backgroundColor.value; backgroundColor.value = color; backgroundPreviewColor.value = null; pushHistory(previous, { backgroundColor: previousColor }); refresh(); } }, { get current() { return backgroundColor.value; } }); }
function closeDialog() { emit("update:modelValue", false); }
function keydown(event) { if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return; if (event.code === "Space") { event.preventDefault(); spacePressed.value = true; return; } const modifier = event.metaKey || event.ctrlKey; if (modifier && event.key.toLowerCase() === "z") { event.preventDefault(); return event.shiftKey ? redo() : undo(); } if (event.key === "Escape") { selectedId.value = null; return refresh(); } if (["Backspace", "Delete"].includes(event.key) && selectedId.value) { const previous = clone(); commands.value = commands.value.filter((item) => item.id !== selectedId.value); selectedId.value = null; pushHistory(previous); refresh(); } }
watch(textValue, (value) => { if (textEditor.value) command(textEditor.value.id).text = value; });
watch([selectedId, activeTool], refresh);
watch(activePopover, (value, previous) => { if (previous === "background" && value !== "background") backgroundPreviewColor.value = null; });
onMounted(() => { observer = new ResizeObserver(resizeCanvases); observer.observe(stageContainer.value); window.addEventListener("pointermove", handleMove); window.addEventListener("pointerup", finishGesture); window.addEventListener("pointercancel", cancelGesture); resizeCanvases(); });
onBeforeUnmount(() => { observer?.disconnect(); window.removeEventListener("pointermove", handleMove); window.removeEventListener("pointerup", finishGesture); window.removeEventListener("pointercancel", cancelGesture); });
</script>

<template>
  <Teleport :to="teleportTarget"><div v-show="modelValue" class="sketch-modal chat-sketch-canvas" :class="{ 'is-interface-fullscreen': interfaceFullscreen, 'is-embedded': embedded }"><div class="sketch-backdrop"></div><div ref="dialog" class="sketch-dialog" :style="dialogStyle" tabindex="-1" @keydown="keydown" @keyup="(event) => { if (event.code === 'Space') spacePressed = false; }"><section class="sketch-editor"><div id="sketch-popover-host"></div>
    <SketchToolbar :active-tool="activeTool" :active-shape="activeShape" :shape-menu-open="activePopover === 'shape'" :can-undo="canUndo" :can-redo="canRedo" :is-fullscreen="isFullscreen" :is-browser-fullscreen="browserFullscreen" :has-content="hasContent" :controls-outside="effectiveControlsOutside" :zoom-percent="zoomPercent" :active-popover="activePopover" :image-loading="imageLoading" :embedded="embedded" @close="closeDialog" @select-tool="(tool) => { setPanMode(false); controls.selectTool(tool); }" @toggle-shapes="controls.toggleShapeMenu" @select-shape="controls.selectShape" @undo="undo" @redo="redo" @clear="(anchor) => openPopover('clear', anchor, { confirm: clearCanvas, cancel: closePopover })" @toggle-controls="controls.toggleControlsOutside" @toggle-ratio="controls.toggleRatioMenu" @toggle-background="backgroundMenu" @toggle-browser-fullscreen="toggleBrowserFullscreen" @toggle-view="toggleView" @add-image="openImagePicker" @close-popover="closePopover" />
    <input ref="imageInput" hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" @change="addImage" />
    <div class="sketch-body"><div ref="stageContainer" class="sketch-stage" tabindex="0" :class="{ 'is-image-drag-active': imageDragActive, 'is-transparent-background': background === 'transparent' }" :style="{ cursor: canvasCursor }" @dragenter="handleImageDragEnter" @dragover="handleImageDragOver" @dragleave="handleImageDragLeave" @drop="handleImageDrop" @contextmenu="contextMenu">
      <v-stage ref="konvaStage" class="konva-stage" :config="stageConfig" @pointerdown="handleDown" @mouseleave="() => { pointerCursor.visible = false; }" @dblclick="(event) => { const item = targetCommand(event.target); if (item?.type === 'text') editText(item.id); }" @wheel="(event) => { event.evt.preventDefault(); zoomBy(Math.exp(-event.evt.deltaY * .0015), eventScreenPoint(event)); }">
        <v-layer><v-rect :config="{ width: stageSize.width, height: stageSize.height, fill: background, listening: false }" /></v-layer>
        <v-layer><v-group ref="documentGroup" :config="documentConfig"><v-group v-for="item in commands" :key="item.id" :ref="(node) => registerNode(item.id, node)" :config="config(item)">
          <v-image v-if="item.type === 'image'" :config="imageConfig(item)" /><v-text v-else-if="item.type === 'text'" :config="textConfig(item)" /><v-shape v-else-if="item.type === 'pen'" :config="freehandConfig(item)" /><v-rect v-else-if="item.shape === 'rectangle'" :config="lineConfig(item)" /><v-ellipse v-else-if="item.shape === 'ellipse'" :config="{ ...lineConfig(item), x: item.width / 2, y: item.height / 2, radiusX: item.width / 2, radiusY: item.height / 2 }" /><v-line v-else-if="item.shape === 'line'" :config="{ ...lineConfig(item), points: item.points }" /><v-arrow v-else-if="item.shape === 'arrow'" :config="{ ...lineConfig(item), points: item.points }" /><v-regular-polygon v-else-if="item.shape === 'triangle'" :config="polygonConfig(item, 3, -90)" /><v-regular-polygon v-else-if="item.shape === 'diamond'" :config="polygonConfig(item, 4, 45)" /><v-star v-else-if="item.shape === 'star'" :config="starConfig(item)" /><v-shape v-else :config="heartConfig(item)" /><v-shape v-for="(mask, i) in item.masks" :key="`${item.id}-${i}`" :config="maskConfig(mask)" />
        </v-group><v-group v-if="draft" :config="config(draft)"><v-shape v-if="draft.type === 'pen'" :config="freehandConfig(draft)" /><v-rect v-else-if="draft.shape === 'rectangle'" :config="lineConfig(draft)" /><v-ellipse v-else-if="draft.shape === 'ellipse'" :config="{ ...lineConfig(draft), x: draft.width / 2, y: draft.height / 2, radiusX: draft.width / 2, radiusY: draft.height / 2 }" /><v-line v-else-if="draft.shape === 'line'" :config="{ ...lineConfig(draft), points: draft.points }" /><v-arrow v-else-if="draft.shape === 'arrow'" :config="{ ...lineConfig(draft), points: draft.points }" /><v-regular-polygon v-else-if="draft.shape === 'triangle'" :config="polygonConfig(draft, 3, -90)" /><v-regular-polygon v-else-if="draft.shape === 'diamond'" :config="polygonConfig(draft, 4, 45)" /><v-star v-else-if="draft.shape === 'star'" :config="starConfig(draft)" /><v-shape v-else :config="heartConfig(draft)" /></v-group></v-group></v-layer>
        <v-layer><v-group :config="documentConfig"><v-shape v-if="eraserPreview" :config="freehandConfig(eraserPreview, true)" /><v-transformer ref="transformer" :config="transformerConfig" /></v-group></v-layer>
      </v-stage><ImageDropOverlay :visible="imageDragActive" /><ObjectContextMenu v-if="objectContextMenu" :style="menuStyle" :can-move-backward="canMoveBackward" :can-move-forward="canMoveForward" @send-to-back="() => moveItem(0, copy.messages.sentToBack)" @move-backward="() => moveItem(selectionOrder - 1, copy.messages.movedBackward)" @move-forward="() => moveItem(selectionOrder + 1, copy.messages.movedForward)" @bring-to-front="() => moveItem(commands.length - 1, copy.messages.broughtToFront)" /><span class="brush-cursor" :style="pointerCursorStyle"></span><StrokeSizePreview :visible="strokeSizePreviewVisible" :size="strokeSize" :color="strokeColor" /><SketchTextEditor v-if="textEditor" ref="textInput" v-model="textValue" :style="textEditorStyle" @cancel="cancelText" @commit="commitText" /></div></div>
    <ColorPalette :model-value="strokeColor" :outside="effectiveControlsOutside" @update:model-value="controls.setStrokeColor" /><OutputActions :disabled="!hasContent" :can-copy="hasContent" :can-attach="Boolean(submit)" :attaching="attaching" :copy-succeeded="copySucceeded" :outside="effectiveControlsOutside" @attach="attachCanvas" @download="downloadCanvas" @copy="copyCanvas" /><StrokeSizeControl :model-value="strokeSize" :outside="effectiveControlsOutside" @adjust-start="strokeSizePreviewVisible = true" @adjust-end="strokeSizePreviewVisible = false" @update:model-value="controls.setStrokeSize" /><span class="sr-only">{{ statusMessage }}</span>
  </section></div></div></Teleport>
</template>

<style scoped>
.sketch-modal{position:fixed;z-index:100;inset:0;display:grid;place-items:center}.sketch-backdrop{position:absolute;inset:0;background:var(--sketch-color-backdrop);backdrop-filter:blur(3px)}.sketch-modal.is-interface-fullscreen{place-items:stretch}.sketch-modal.is-interface-fullscreen .sketch-backdrop,.sketch-modal.is-embedded .sketch-backdrop{display:none}.sketch-modal.is-interface-fullscreen .sketch-dialog{width:100vw;height:100dvh;aspect-ratio:auto;border-radius:0;box-shadow:none}.sketch-modal.is-interface-fullscreen .sketch-body{border-radius:0}.sketch-dialog{position:relative;width:min(760px,calc(100vw - 32px),calc((100dvh - 32px) * var(--sketch-ratio)));aspect-ratio:var(--sketch-ratio);border-radius:var(--sketch-radius-md);box-shadow:var(--sketch-shadow-dialog);outline:0;overflow:visible;transform:translateX(var(--sketch-outside-offset-x,0))}.sketch-editor,.sketch-body,.sketch-stage{position:relative;width:100%;height:100%}.sketch-body{overflow:hidden;border-radius:var(--sketch-radius-md);background:var(--sketch-color-surface)}.sketch-stage,.konva-stage,.konva-stage :deep(.konvajs-content),.sketch-stage canvas{border-radius:inherit}.sketch-stage{outline:0;touch-action:none;user-select:none}.konva-stage,.konva-stage :deep(.konvajs-content),.sketch-stage canvas{position:absolute;inset:0;width:100%;height:100%}.sketch-stage.is-transparent-background{background-color:#181818;background-image:linear-gradient(45deg,#282828 25%,transparent 25%),linear-gradient(-45deg,#282828 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#282828 75%),linear-gradient(-45deg,transparent 75%,#282828 75%);background-position:0 0,0 10px,10px -10px,-10px 0;background-size:20px 20px}.brush-cursor{position:absolute;z-index:9;border:1px solid #fff;border-radius:50%;box-shadow:0 0 0 1px #000;pointer-events:none;transform:translate(-50%,-50%)}@media(max-width:640px){.sketch-dialog{width:min(calc(100vw - 16px),calc((100dvh - 16px) * var(--sketch-ratio)))}}
</style>
