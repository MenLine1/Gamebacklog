import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'GameBacklog — Twoja biblioteka gier', description: 'Prywatny backlog gier komputerowych.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pl"><body>{children}</body></html>; }
