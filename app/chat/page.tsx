"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ChatContent() {
  const friendId = useSearchParams().get("friendId");
  return (
    <main className="p-4">
      <h1 className="text-xl font-bold">Chat</h1>
      <p>Placeholder. friendId: {friendId ?? "none"}</p>
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatContent />
    </Suspense>
  );
}
