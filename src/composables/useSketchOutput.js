import { onBeforeUnmount, ref } from "vue";
import { locale } from "../locales/index.js";

const copy = locale.sketch;

export function useSketchOutput({ hasContent, createOutputCanvas, getSubmit, emitDownload, announce, close }) {
  const copySucceeded = ref(false);
  const attaching = ref(false);
  let copyFeedbackTimer;

  async function copyCanvas() {
    if (!hasContent.value || !navigator.clipboard || typeof ClipboardItem === "undefined") {
      announce(copy.messages.copyUnsupported);
      return;
    }
    const output = createOutputCanvas();
    if (!output) return;
    output.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        copySucceeded.value = true;
        clearTimeout(copyFeedbackTimer);
        copyFeedbackTimer = setTimeout(() => { copySucceeded.value = false; }, 1600);
        announce(copy.messages.imageCopied);
      } catch {
        copySucceeded.value = false;
        announce(copy.messages.copyFailed);
      }
    }, "image/png");
  }

  function downloadCanvas() {
    const output = createOutputCanvas();
    if (!output) return;

    const link = document.createElement("a");
    link.download = `sketch-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = output.toDataURL("image/png");
    link.click();
    emitDownload(link.download);
    announce(copy.messages.imageDownloaded);
  }

  async function attachCanvas() {
    const submit = getSubmit();
    if (!hasContent.value || !submit || attaching.value) return;
    const output = createOutputCanvas();
    if (!output) return;
    const blob = await new Promise((resolve) => output.toBlob(resolve, "image/png"));
    if (!blob) {
      announce("Unable to generate PNG");
      return;
    }

    attaching.value = true;
    try {
      const result = await submit({
        blob,
        filename: `chat-sketch-${new Date().toISOString().slice(0, 10)}.png`,
        width: output.width,
        height: output.height,
      });
      announce(result?.message || (result?.ok ? "Sketch attached to chat." : "Sketch attachment failed."));
      if (result?.ok) close();
    } catch {
      announce("Sketch attachment failed.");
    } finally {
      attaching.value = false;
    }
  }

  onBeforeUnmount(() => clearTimeout(copyFeedbackTimer));

  return { copySucceeded, attaching, copyCanvas, downloadCanvas, attachCanvas };
}
