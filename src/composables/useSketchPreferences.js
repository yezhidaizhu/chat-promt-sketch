import { ref, watch } from "vue";

const storageKey = "chat-promt-sketch:preferences";
const defaultPreferences = {
  controlsOutside: false,
  canvasRatio: "1:1",
  strokeColor: "#ffffff",
  strokeSize: 13,
  backgroundColor: "#171717",
};

function readPreferences() {
  if (typeof localStorage === "undefined") return defaultPreferences;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    return {
      ...defaultPreferences,
      ...(saved && typeof saved === "object" ? saved : {}),
    };
  } catch {
    return defaultPreferences;
  }
}

const saved = readPreferences();
const controlsOutside = ref(Boolean(saved.controlsOutside));
const canvasRatio = ref(["1:1", "4:3", "16:9", "3:4", "9:16"].includes(saved.canvasRatio) ? saved.canvasRatio : defaultPreferences.canvasRatio);
const strokeColor = ref(typeof saved.strokeColor === "string" ? saved.strokeColor : defaultPreferences.strokeColor);
const strokeSize = ref(Number.isFinite(Number(saved.strokeSize)) ? Math.min(80, Math.max(1, Number(saved.strokeSize))) : defaultPreferences.strokeSize);
const backgroundColor = ref(typeof saved.backgroundColor === "string" ? saved.backgroundColor : defaultPreferences.backgroundColor);

watch([controlsOutside, canvasRatio, strokeColor, strokeSize, backgroundColor], () => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(storageKey, JSON.stringify({
    controlsOutside: controlsOutside.value,
    canvasRatio: canvasRatio.value,
    strokeColor: strokeColor.value,
    strokeSize: strokeSize.value,
    backgroundColor: backgroundColor.value,
  }));
});

export function useSketchPreferences() {
  return { controlsOutside, canvasRatio, strokeColor, strokeSize, backgroundColor };
}
