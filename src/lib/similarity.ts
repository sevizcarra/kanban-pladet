import { Project } from "@/types/project";

export interface SimilarMatch {
  project: Project;
  similarity: number; // 0-100
}

/**
 * Normalize a string for comparison: lowercase, remove accents, extra spaces
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-z0-9\s]/g, " ")   // remove special chars
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculate similarity between two strings using trigram overlap (Dice coefficient).
 * Returns 0-100.
 */
function trigramSimilarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 100;
  if (na.length < 3 || nb.length < 3) return na === nb ? 100 : 0;

  const trigramsA = new Set<string>();
  const trigramsB = new Set<string>();
  for (let i = 0; i <= na.length - 3; i++) trigramsA.add(na.slice(i, i + 3));
  for (let i = 0; i <= nb.length - 3; i++) trigramsB.add(nb.slice(i, i + 3));

  let shared = 0;
  trigramsA.forEach((t) => { if (trigramsB.has(t)) shared++; });

  return Math.round((2 * shared) / (trigramsA.size + trigramsB.size) * 100);
}

/**
 * Also check word-level overlap for short titles
 */
function wordOverlap(a: string, b: string): number {
  const wa = new Set(normalize(a).split(" ").filter(w => w.length > 2));
  const wb = new Set(normalize(b).split(" ").filter(w => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let shared = 0;
  wa.forEach((w) => { if (wb.has(w)) shared++; });
  return Math.round((2 * shared) / (wa.size + wb.size) * 100);
}

/**
 * Find existing projects that are similar to the given title.
 * Returns matches with similarity >= 60%, sorted by similarity desc.
 */
export function findSimilarProjects(
  newTitle: string,
  existingProjects: Project[],
  threshold = 60
): SimilarMatch[] {
  if (!newTitle.trim()) return [];

  return existingProjects
    .map((project) => {
      const tSim = trigramSimilarity(newTitle, project.title);
      const wSim = wordOverlap(newTitle, project.title);
      const similarity = Math.max(tSim, wSim);
      return { project, similarity };
    })
    .filter((m) => m.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5); // max 5 matches
}
