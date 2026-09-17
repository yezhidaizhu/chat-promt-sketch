import { ref } from "vue";
import { locale } from "../locales/index.js";
import { closePopover } from "./usePopover.js";
import { useSketchImageAssets } from "./useSketchImageAssets.js";
import { dismissToast, showToast } from "./useToast.js";

const copy = locale.sketch;

export function useSketchImageImport({
  stage,
  documentSize,
  commands,
  activeTool,
  selectedId,
  clone,
  pushHistory,
  announce,
  documentPoint,
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
      const maxWidth = documentSize.value.width * 0.6;
      const maxHeight = documentSize.value.height * 0.6;
      const scale = Math.min(1, maxWidth / asset.width, maxHeight / asset.height);
      const width = Math.max(1, asset.width * scale);
      const height = Math.max(1, asset.height * scale);
      const x = dropPoint ? Math.min(documentSize.value.width - width, Math.max(0, dropPoint.x - width / 2)) : (documentSize.value.width - width) / 2;
      const y = dropPoint ? Math.min(documentSize.value.height - height, Math.max(0, dropPoint.y - height / 2)) : (documentSize.value.height - height) / 2;
      const previous = clone();
      const id = crypto.randomUUID?.() || `sketch-image-${Date.now()}`;
      commands.value.push({
        id,
        type: "image",
        assetId: asset.id,
        x,
        y,
        rotation: 0,
        width,
        height,
        masks: [],
      });
      setPanMode(false);
      activeTool.value = "select";
      selectedId.value = id;
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
    await insertImage(source, documentPoint(event));
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
