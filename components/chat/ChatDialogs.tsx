import { AboutDialog } from "@/components/AboutDialog";
import { Dialog } from "@/components/Dialog";
import { hasNowPlaying, shouldShowField } from "@/lib/profile/render";
import type { PublicProfile } from "@/lib/friends/api";
import { SafetyNumber } from "./SafetyNumber";
import type { ChatDialogKind } from "./chatMenus";

export interface ChatDialogsProps {
  dialog: ChatDialogKind | null;
  friendId: string;
  friendName: string;
  friend: PublicProfile | null;
  /** My public key, for the Safety Number; null when this window has no key. */
  myPublicKey: string | null;
  onClose(): void;
  onIgnore(): void;
}

/** The three small dialogs of the chat window: About, the friend's profile, and Ignore. */
export function ChatDialogs({ dialog, friendId, friendName, friend, myPublicKey, onClose, onIgnore }: ChatDialogsProps) {
  if (dialog === "about") return <AboutDialog onClose={onClose} />;
  if (dialog === "profile") {
    return (
      <Dialog title={`${friendName}'s profile`} onClose={onClose}>
        <p className="m-0 font-bold">{friendName}</p>
        {shouldShowField(friend?.statusMessage) ? <p className="m-0 text-xs">{friend?.statusMessage}</p> : null}
        {hasNowPlaying(friend?.nowPlaying) ? <p className="m-0 text-xs">♪ {friend?.nowPlaying}</p> : null}
        {myPublicKey ? <SafetyNumber myPublicKey={myPublicKey} friendId={friendId} friendName={friendName} /> : null}
        <button type="button" className="ym-button mt-2" onClick={onClose}>
          Close
        </button>
      </Dialog>
    );
  }
  if (dialog === "ignore") {
    return (
      <Dialog title={`Ignore ${friendName}`} role="alertdialog" onClose={onClose}>
        <p className="m-0 text-xs">
          Ignore {friendName}? They won&apos;t be able to message you, Buzz you, or send you friend requests, and
          they&apos;ll see you as offline. Buzz won&apos;t tell them.
        </p>
        <div className="mt-2 flex gap-1">
          <button type="button" className="ym-button" onClick={onIgnore}>
            Ignore
          </button>
          <button type="button" className="ym-button" data-autofocus onClick={onClose}>
            Cancel
          </button>
        </div>
      </Dialog>
    );
  }
  return null;
}
