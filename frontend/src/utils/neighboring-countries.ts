/**
 * Neighboring countries map for land-based transport eligibility.
 * Road and rail modes are available for same-country routes
 * AND for neighboring (bordering) countries.
 */

const NEIGHBORS: Record<string, string[]> = {
  // RDC (Congo-Kinshasa)
  CD: ["CG", "AO", "ZM", "TZ", "BI", "RW", "UG", "SS", "CF"],
  // Congo-Brazzaville
  CG: ["CD", "AO", "CM", "CF", "GA"],
  // Angola
  AO: ["CD", "CG", "ZM", "NA", "BW"],
  // Zambie
  ZM: ["CD", "AO", "BW", "ZW", "MZ", "MW", "TZ", "NA"],
  // Tanzanie
  TZ: ["CD", "ZM", "MW", "MZ", "KE", "UG", "RW", "BI"],
  // Burundi
  BI: ["CD", "TZ", "RW"],
  // Rwanda
  RW: ["CD", "TZ", "BI", "UG"],
  // Ouganda
  UG: ["CD", "TZ", "RW", "KE", "SS"],
  // Soudan du Sud
  SS: ["CD", "UG", "KE", "ET", "SD", "CF"],
  // Centrafrique
  CF: ["CD", "CG", "CM", "TD", "SD", "SS"],
  // Kenya
  KE: ["TZ", "UG", "SS", "ET", "SO"],
  // Nigeria
  NG: ["BJ", "NE", "TD", "CM"],
  // Cameroun
  CM: ["NG", "TD", "CF", "CG", "GA", "GQ"],
  // Afrique du Sud
  ZA: ["NA", "BW", "ZW", "MZ", "SZ", "LS"],
  // Chine
  CN: ["MN", "RU", "KZ", "KG", "TJ", "AF", "PK", "IN", "NP", "BT", "MM", "LA", "VN", "KP"],
  // Turquie
  TR: ["GE", "AM", "AZ", "IR", "IQ", "SY", "GR", "BG"],
  // France
  FR: ["BE", "LU", "DE", "CH", "IT", "ES", "AD", "MC"],
  // Allemagne
  DE: ["DK", "PL", "CZ", "AT", "CH", "FR", "LU", "BE", "NL"],
  // Inde
  IN: ["PK", "CN", "NP", "BT", "BD", "MM", "LK"],
  // États-Unis (frontières terrestres)
  US: ["CA", "MX"],
  // Brésil
  BR: ["UY", "AR", "PY", "BO", "PE", "CO", "VE", "GY", "SR", "GF"],
};

/**
 * Check if two country codes are neighbors (bordering countries)
 * or the same country — meaning land transport (road/rail) is feasible.
 */
export function isLandTransportFeasible(originCC: string, destCC: string): boolean {
  const o = originCC.toUpperCase();
  const d = destCC.toUpperCase();
  
  if (o === d) return true;
  
  const neighbors = NEIGHBORS[o];
  if (neighbors && neighbors.includes(d)) return true;
  
  // Check reverse (in case only one side is defined)
  const neighborsReverse = NEIGHBORS[d];
  if (neighborsReverse && neighborsReverse.includes(o)) return true;
  
  return false;
}
