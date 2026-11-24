import { MenuBar, type MenuDef } from "@/components/friends/MenuBar";
import type { ChatView } from "@/lib/chat/useChatView";

export type ChatDialogKind = "profile" | "ignore" | "about";

export interface ChatMenuActions {
  copyConversation(): void;
  closeWindow(): void;
  copySelection(): void;
  selectAll(): void;
  clearWindow(): void;
  showEarlier(): void;
  sendBuzz(): void;
  stopIgnoring(): void;
  openDialog(kind: ChatDialogKind): void;
  updateView(patch: Partial<ChatView>): void;
}

export interface ChatMenuState {
  view: ChatView;
  reachedStart: boolean;
  friendOffline: boolean;
  ignored: boolean;
}

/** The chat window's menu bar (Req 17.1). Pure: the window passes what each item does. */
export function buildChatMenus(state: ChatMenuState, act: ChatMenuActions): MenuDef[] {
  const { view } = state;
  return [
    {
      label: "Conversation",
      items: [
        { label: "Copy Conversation", onSelect: act.copyConversation },
        { label: "Close", onSelect: act.closeWindow },
      ],
    },
    {
      label: "Edit",
      items: [
        { label: "Copy", shortcut: "Ctrl+C", onSelect: act.copySelection },
        { label: "Select All", onSelect: act.selectAll },
        { label: "Clear Window", onSelect: act.clearWindow },
      ],
    },
    {
      label: "View",
      items: [
        { label: "Show Timestamps", checked: view.showTimestamps, onSelect: () => act.updateView({ showTimestamps: !view.showTimestamps }) },
        { label: "Show Earlier Messages", shortcut: "F3", disabled: state.reachedStart, onSelect: act.showEarlier },
        { label: "Show Friends' Fonts", checked: view.showFriendsFonts, onSelect: () => act.updateView({ showFriendsFonts: !view.showFriendsFonts }) },
      ],
    },
    {
      label: "Actions",
      items: [
        { label: "Buzz!", shortcut: "Ctrl+G", disabled: state.friendOffline, onSelect: act.sendBuzz },
        { label: "View Profile", onSelect: () => act.openDialog("profile") },
        state.ignored
          ? { label: "Stop Ignoring", onSelect: act.stopIgnoring }
          : { label: "Ignore...", onSelect: () => act.openDialog("ignore") },
      ],
    },
    { label: "Help", items: [{ label: "About Buzz", onSelect: () => act.openDialog("about") }] },
  ];
}

/** The menu bar as a component, so the window can hand it plain callbacks as props. */
export function ChatMenuBar({ state, actions }: { state: ChatMenuState; actions: ChatMenuActions }) {
  return <MenuBar menus={buildChatMenus(state, actions)} label="Chat menu" />;
}
