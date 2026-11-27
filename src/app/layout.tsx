import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "TN VED AI", description: "Справочник ТН ВЭД ЕАЭС для Беларуси и России" };

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang='ru'>
      <body>{children}</body>
    </html>
  );
}
