import "./globals.css";
import { Outfit, Inter } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Aftermarket Arbitrage",
  description: "Members dashboard",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${inter.variable} overflow-x-hidden bg-[#030814]`}
      >
        {children}
      </body>
    </html>
  );
}