import {configureEnvironment} from '../scripts/env.mjs';
configureEnvironment();
import {PrismaClient} from '@prisma/client';
import * as argon2 from 'argon2';

// Run explicitly with npm run admin:reset AFTER changing ADMIN_EMAIL and ADMIN_PASSWORD in .env.
// This refuses to elevate a normal user to admin.
const db = new PrismaClient();
async function main() {
  const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password=process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length<12) throw Error('Set ADMIN_EMAIL and a unique ADMIN_PASSWORD (12+ characters) in backend/.env.');
  if (process.env.NODE_ENV==='production' && (password==='RecipeAdminLocal@2026'||email==='admin@recipefinder.com')) throw Error('Change demo credentials before production reset.');
  const user=await db.user.findUnique({where:{email}});
  if (!user) throw Error('Admin email not found. Run npm run db:seed to create a NEW admin account.');
  if (user.role!=='ADMIN') throw Error('Existing account has USER role. Refusing to grant ADMIN privileges. Choose a different admin email.');
  const passwordHash=await argon2.hash(password,{type:argon2.argon2id});
  await db.user.update({where:{id:user.id},data:{passwordHash}});
  await db.session.deleteMany({where:{userId:user.id}});
  console.log(`Admin password reset securely for ${email}. Previous sessions revoked.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
