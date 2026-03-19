/**
 * Converts a hex color code to a human-readable French color name.
 * Falls back to the hex code if no match is found within a tolerance.
 */

interface ColorEntry {
  hex: string;
  name: string;
}

const KNOWN_COLORS: ColorEntry[] = [
  { hex: "#000000", name: "Noir" },
  { hex: "#FFFFFF", name: "Blanc" },
  { hex: "#FF0000", name: "Rouge" },
  { hex: "#EF4444", name: "Rouge" },
  { hex: "#DC2626", name: "Rouge foncé" },
  { hex: "#B91C1C", name: "Rouge bordeaux" },
  { hex: "#00FF00", name: "Vert vif" },
  { hex: "#22C55E", name: "Vert" },
  { hex: "#16A34A", name: "Vert foncé" },
  { hex: "#15803D", name: "Vert forêt" },
  { hex: "#166534", name: "Vert sapin" },
  { hex: "#0000FF", name: "Bleu" },
  { hex: "#3B82F6", name: "Bleu" },
  { hex: "#2563EB", name: "Bleu roi" },
  { hex: "#1D4ED8", name: "Bleu foncé" },
  { hex: "#1E40AF", name: "Bleu marine" },
  { hex: "#60A5FA", name: "Bleu ciel" },
  { hex: "#93C5FD", name: "Bleu clair" },
  { hex: "#DBEAFE", name: "Bleu pâle" },
  { hex: "#FFFF00", name: "Jaune" },
  { hex: "#EAB308", name: "Jaune" },
  { hex: "#FDE047", name: "Jaune clair" },
  { hex: "#CA8A04", name: "Jaune foncé" },
  { hex: "#FFA500", name: "Orange" },
  { hex: "#F97316", name: "Orange" },
  { hex: "#EA580C", name: "Orange foncé" },
  { hex: "#FB923C", name: "Orange clair" },
  { hex: "#800080", name: "Violet" },
  { hex: "#A855F7", name: "Violet" },
  { hex: "#7C3AED", name: "Violet foncé" },
  { hex: "#C084FC", name: "Violet clair" },
  { hex: "#D946EF", name: "Magenta" },
  { hex: "#EC4899", name: "Rose" },
  { hex: "#F472B6", name: "Rose clair" },
  { hex: "#BE185D", name: "Rose foncé" },
  { hex: "#DB2777", name: "Fuchsia" },
  { hex: "#FFC0CB", name: "Rose pâle" },
  { hex: "#808080", name: "Gris" },
  { hex: "#6B7280", name: "Gris" },
  { hex: "#9CA3AF", name: "Gris clair" },
  { hex: "#D1D5DB", name: "Gris pâle" },
  { hex: "#4B5563", name: "Gris foncé" },
  { hex: "#374151", name: "Gris anthracite" },
  { hex: "#1F2937", name: "Gris charbon" },
  { hex: "#111827", name: "Noir charbon" },
  { hex: "#A52A2A", name: "Marron" },
  { hex: "#92400E", name: "Marron" },
  { hex: "#78350F", name: "Marron foncé" },
  { hex: "#D97706", name: "Camel" },
  { hex: "#B45309", name: "Brun" },
  { hex: "#F5F5DC", name: "Beige" },
  { hex: "#FEF3C7", name: "Beige clair" },
  { hex: "#FBBF24", name: "Doré" },
  { hex: "#C0C0C0", name: "Argent" },
  { hex: "#E5E7EB", name: "Argent clair" },
  { hex: "#008080", name: "Turquoise" },
  { hex: "#14B8A6", name: "Turquoise" },
  { hex: "#0D9488", name: "Vert émeraude" },
  { hex: "#06B6D4", name: "Cyan" },
  { hex: "#0EA5E9", name: "Bleu azur" },
  { hex: "#38BDF8", name: "Bleu lagon" },
  { hex: "#F0FFF0", name: "Vert menthe" },
  { hex: "#FFFDD0", name: "Crème" },
  { hex: "#FAF5FF", name: "Lavande" },
  { hex: "#FDF2F8", name: "Rose pastel" },
  { hex: "#8B0000", name: "Rouge sang" },
  { hex: "#800000", name: "Bordeaux" },
  { hex: "#4A0E0E", name: "Bordeaux foncé" },
  { hex: "#000080", name: "Bleu marine" },
  { hex: "#808000", name: "Olive" },
  { hex: "#84CC16", name: "Vert lime" },
];

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.substring(0, 2), 16),
      parseInt(clean.substring(2, 4), 16),
      parseInt(clean.substring(4, 6), 16),
    ];
  }
  return null;
}

function colorDistance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return Infinity;
  return Math.sqrt(
    (rgb1[0] - rgb2[0]) ** 2 +
    (rgb1[1] - rgb2[1]) ** 2 +
    (rgb1[2] - rgb2[2]) ** 2
  );
}

/**
 * Returns a human-readable French color name for a hex code.
 * If the hex doesn't match any known color within tolerance, returns a best-effort name.
 */
export function hexToColorName(hex: string | null | undefined): string {
  if (!hex) return "";
  const normalized = hex.toUpperCase().trim();
  if (!normalized.startsWith("#")) return hex; // Already a name

  // Exact match first
  const exact = KNOWN_COLORS.find(c => c.hex.toUpperCase() === normalized);
  if (exact) return exact.name;

  // Closest match within tolerance (distance < 60)
  let bestDist = Infinity;
  let bestName = "";
  for (const c of KNOWN_COLORS) {
    const d = colorDistance(normalized, c.hex);
    if (d < bestDist) {
      bestDist = d;
      bestName = c.name;
    }
  }

  return bestDist < 80 ? bestName : hex;
}

/**
 * Renders a color as: [swatch] Name
 * Use in JSX: <ColorLabel color="#3B82F6" />
 */
export function getColorDisplay(color: string | null | undefined): { name: string; hex: string } | null {
  if (!color) return null;
  const isHex = color.trim().startsWith("#");
  return {
    name: isHex ? hexToColorName(color) : color,
    hex: isHex ? color : "",
  };
}
