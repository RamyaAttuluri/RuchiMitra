'use client';

import {useRouter} from 'next/navigation';import {useState} from 'react';import {Search,ArrowRight} from 'lucide-react';
export function SearchBox({initial='',hero=false}:{initial?:string;hero?:boolean}){const router=useRouter();const [query,setQuery]=useState(initial);
 function submit(e:React.FormEvent){e.preventDefault();if(query.trim())router.push(`/search?q=${encodeURIComponent(query.trim().slice(0,80))}`)}
 return <form onSubmit={submit} className={`search-form ${hero?'search-hero':''}`} role="search"><Search size={22}/><input aria-label="Search recipes" placeholder="Search any curry, dish or ingredient..." value={query} onChange={e=>setQuery(e.target.value)} maxLength={80}/><button type="submit">Find recipes <ArrowRight size={17}/></button></form>}
