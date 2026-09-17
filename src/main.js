import { createApp } from "vue";
import VueKonva from "vue-konva";
import App from "./App.vue";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/demo.css";

createApp(App).use(VueKonva).mount("#app");
