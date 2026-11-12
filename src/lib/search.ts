/**
 * Escapes LIKE wildcards for Prisma `contains`/`startsWith`/`endsWith`. Prisma does not escape
 * them, so without this a search for "%" or "_" matches every row.
 */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}
