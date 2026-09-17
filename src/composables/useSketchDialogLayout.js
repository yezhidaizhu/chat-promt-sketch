import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { locale } from "../locales/index.js";
import { closePopover } from "./usePopover.js";

const copy = locale.sketch;

export function useSketchDialogLayout({
  dialog,
  stage,
  controlsOutside,
  canvasRatio,
  commands,
  initialLayout,
  getLayout,
  getEmbedded,
  getModelValue,
  emitLayout,
  resizeCanvases,
  announce,
}) {
  const viewport = ref({ width: window.innerWidth, height: window.innerHeight });
  const drawingRatio = ref(1);
  const localLayout = ref(initialLayout);
  const browserFullscreen = ref(Boolean(document.fullscreenElement));
  let resizeObserver;
  let browserFullscreenTransition;

  const canvasLayout = computed({
    get: () => getLayout() || localLayout.value,
    set: (value) => {
      localLayout.value = value;
      emitLayout(value);
    },
  });
  const interfaceFullscreen = computed({
    get: () => canvasLayout.value === "fill",
    set: (value) => { canvasLayout.value = value ? "fill" : "ratio"; },
  });
  const isFullscreen = computed(() => interfaceFullscreen.value || browserFullscreen.value);
  const effectiveControlsOutside = computed(() => controlsOutside.value && !isFullscreen.value);
  const ratioValue = computed(() => {
    const [width, height] = canvasRatio.value.split(":").map(Number);
    return width / height;
  });
  const dialogStyle = computed(() => {
    const style = { "--sketch-ratio": ratioValue.value };
    if (interfaceFullscreen.value || !effectiveControlsOutside.value) return style;

    const outsideHeight = 104;
    const outsideWidth = 60;
    const compact = viewport.value.width <= 720;
    const canvasWidth = Math.min(
      760,
      viewport.value.width - 32 - outsideWidth * (compact ? 1 : 2),
      (viewport.value.height - 32 - outsideHeight) * ratioValue.value,
    );
    return {
      ...style,
      ...(compact ? { "--sketch-outside-offset-x": `${outsideWidth / 2}px` } : {}),
      width: `${canvasWidth}px`,
    };
  });

  function waitForCanvasTransition() {
    return new Promise((resolve) => {
      const element = dialog.value;
      if (!element) { resolve(); return; }
      let timer;
      const finish = () => {
        clearTimeout(timer);
        element.removeEventListener("transitionend", onTransitionEnd);
        resolve();
      };
      const onTransitionEnd = (event) => {
        if (event.target === element && ["width", "aspect-ratio"].includes(event.propertyName)) finish();
      };
      element.addEventListener("transitionend", onTransitionEnd);
      timer = setTimeout(finish, 240);
    });
  }

  async function changeCanvasRatio(ratio) {
    const fillWindow = ratio === "fill";
    if (fillWindow === interfaceFullscreen.value && (fillWindow || ratio === canvasRatio.value)) {
      closePopover();
      return;
    }
    interfaceFullscreen.value = fillWindow;
    if (!fillWindow) {
      canvasRatio.value = ratio;
      if (!commands.value.length) drawingRatio.value = ratioValue.value;
    }
    closePopover();
    await nextTick();
    await waitForCanvasTransition();
    resizeCanvases();
    announce(fillWindow ? copy.messages.canvasFilled : copy.messages.canvasRatio(ratio));
  }

  async function toggleBrowserFullscreen() {
    try {
      browserFullscreenTransition = true;
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      browserFullscreenTransition = null;
      announce(copy.messages.fullscreenUnsupported);
    }
  }

  async function syncBrowserFullscreen() {
    browserFullscreen.value = Boolean(document.fullscreenElement);
    if (!browserFullscreenTransition) return;
    browserFullscreenTransition = null;
    await nextTick();
    await waitForCanvasTransition();
    resizeCanvases();
  }

  function updateViewport() {
    viewport.value = { width: window.innerWidth, height: window.innerHeight };
  }

  watch(getModelValue, async (isOpen) => {
    await nextTick();
    if (!dialog.value || !isOpen) return;
    await nextTick();
    resizeCanvases();
    stage.value?.focus();
  });

  onMounted(() => {
    drawingRatio.value = ratioValue.value;
    resizeObserver = new ResizeObserver(() => {
      if (getModelValue()) resizeCanvases();
    });
    if (stage.value) resizeObserver.observe(stage.value);
    window.addEventListener("resize", updateViewport);
    document.addEventListener("fullscreenchange", syncBrowserFullscreen);
    if (getModelValue()) {
      nextTick(() => {
        resizeCanvases();
        stage.value?.focus();
      });
    }
  });

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    window.removeEventListener("resize", updateViewport);
    document.removeEventListener("fullscreenchange", syncBrowserFullscreen);
  });

  return {
    drawingRatio,
    ratioValue,
    dialogStyle,
    interfaceFullscreen,
    browserFullscreen,
    isFullscreen,
    effectiveControlsOutside,
    changeCanvasRatio,
    toggleBrowserFullscreen,
  };
}
