import { onBeforeUnmount } from "vue";

const maxImageBytes = 25 * 1024 * 1024;
let fallbackId = 0;

export function useSketchImageAssets() {
  const assets = new Map();

  async function addImageFile(file) {
    if (!file?.type.startsWith("image/")) throw new Error("unsupported");
    if (file.size > maxImageBytes) throw new Error("too-large");

    const url = URL.createObjectURL(file);
    const image = new window.Image();
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("decode-failed");
    }

    const id = crypto.randomUUID?.() || `sketch-image-${Date.now()}-${fallbackId += 1}`;
    const asset = { id, image, url, width: image.naturalWidth, height: image.naturalHeight };
    assets.set(id, asset);
    return asset;
  }

  function getImage(id) {
    return assets.get(id)?.image || null;
  }

  onBeforeUnmount(() => {
    assets.forEach((asset) => URL.revokeObjectURL(asset.url));
    assets.clear();
  });

  return { addImageFile, getImage };
}
