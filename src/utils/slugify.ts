/**
 * Lowercases `value` and collapses runs of non-alphanumeric characters into
 * single hyphens, trimming leading/trailing hyphens. Returns `fallback` when
 * the result would be empty. Used to derive filenames for export bundles.
 */
export function slugify(value: string, fallback: string): string {
  const base = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || fallback;
}
