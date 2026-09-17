import VueKonva from "vue-konva";
import "./styles/index.css";

export const SketchCanvasPlugin = {
  install(app) {
    app.use(VueKonva);
  },
};

export { default as SketchDialog } from "./components/SketchDialog.vue";
export { default as SketchPopoverRoot } from "./components/SketchPopoverRoot.vue";
export { default as ToastRoot } from "./components/ToastRoot.vue";
