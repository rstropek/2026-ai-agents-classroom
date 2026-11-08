import { defineMermaidSetup } from "@slidev/types";

// Diagram colors that match style.css.
export default defineMermaidSetup(() => ({
  theme: "base",
  themeVariables: {
    fontFamily: "Inter, sans-serif",
    primaryColor: "#f5f7fa",
    primaryBorderColor: "#1f6f8b",
    primaryTextColor: "#1d2733",
    lineColor: "#5b6776",
    secondaryColor: "#ffffff",
    tertiaryColor: "#ffffff",
    noteBkgColor: "#e8f1f5",
    noteBorderColor: "#1f6f8b",
    noteTextColor: "#1d2733",
    actorBkg: "#f5f7fa",
    actorBorder: "#1f6f8b",
    actorLineColor: "#9aa7b5",
  },
  sequence: { mirrorActors: false },
}));
