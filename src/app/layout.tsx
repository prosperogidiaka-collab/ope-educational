import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "OPE EDUCATIONAL",
  description:
    "Academic publishing platform with secure score entry, layered approvals, coupon access, verification, and printable report cards.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
