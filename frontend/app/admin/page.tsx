'use client';

import {useEffect,useState} from 'react';import Link from 'next/link';import {api} from '@/lib/api';import {AdminDashboard,type AdminUser} from '@/components/admin/admin-dashboard';
export default function AdminPage(){const [status,setStatus]=useState('Checking administrator access...');const [me,setMe]=useState<AdminUser|null>(null);
useEffect(()=>{(async()=>{try{const profile=await api<{user:AdminUser|null}>('/auth/me');if(!profile.user){setStatus('Please sign in with your admin account.');return;}if(profile.user.role!=='ADMIN'){setStatus('Access denied: Admin credentials required.');return;}setMe(profile.user)}catch(e){setStatus(e instanceof Error?e.message:'Could not load admin dashboard')}})()},[]);
// Visibility only; every /api/admin endpoint enforces the ADMIN role on the server.
return <div className="admin-theme">{me?<AdminDashboard me={me}/>:<main className="container subpage"><div className="adm-gate"><span className="adm-eyebrow">RESTRICTED · ADMINISTRATION</span><h1>Kitchen management</h1><p>{status}</p>{!status.startsWith('Checking')&&<Link className="adm-btn adm-btn-primary" href="/login?role=admin&next=/admin">Admin sign in →</Link>}</div></main>}</div>}
