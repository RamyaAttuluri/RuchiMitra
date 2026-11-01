import {PrismaClient} from '@prisma/client';
import {configureEnvironment} from './env.mjs';
configureEnvironment();
const db=new PrismaClient();
try{
 const count=await db.user.count({where:{role:'ADMIN'}});
 const configured=process.env.ADMIN_EMAIL?.trim().toLowerCase();
 const account=configured?await db.user.findUnique({where:{email:configured},select:{role:true}}):null;
 console.log(JSON.stringify({adminAccounts:count,configuredEmailPresent:Boolean(configured),configuredEmailIsAdmin:account?.role==='ADMIN',databaseConnected:true},null,2));
 if(!count){console.error('No administrator exists. Configure ADMIN_EMAIL and ADMIN_PASSWORD, then run npm run db:seed. Existing passwords are never changed by this check.');process.exitCode=1}
}catch{console.error('Cannot inspect administrator accounts. Check DATABASE_URL and run the safe setup if the schema is missing.');process.exitCode=1}finally{await db.$disconnect()}
