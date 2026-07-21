"use client";

import type { ReactNode } from "react";
import {
  type LegalMarkdownBlock,
  parseLegalMarkdown,
} from "../lib/legal/markdown";
import { PRIVACY_POLICY_MARKDOWN } from "../lib/legal/privacy-policy";
import { TERMS_OF_SERVICE_MARKDOWN } from "../lib/legal/terms-of-service";

export type LegalDocType = "Terms of Service" | "Privacy Policy";

const TERMS_BLOCKS = parseLegalMarkdown(TERMS_OF_SERVICE_MARKDOWN).filter(
  (block) =>
    !(block.type === "heading" && block.level === 1) &&
    !(
      block.type === "paragraph" &&
      block.text === "**Last updated: July 20, 2026**"
    ),
);

const PRIVACY_BLOCKS = parseLegalMarkdown(PRIVACY_POLICY_MARKDOWN).filter(
  (block) =>
    !(block.type === "heading" && block.level === 1) &&
    !(
      block.type === "paragraph" &&
      (block.text === "**Effective date:** July 20, 2026" ||
        block.text === "**Last updated:** July 20, 2026")
    ),
);

/**
 * Converts the inline Markdown supported by the legal document into safe React
 * nodes, including bold text and mail links.
 *
 * @param text Inline legal copy to render.
 * @returns React nodes representing the formatted copy.
 */
function renderInlineLegalText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\*\*\[[^\]]+\]\(mailto:[^)]+\)\*\*|\[[^\]]+\]\(mailto:[^)]+\)|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let matchIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    const boldMailMatch = /^\*\*\[([^\]]+)\]\(mailto:([^)]+)\)\*\*$/.exec(
      token,
    );
    if (boldMailMatch) {
      nodes.push(
        <strong key={`legal-bold-mail-${matchIndex}`}>
          <a
            href={`mailto:${boldMailMatch[2]}`}
            className="text-foreground underline underline-offset-2"
          >
            {boldMailMatch[1]}
          </a>
        </strong>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={`legal-bold-${matchIndex}`}>{token.slice(2, -2)}</strong>,
      );
    } else {
      const linkMatch = /^\[([^\]]+)\]\(mailto:([^)]+)\)$/.exec(token);
      if (linkMatch) {
        nodes.push(
          <a
            key={`legal-mail-${matchIndex}`}
            href={`mailto:${linkMatch[2]}`}
            className="text-foreground underline underline-offset-2"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }

    lastIndex = start + token.length;
    matchIndex += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/**
 * Renders a full supplied legal-policy draft as semantic legal content.
 *
 * @param blocks Parsed legal document blocks to render.
 * @param keyPrefix Stable prefix for generated React keys.
 * @returns The complete legal document content.
 */
function LegalMarkdownContent({
  blocks,
  keyPrefix,
}: {
  blocks: LegalMarkdownBlock[];
  keyPrefix: string;
}): ReactNode {
  return (
    <div className="flex flex-col gap-5">
      {blocks.map((block, index) => {
        const key = `${keyPrefix}-block-${index}`;

        if (block.type === "heading") {
          return block.level === 2 ? (
            <h2
              key={key}
              className="text-base font-semibold text-foreground pt-5 border-t border-border"
            >
              {renderInlineLegalText(block.text)}
            </h2>
          ) : (
            <h3
              key={key}
              className="text-sm font-semibold text-foreground pt-2"
            >
              {renderInlineLegalText(block.text)}
            </h3>
          );
        }

        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={key}
              className="list-inside space-y-1 pl-2"
              style={{ listStyleType: block.ordered ? "decimal" : "disc" }}
            >
              {block.items.map((item) => (
                <li key={`${key}-${item}`}>{renderInlineLegalText(item)}</li>
              ))}
            </List>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={key}
              className="border-l-2 border-border pl-4 text-foreground-lighter"
            >
              {renderInlineLegalText(block.text)}
            </blockquote>
          );
        }

        return (
          <p key={key} className="m-0">
            {renderInlineLegalText(block.text)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Legal page shell — pass `docType` to render the interim Terms of Service or
 * Privacy Policy copy while counsel prepares the final documents.
 */
export default function LegalPage({
  docType = "Terms of Service" as LegalDocType,
}: {
  docType?: LegalDocType;
}) {
  return (
    <div className="bg-background min-h-screen font-sans flex flex-col">
      <div className="border-b border-border">
        <div className="max-w-content mx-auto flex items-center h-16 px-8">
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
            Outpay
          </span>
        </div>
      </div>

      <div className="max-w-[680px] mx-auto w-full px-6 pt-16 pb-24 flex flex-col gap-2">
        <h1 className="text-[30px] font-semibold tracking-[-0.01em] text-foreground m-0">
          {docType}
        </h1>
        <div className="text-xs text-foreground-lighter mb-8">
          {docType === "Terms of Service" ? (
            "Last updated: July 20, 2026"
          ) : (
            <>
              Effective date: July 20, 2026
              <br />
              Last updated: July 20, 2026
            </>
          )}
        </div>

        {docType === "Terms of Service" ? (
          <div className="text-[13.5px] text-foreground-light leading-[1.7]">
            <LegalMarkdownContent blocks={TERMS_BLOCKS} keyPrefix="terms" />
          </div>
        ) : (
          <div className="text-[13.5px] text-foreground-light leading-[1.7]">
            <LegalMarkdownContent blocks={PRIVACY_BLOCKS} keyPrefix="privacy" />
          </div>
        )}

        <div className="flex flex-col gap-1.5 pt-7 mt-6 border-t border-border">
          <div className="text-xs text-foreground-lighter leading-[1.6]">
            Questions about this document? Contact us at{" "}
            <span className="text-foreground font-medium">
              legal@outpay.tech
            </span>
            .
          </div>
        </div>
      </div>

      <div className="border-t border-border py-6 px-8 text-center">
        <div className="text-xs text-foreground-lighter">
          © 2026 Outpay. Non-custodial checkout for USDC on Base.
        </div>
      </div>
    </div>
  );
}
