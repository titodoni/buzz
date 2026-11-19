import type { Metadata } from "next";
import "./globals.css";
import { SkinProvider } from "@/components/SkinProvider";

export const metadata: Metadata = {
  title: "Buzz",
  description: "A Yahoo Messenger revival for the desktop.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SkinProvider>{children}</SkinProvider>
      </body>
    </html>
  );
}
