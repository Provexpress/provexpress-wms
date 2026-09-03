export const BRAND_COLORS = {
  DELL: { background: "rgba(0, 118, 206, 0.12)", color: "#0076CE", borderColor: "#0076CE" },
  LENOVO: { background: "rgba(226, 35, 26, 0.12)", color: "#E2231A", borderColor: "#E2231A" },
  HP: { background: "rgba(0, 150, 214, 0.12)", color: "#0096D6", borderColor: "#0096D6" },
  ZEBRA: { background: "rgba(106, 63, 160, 0.15)", color: "var(--px-purple)", borderColor: "var(--px-purple)" },
  EPSON: { background: "rgba(0, 51, 153, 0.12)", color: "#003399", borderColor: "#003399" },
  APPLE: { background: "rgba(0, 0, 0, 0.08)", color: "#111827", borderColor: "#374151" },
  SAMSUNG: { background: "rgba(20, 40, 160, 0.12)", color: "#1428A0", borderColor: "#1428A0" },
  LOGITECH: { background: "rgba(0, 178, 227, 0.12)", color: "#00B2E3", borderColor: "#00B2E3" },
  KINGSTON: { background: "rgba(180, 0, 0, 0.12)", color: "#B40000", borderColor: "#B40000" },
  KYOCERA: { background: "rgba(215, 25, 32, 0.12)", color: "#D71920", borderColor: "#D71920" }
};

export function getBrandBadgeStyle(brand) {
  const b = (brand || "").toUpperCase();
  return BRAND_COLORS[b] || { background: "rgba(215, 224, 240, 0.6)", color: "var(--px-text)", borderColor: "var(--px-border)" };
}