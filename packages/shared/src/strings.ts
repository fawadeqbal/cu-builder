/** "Sara Ahmed's CV!" → "sara-ahmed-s-cv" */
export function slugify(input: string, fallback = "item"): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

/** Counts words the way people do: runs of non-space characters. */
export const wordCount = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0);

export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
