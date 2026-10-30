'use client';
import {useState} from 'react';
import Image from 'next/image';
import {imageSrc} from '@/lib/api';

// next/image for hosts configured in next.config.ts; admin uploads are served by the backend and skip the optimizer.
export function FoodImage({src,alt,sizes,priority=false,className}:{src:string;alt:string;sizes:string;priority?:boolean;className?:string}){
 const [failed,setFailed]=useState('');
 const url=imageSrc(src);
 if(!url||failed===url)return <span role="img" aria-label={alt} className="recipe-image-placeholder">✳</span>;
 const optimizable=url.startsWith('https://images.unsplash.com/');
 return <Image onError={()=>setFailed(url)} src={url} alt={alt} fill sizes={sizes} priority={priority} unoptimized={!optimizable} className={className} style={{objectFit:'cover'}}/>;
}
