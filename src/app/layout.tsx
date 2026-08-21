import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Developer",
  description:
    "Build a resume from 1,080 single-column templates, fit it to an exact page count automatically, and verify what an applicant tracking system actually reads back.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
