import type { DefineComponent, Plugin } from "vue";

export type SketchAsset = {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
};

export type SketchSubmitResult = {
  ok: boolean;
  message?: string;
};

export const SketchCanvasPlugin: Plugin;
export const SketchDialog: DefineComponent<{
  modelValue?: boolean;
  embedded?: boolean;
  initialLayout?: "fill" | "ratio";
  layout?: "fill" | "ratio";
  submit?: (asset: SketchAsset) => Promise<SketchSubmitResult> | SketchSubmitResult;
}>;
export const SketchPopoverRoot: DefineComponent;
export const ToastRoot: DefineComponent;
