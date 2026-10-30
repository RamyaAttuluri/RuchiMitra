import type { NextConfig } from 'next';
const api=new URL(process.env.NEXT_PUBLIC_API_URL||'http://localhost:5000/api');
const csp = [
 "default-src 'self'",
 `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV==='development'?" 'unsafe-eval'":''}`,
 "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
 "font-src 'self' https://fonts.gstatic.com data:",
 // Recipe photos: Unsplash plus admin uploads served by the backend.
 `img-src 'self' data: blob: https://images.unsplash.com ${api.origin}`,
 // Cloud narration fallback plays server-generated audio from blob: URLs.
 "media-src 'self' blob:",
 `connect-src 'self' ${api.origin}${process.env.NODE_ENV==='development'?" ws: wss:":''}`,
 "object-src 'none'",
 "frame-ancestors 'none'",
].join('; ');
const nextConfig:NextConfig={
 reactStrictMode:true,
 poweredByHeader:false,
 images:{remotePatterns:[{protocol:'https',hostname:'images.unsplash.com'}]},
 async headers(){return [{source:'/(.*)',headers:[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Content-Security-Policy',value:csp},
 ]}];}
};
export default nextConfig;
