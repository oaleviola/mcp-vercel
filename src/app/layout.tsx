import { ReactNode } from 'react';

export const metadata = {
  title: 'MCP Vercel',
  description: 'Model Context Protocol integration with Vercel',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
