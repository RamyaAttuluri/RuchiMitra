'use client';
import {apiFetch,API_URL} from '@/lib/api';

import Link from 'next/link';import {usePathname,useRouter} from 'next/navigation';import {useEffect,useState} from 'react';
import {BookOpen,ChefHat,Heart,Menu,Search,UserRound,X} from 'lucide-react';
type User={name:string;role:string}|null;
export function SiteHeader(){
 const path=usePathname();const router=useRouter();const [user,setUser]=useState<User>(null);const [menu,setMenu]=useState(false);
 useEffect(()=>{apiFetch(`${API_URL}/auth/me`,{cache:'no-store'}).then(r=>r.json()).then(d=>setUser(d.user)).catch(()=>{})},[path]);
 const [logoutError,setLogoutError]=useState('');
 async function signout(){try{const response=await apiFetch(`${API_URL}/auth/logout`,{method:'POST'});if(!response.ok)throw Error('Sign out failed. Please try again.');setLogoutError('');setUser(null);setMenu(false);router.push('/');router.refresh()}catch{setLogoutError('Could not sign out. Please try again.')}}
 return <header className="site-header"><div className="container header-inner"><Link href="/" className="brand" aria-label="RuchiMitra home"><span className="brand-symbol">✳</span><span className="brand-words"><span>Ruchi<b>Mitra</b></span><small lang="te">రుచి మిత్ర · <span lang="hi">रुचि मित्र</span></small></span></Link>
 <nav className="desktop-nav" aria-label="Main navigation"><Link className={path==='/'?'active':''} href="/">Discover</Link><Link className={path.startsWith('/search')?'active':''} href="/search">Explore recipes</Link><Link className={path==='/pantry'?'active':''} href="/pantry">My pantry</Link></nav>
 <div className="header-actions"><Link href="/saved" className="header-icon" title="Saved recipes"><Heart size={20}/></Link>
 {user?<><Link className="account-name" href={user.role==='ADMIN'?'/admin':'/saved'}><UserRound size={17}/><span>Hi, {user.name.split(' ')[0]}</span></Link>{user.role==='ADMIN'&&<Link className='logout-link' href='/admin'>Admin</Link>}<button className="logout-link" onClick={signout}>Log out</button></>:<Link className="btn btn-dark header-signin" href="/login">Sign in <span>↗</span></Link>}
 <button className="mobile-menu-button icon-button" aria-label="Open menu" onClick={()=>setMenu(v=>!v)}>{menu?<X/>:<Menu/>}</button></div></div>
 {logoutError&&<p role="alert" className="inline-error">{logoutError}</p>}
 {menu&&<nav className="mobile-nav" aria-label="Mobile navigation"><Link onClick={()=>setMenu(false)} href="/">Discover</Link><Link onClick={()=>setMenu(false)} href="/search">Explore recipes</Link><Link onClick={()=>setMenu(false)} href="/pantry">My pantry</Link><Link onClick={()=>setMenu(false)} href="/saved">Saved recipes</Link>{user?.role==='ADMIN'&&<Link onClick={()=>setMenu(false)} href="/admin">Admin</Link>}{!user?<Link onClick={()=>setMenu(false)} href="/login">Sign in</Link>:<button onClick={signout}>Log out</button>}</nav>}
 </header>
}
