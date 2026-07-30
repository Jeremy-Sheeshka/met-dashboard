import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MET Learning Dashboard",
    template: "%s | MET Dashboard",
  },
  description: "Learning archive for Jeremy Sheeshka's MET master's program.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <nav className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/80 backdrop-blur">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link
              href="/"
              className="font-bold text-lg tracking-tight hover:opacity-75 transition-opacity"
            >
              MET Dashboard
            </Link>
            <div className="flex items-center gap-6 text-sm font-medium">
              <Link
                href="/courses"
                className="hover:opacity-75 transition-opacity"
              >
                Courses
              </Link>
              <Link
                href="/projects"
                className="hover:opacity-75 transition-opacity"
              >
                Projects
              </Link>
              <Link
                href="/search"
                className="hover:opacity-75 transition-opacity"
              >
                Search
              </Link>
              <a
                href="https://jeremysheeshka.ca"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 dark:text-gray-400 hover:opacity-75 transition-opacity"
              >
                Main blog ↗
              </a>
            </div>
          </div>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
