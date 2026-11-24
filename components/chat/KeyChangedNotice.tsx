import { SafetyNumber } from "./SafetyNumber";

export interface KeyChangedNoticeProps {
  myPublicKey: string;
  friendId: string;
  friendName: string;
  /** Called with the friend key whose Safety Number is on screen. */
  onKey(key: string | null): void;
  onTrust(): void;
}

/** Shown when a send was stopped because the friend's key changed (ADR 0010, E3.1). */
export function KeyChangedNotice({ myPublicKey, friendId, friendName, onKey, onTrust }: KeyChangedNoticeProps) {
  return (
    <div role="alert" style={{ fontSize: 12, margin: "4px 8px" }}>
      <SafetyNumber myPublicKey={myPublicKey} friendId={friendId} friendName={friendName} onKey={onKey} />
      <button type="button" className="ym-button mt-1" onClick={onTrust}>
        I checked it. Trust the new key.
      </button>
    </div>
  );
}
