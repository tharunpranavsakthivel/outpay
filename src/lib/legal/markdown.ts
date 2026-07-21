/**
 * Parses the limited Markdown syntax used by the legal documents.
 *
 * This module exposes a typed block representation so the legal pages can
 * render long, reviewable documents without adding a Markdown dependency.
 */

export type LegalMarkdownBlock =
  | { type: "blockquote"; text: string }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "paragraph"; text: string };

/**
 * Parses headings, paragraphs, and flat ordered or unordered lists.
 *
 * @param markdown Markdown source containing the legal document.
 * @returns Ordered legal content blocks ready for rendering.
 * @throws Never; malformed lines are treated as paragraph text.
 */
export function parseLegalMarkdown(markdown: string): LegalMarkdownBlock[] {
  const lines = markdown.trim().split(/\r?\n/);
  const blocks: LegalMarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const quoteMatch = /^>\s+(.+)$/.exec(line);
    if (quoteMatch) {
      const quoteLines = [quoteMatch[1]];
      index += 1;
      while (index < lines.length) {
        const nextQuoteMatch = /^>\s+(.+)$/.exec(lines[index].trim());
        if (!nextQuoteMatch) {
          break;
        }
        quoteLines.push(nextQuoteMatch[1]);
        index += 1;
      }
      blocks.push({ type: "blockquote", text: quoteLines.join(" ") });
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length as 1 | 2 | 3,
        text: headingMatch[2],
      });
      index += 1;
      continue;
    }

    const listMatch = /^(\*|-|\d+\.)\s+(.+)$/.exec(line);
    if (listMatch) {
      const ordered = /\d+\./.test(listMatch[1]);
      const items: string[] = [];

      while (index < lines.length) {
        const itemMatch = /^(\*|-|\d+\.)\s+(.+)$/.exec(lines[index].trim());
        if (!itemMatch || /\d+\./.test(itemMatch[1]) !== ordered) {
          break;
        }
        items.push(itemMatch[2]);
        index += 1;
      }

      blocks.push({ type: "list", ordered, items });
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      const nextLine = lines[index].trim();
      if (/^(#{1,3})\s+/.test(nextLine) || /^(\*|-|\d+\.)\s+/.test(nextLine)) {
        break;
      }
      paragraphLines.push(nextLine);
      index += 1;
    }
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
  }

  return blocks;
}
