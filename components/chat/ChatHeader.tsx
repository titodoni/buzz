import { PresenceDot, presenceLabel } from "@/components/PresenceDot";
import type { Availability } from "@/lib/presence/state";
import { hasNowPlaying, shownNowPlaying } from "@/lib/profile/render";

export interface ChatHeaderProps {
  friendName: string;
  presence: Availability;
  statusMessage: string | null | undefined;
  nowPlaying: string | null | undefined;
}

/** The line under the title bar: who this is, how they are, what they are playing. */
export function ChatHeader({ friendName, presence, statusMessage, nowPlaying }: ChatHeaderProps) {
  return (
    <>
      <PresenceDot state={presence} />
      <strong className="ym-truncate">{friendName}</strong>
      <span className="ym-truncate" style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {statusMessage ? `"${statusMessage}"` : presenceLabel(presence)}
      </span>
      {hasNowPlaying(nowPlaying) ? (
        <span className="ym-truncate" style={{ fontSize: 12 }} title={nowPlaying ?? undefined}>
          <span aria-hidden="true">♪ </span>
          {shownNowPlaying(nowPlaying ?? "")}
        </span>
      ) : null}
    </>
  );
}
