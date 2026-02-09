"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * Convert LaTeX delimiters that remark-math doesn't handle natively:
 *   \(...\)  →  $...$     (inline math)
 *   \[...\]  →  $$...$$   (display math)
 */
function preprocessLaTeX(text: string): string {

    let result = text.replace(
        /\\\[([\s\S]*?)\\\]/g,
        (_, math) => `$$${math}$$`
    );

    result = result.replace(
        /\\\(([\s\S]*?)\\\)/g,
        (_, math) => `$${math}$`
    );
    return result;
}

export function MarkdownText({ text }: { text: string }) {
    return (
        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {preprocessLaTeX(text)}
        </ReactMarkdown>
    );
}
