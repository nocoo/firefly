/**
 * Free-text filter shared by the admin CommandPalette. Pure function so it
 * can be unit-tested without rendering the palette.
 *
 * Match semantics: case-insensitive substring match on the command's display
 * label OR any keyword. Trim-then-lowercase both sides. Empty query returns
 * the input list verbatim (palette uses this for the default "all commands"
 * view), preserving caller order.
 */
export interface FilterableCommand {
  label: string;
  keywords: string[];
}

export function filterCommandsByQuery<T extends FilterableCommand>(
  commands: readonly T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...commands];
  return commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.keywords.some((kw) => kw.toLowerCase().includes(q)),
  );
}
