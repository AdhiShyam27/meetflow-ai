import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MeetFlow AI — Your meetings, distilled into action.",
  description:
    "Get live, bot-free transcriptions and AI-powered summaries. Capture every insight, action item, and decision — automatically.",
  keywords: [
    "AI meeting transcription",
    "meeting notes",
    "AI summaries",
    "live transcription",
    "Zoom transcription",
    "Google Meet notes",
    "MS Teams AI",
  ],
  authors: [{ name: "MeetFlow AI" }],
  creator: "MeetFlow AI",
  publisher: "MeetFlow AI",
  metadataBase: new URL("https://meetflow.ai"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://meetflow.ai",
    siteName: "MeetFlow AI",
    title: "MeetFlow AI — Your meetings, distilled into action.",
    description:
      "Get live, bot-free transcriptions and AI-powered summaries. Never miss an action item again.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "MeetFlow AI — AI Meeting Transcription & Summaries",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MeetFlow AI — Your meetings, distilled into action.",
    description:
      "Live, bot-free transcriptions and AI summaries for every meeting.",
    images: ["/og-image.png"],
    creator: "@meetflowai",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className={`${inter.variable} antialiased`}
        style={{ fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}
      >
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1E293B",
              color: "#E2E8F0",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: "13px",
            },
          }}
        />
      </body>
    </html>
  );
}
