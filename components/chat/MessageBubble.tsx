"use client";

import { renderMessage } from "@/lib/emoticons/shortcode";

/** A message body with shortcodes shown as emoticon images. */
export function MessageBubble({ body }: { body: string }) {
  const tokens = renderMessage(body);
  return (
    <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
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
