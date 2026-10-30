import {configureEnvironment} from '../scripts/env.mjs';
configureEnvironment();
import {PrismaClient} from '@prisma/client';
import * as argon2 from 'argon2';
import {seeds,legacyPhotoFor} from './seed-data.js';
const db=new PrismaClient();
async function main(){
 for(const r of seeds){await db.recipe.upsert({where:{slug:r.slug},update:{},create:{...r,tags:JSON.stringify(r.tags),ingredients:JSON.stringify(r.ingredients),steps:JSON.stringify(r.steps),translations:JSON.stringify(r.translations??{}),source:'CURATED'}});
 const oldPhoto=legacyPhotoFor(r.imageUrl);
 if(oldPhoto)await db.recipe.updateMany({where:{slug:r.slug,source:'CURATED',imageUrl:oldPhoto},data:{imageUrl:r.imageUrl}});
 }
 const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();const password=process.env.ADMIN_PASSWORD;
 if(Boolean(email)!==Boolean(password))throw Error('For admin setup specify BOTH ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env');
 if(email&&password){if(process.env.NODE_ENV==='production' && (password==='RecipeAdminLocal@2026'||email==='admin@recipefinder.com')) throw Error('Replace default demo administrator credentials before any production seeding');if(password.length<12)throw Error('ADMIN_PASSWORD must have at least 12 characters');const found=await db.user.findUnique({where:{email}});
 if(!found){await db.user.create({data:{name:'Kitchen Admin',email,passwordHash:await argon2.hash(password,{type:argon2.argon2id}),role:'ADMIN'}});console.log('New admin account created:',email)}
 else console.log('Admin email already exists; not changing role or password. Use a new address if necessary.');}
 else console.log('Admin account not configured. Add ADMIN_EMAIL and ADMIN_PASSWORD then rerun npm run db:seed.');
 console.log(`Ready: ${seeds.length} seeded recipes.`);
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
