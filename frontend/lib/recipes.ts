export const formatQty=(n:number|null):string=>{
 if(n===null)return 'to taste';const rounded=Math.round(n*100)/100;const whole=Math.floor(rounded);const frac=Math.round((rounded-whole)*100)/100;
 const chars:Record<number,string>={0.25:'¼',0.5:'½',0.75:'¾'};
 return chars[frac]!==undefined?`${whole||''}${chars[frac]}`:String(rounded);
};
