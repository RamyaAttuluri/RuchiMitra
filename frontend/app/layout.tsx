import type { Metadata } from 'next';
import './globals.css';
import './redesign.css';
import { SiteHeader } from '@/components/site-header';
export const metadata:Metadata={title:'RuchiMitra — Your Cooking Companion',description:'Discover beautiful recipes, check ingredients, and cook along with a multilingual voice guide.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><SiteHeader/>{children}<footer className="footer"><div className="container footer-inner"><div><span className="brand-footer">✳ Ruchi<b>Mitra</b></span><p>Your Cooking Companion. <span lang="te">రుచి మిత్ర</span> · <span lang="hi">रुचि मित्र</span></p></div><div className="footer-right"><span>Made for home cooks everywhere</span><span>© {new Date().getFullYear()} RuchiMitra</span></div></div></footer></body></html>}
