"use client";

import type { CSSProperties } from "react";
import { renderMessage } from "@/lib/emoticons/shortcode";

/**
 * A message body with shortcodes shown as emoticon images, in the given
 * style (from formatToStyle, so only validated values; Req 17.3).
 */
export function MessageBubble({ body, style }: { body: string; style?: CSSProperties }) {
  const tokens = renderMessage(body);
  return (
    <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...style }}>
      {tokens.map((t, i) =>
        t.type === "text" ? (
          <span key={i}>{t.value}</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- static export, tiny local SVGs
          <img
            key={i}
            src={t.value}
            alt={t.source}
            width={18}
            height={18}
            style={{ display: "inline-block", verticalAlign: "middle" }}
          />
        ),
      )}
    </span>
  );
}

export default MessageBubble;
