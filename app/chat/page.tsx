"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useSession } from "@/lib/auth/session";

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ChatContent() {
  const friendId = useSearchParams().get("friendId");
  const { user } = useSession();

  if (!friendId || !UUID_LIKE.test(friendId)) {
    return (
      <main className="p-4">
        <p role="alert">
          We couldn&apos;t tell who you wanted to chat with. Open a chat from your buddy list.
        </p>
      </main>
    );
  }
  if (!user) return null;
  if (user.id === friendId) {
    return (
      <main className="p-4">
        <p role="alert">You can&apos;t chat with yourself. Pick a friend from your buddy list.</p>
      </main>
    );
  }
  return <ChatWindow me={user.id} friendId={friendId} />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <AuthGuard>
        <ChatContent />
      </AuthGuard>
    </Suspense>
  );
}
