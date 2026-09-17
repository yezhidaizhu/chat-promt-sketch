import { ref } from "vue";
import { locale } from "../locales/index.js";
import { closePopover } from "./usePopover.js";
import { useSketchImageAssets } from "./useSketchImageAssets.js";
import { dismissToast, showToast } from "./useToast.js";

const copy = locale.sketch;

export function useSketchImageImport({
  stage,
  stageSize,
  commands,
  activeTool,
  selectedIndex,
  selectionCursor,
  clone,
  pushHistory,
  announce,
  normalizePoint,
  eventPoint,
  setPanMode,
}) {
  const imageInput = ref(null);
  const imageLoading = ref(false);
  const imageDragActive = ref(false);
  const { addImageFile, addImageUrl, getImage } = useSketchImageAssets();
  let imageDragDepth = 0;

  function openImagePicker() {
    imageInput.value?.click();
  }

  async function addImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await insertImage(file);
  }

  async function insertImage(source, dropPoint = null) {
    if (imageLoading.value) return;
    dismissToast();
    imageLoading.value = true;
    announce(copy.messages.imageLoading);
    try {
      const asset = typeof source === "string" ? await addImageUrl(source) : await addImageFile(source);
      const maxWidth = stageSize.value.width * 0.6;
      const maxHeight = stageSize.value.height * 0.6;
      const scale = Math.min(1, maxWidth / asset.width, maxHeight / asset.height);
      const width = Math.max(1, asset.width * scale);
      const height = Math.max(1, asset.height * scale);
      const x = dropPoint ? Math.min(stageSize.value.width - width, Math.max(0, dropPoint.x - width / 2)) : (stageSize.value.width - width) / 2;
      const y = dropPoint ? Math.min(stageSize.value.height - height, Math.max(0, dropPoint.y - height / 2)) : (stageSize.value.height - height) / 2;
      const start = normalizePoint({ x, y });
      const end = normalizePoint({ x: x + width, y: y + height });
      const previous = clone();
      commands.value.push({
        type: "image",
        assetId: asset.id,
        x: start.x,
        y: start.y,
        width: end.x - start.x,
        height: end.y - start.y,
        worldSize: true,
      });
      setPanMode(false);
      activeTool.value = "select";
      selectedIndex.value = commands.value.length - 1;
      selectionCursor.value = "grab";
      pushHistory(previous);
      stage.value?.focus();
      announce(copy.messages.imageAdded);
    } catch (error) {
      const message = error.message === "too-large" ? copy.messages.imageTooLarge : error.message === "url-unavailable" ? copy.messages.imageUrlUnavailable : error.message === "unsupported" ? copy.messages.imageUnsupported : copy.messages.imageLoadFailed;
      showToast(message, { type: "error" });
    } finally {
      imageLoading.value = false;
    }
  }

  function isImageDrag(event) {
    const types = Array.from(event.dataTransfer?.types || [], (type) => type.toLowerCase());
    return types.some((type) => ["files", "text/html", "text/uri-list", "text/plain", "downloadurl"].includes(type));
  }

  function handleImageDragEnter(event) {
    if (!isImageDrag(event)) return;
    event.preventDefault();
    imageDragDepth += 1;
    imageDragActive.value = true;
  }

  function handleImageDragOver(event) {
    if (!isImageDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleImageDragLeave(event) {
    if (!imageDragActive.value) return;
    event.preventDefault();
    imageDragDepth = Math.max(0, imageDragDepth - 1);
    if (!imageDragDepth) imageDragActive.value = false;
  }

  async function handleImageDrop(event) {
    event.preventDefault();
    imageDragDepth = 0;
    imageDragActive.value = false;
    const files = Array.from(event.dataTransfer?.files || []);
    const file = files.find((item) => item.type.startsWith("image/")) || files[0];
    let source = file;
    if (!source) {
      const html = event.dataTransfer?.getData("text/html") || "";
      const imageSource = html ? new DOMParser().parseFromString(html, "text/html").querySelector("img")?.getAttribute("src") : "";
      const uri = (event.dataTransfer?.getData("text/uri-list") || "").split(/\r?\n/).find((line) => line && !line.startsWith("#"));
      const downloadUrl = (event.dataTransfer?.getData("DownloadURL") || "").match(/^[^:]+:[^:]*:(.+)$/)?.[1];
      const plainText = (event.dataTransfer?.getData("text/plain") || "").trim();
      source = imageSource || uri || downloadUrl || plainText || "";
    }
    if (!source) return;
    closePopover();
    await insertImage(source, eventPoint(event));
  }

  return {
    imageInput,
    imageLoading,
    imageDragActive,
    getImage,
    openImagePicker,
    addImage,
    handleImageDragEnter,
    handleImageDragOver,
    handleImageDragLeave,
    handleImageDrop,
  };
}
