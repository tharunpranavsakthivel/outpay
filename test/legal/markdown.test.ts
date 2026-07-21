/**
 * Unit tests for the legal-document Markdown parser.
 */

import { describe, expect, it } from "bun:test";
import { parseLegalMarkdown } from "../../src/lib/legal/markdown";

describe("parseLegalMarkdown", () => {
  it("preserves headings, paragraphs, and list ordering", () => {
    const blocks = parseLegalMarkdown(
      "# Title\n\n> A notice\n\nA paragraph\nthat wraps.\n\n* first\n* second\n\n1. one\n2. two",
    );

    expect(blocks).toEqual([
      { type: "heading", level: 1, text: "Title" },
      { type: "blockquote", text: "A notice" },
      { type: "paragraph", text: "A paragraph that wraps." },
      { type: "list", ordered: false, items: ["first", "second"] },
      { type: "list", ordered: true, items: ["one", "two"] },
    ]);
  });

  it("treats malformed Markdown as readable paragraph text", () => {
    expect(
      parseLegalMarkdown("A line with * an asterisk\ncontinued text"),
    ).toEqual([
      {
        type: "paragraph",
        text: "A line with * an asterisk continued text",
      },
    ]);
  });
});
