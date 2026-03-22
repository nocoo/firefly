import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Li Zheng",
    template: "%s | Li Zheng",
  },
  description: "Personal blog by Li Zheng",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
