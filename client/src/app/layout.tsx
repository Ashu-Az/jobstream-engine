import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Job Importer Dashboard',
  description: 'Scalable job importer with queue processing and history tracking',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-100">{children}</body>
    </html>
  );
}
