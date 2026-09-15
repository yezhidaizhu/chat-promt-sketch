import { computed, ref } from "vue";

const minZoom = 0.25;
const maxZoom = 4;

export function useSketchKonvaCanvas({ commands, backgroundColor, isTextEditing, beforeRender, drawCommand, drawSelection }) {
  const container = ref(null);
  const stage = ref(null);
  const backgroundLayer = ref(null);
  const backgroundRect = ref(null);
  const contentLayer = ref(null);
  const overlayLayer = ref(null);
  const stageSize = ref({ width: 1, height: 1 });
  const zoom = ref(1);
  const pan = ref({ x: 0, y: 0 });
  const panMode = ref(false);
  const spacePressed = ref(false);
  const isPanning = ref(false);
  const measurementContext = document.createElement("canvas").getContext("2d");

  let liveCommand = null;
  let eraserPreview = null;
  let panGesture = null;

  const stageConfig = computed(() => ({ ...stageSize.value }));
  const zoomPercent = computed(() => Math.round(zoom.value * 100));
  const isDefaultView = computed(() => zoom.value === 1 && pan.value.x === 0 && pan.value.y === 0);
  const backgroundConfig = computed(() => ({
    x: 0,
    y: 0,
    ...stageSize.value,
    fill: backgroundColor.value,
    listening: false,
  }));

  function drawContentScene(context) {
    commands.value.forEach((command) => drawCommand(context, command));
    if (eraserPreview) drawCommand(context, eraserPreview);
  }

  function drawOverlayScene(context) {
    if (liveCommand) drawCommand(context, liveCommand, true);
    else if (!isTextEditing()) drawSelection(context);
  }

  function render() {
    if (!stage.value) return;
    beforeRender?.();
    liveCommand = null;
    eraserPreview = null;
    const backgroundNode = backgroundRect.value?.getNode();
    if (backgroundNode) backgroundNode.fill(backgroundColor.value);
    backgroundLayer.value?.getNode().batchDraw();
    contentLayer.value?.getNode().batchDraw();
    overlayLayer.value?.getNode().batchDraw();
  }

  function renderLive(command) {
    liveCommand = command;
    eraserPreview = null;
    overlayLayer.value?.getNode().batchDraw();
  }

  function renderEraserPreview(command) {
    liveCommand = null;
    eraserPreview = command;
    contentLayer.value?.getNode().batchDraw();
    overlayLayer.value?.getNode().batchDraw();
  }

  function resizeCanvases() {
    if (!container.value) return;
    const width = container.value.clientWidth;
    const height = container.value.clientHeight;
    if (!width || !height) return;
    stageSize.value = { width, height };
    stage.value?.getNode().size({ width, height });
    render();
  }

  function eventPoint(event) {
    const bounds = container.value.getBoundingClientRect();
    const scaleX = container.value.clientWidth / bounds.width;
    const scaleY = container.value.clientHeight / bounds.height;
    return {
      x: (event.clientX - bounds.left) * scaleX,
      y: (event.clientY - bounds.top) * scaleY,
      pressure: event.pressure || 0.5,
    };
  }

  function setZoom(nextZoom, focalPoint = { x: stageSize.value.width / 2, y: stageSize.value.height / 2 }) {
    const clamped = Math.min(maxZoom, Math.max(minZoom, nextZoom));
    const rounded = Math.round(clamped * 1000) / 1000;
    if (rounded === zoom.value) return false;
    const center = { x: stageSize.value.width / 2, y: stageSize.value.height / 2 };
    const worldOffset = {
      x: (focalPoint.x - center.x - pan.value.x) / zoom.value,
      y: (focalPoint.y - center.y - pan.value.y) / zoom.value,
    };
    pan.value = {
      x: focalPoint.x - center.x - worldOffset.x * rounded,
      y: focalPoint.y - center.y - worldOffset.y * rounded,
    };
    zoom.value = rounded;
    render();
    return true;
  }

  function zoomBy(factor, focalPoint) {
    return setZoom(zoom.value * factor, focalPoint);
  }

  function resetView() {
    if (isDefaultView.value) return false;
    zoom.value = 1;
    pan.value = { x: 0, y: 0 };
    render();
    return true;
  }

  function handleWheel(event) {
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0015);
    zoomBy(factor, eventPoint(event));
  }

  function setPanMode(active = !panMode.value) {
    panMode.value = active;
  }

  function setSpacePressed(active) {
    spacePressed.value = active;
  }

  function startPan(event) {
    const primaryPan = event.button === 0 && (panMode.value || spacePressed.value);
    if (event.button !== 1 && !primaryPan) return false;
    event.preventDefault();
    const point = eventPoint(event);
    panGesture = { pointerId: event.pointerId, target: event.currentTarget, x: point.x, y: point.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    isPanning.value = true;
    return true;
  }

  function movePan(event) {
    if (!panGesture || event.pointerId !== panGesture.pointerId) return false;
    event.preventDefault();
    const point = eventPoint(event);
    pan.value = {
      x: pan.value.x + point.x - panGesture.x,
      y: pan.value.y + point.y - panGesture.y,
    };
    panGesture.x = point.x;
    panGesture.y = point.y;
    render();
    return true;
  }

  function finishPan(event) {
    if (!panGesture || event.pointerId !== panGesture.pointerId) return false;
    if (panGesture.target?.hasPointerCapture(panGesture.pointerId)) panGesture.target.releasePointerCapture(panGesture.pointerId);
    panGesture = null;
    isPanning.value = false;
    return true;
  }

  function cancelPan() {
    if (panGesture?.target?.hasPointerCapture(panGesture.pointerId)) panGesture.target.releasePointerCapture(panGesture.pointerId);
    panGesture = null;
    isPanning.value = false;
    spacePressed.value = false;
  }

  function createOutputCanvas() {
    const stageNode = stage.value?.getNode();
    const overlayNode = overlayLayer.value?.getNode();
    if (!stageNode || !overlayNode) return null;
    const wasVisible = overlayNode.visible();
    overlayNode.visible(false);
    stageNode.draw();
    const output = stageNode.toCanvas({ pixelRatio: window.devicePixelRatio || 1 });
    overlayNode.visible(wasVisible);
    overlayNode.batchDraw();
    return output;
  }

  return {
    container,
    stage,
    backgroundLayer,
    backgroundRect,
    contentLayer,
    overlayLayer,
    stageSize,
    zoom,
    pan,
    panMode,
    spacePressed,
    isPanning,
    minZoom,
    maxZoom,
    zoomPercent,
    stageConfig,
    backgroundConfig,
    measurementContext,
    drawContentScene,
    drawOverlayScene,
    render,
    renderLive,
    renderEraserPreview,
    resizeCanvases,
    eventPoint,
    zoomBy,
    resetView,
    handleWheel,
    setPanMode,
    setSpacePressed,
    startPan,
    movePan,
    finishPan,
    cancelPan,
    createOutputCanvas,
  };
}
