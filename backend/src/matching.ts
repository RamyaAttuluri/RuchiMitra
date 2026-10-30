// Ingredient normalisation, strict pantry matching and related-recipe scoring.
// Pure functions (no database access) so they can be unit tested.

export type Ing={name:string;quantity:number|null;unit:string;optional?:boolean};
export type RecipeLike={id:string;slug:string;name:string;category:string;cuisine:string;tags:string[];ingredients:Ing[]};

// Words that describe preparation, not identity ("firm fish fillets" is fish).
const DESCRIPTORS=/\b(fresh|chopped|finely|sliced|diced|minced|grated|cooked|boiled|dried|dry|firm|button|large|small|medium|ripe|whole|crushed|ground|fillets?|pieces?|cubes?)\b/g;
// Same ingredient, different words (English, Hindi, Telugu). Distinct ingredients are deliberately NOT merged:
// chilli powder ≠ green chilli, paneer ≠ milk, butter ≠ oil.
const SYNONYMS:Record<string,string>={
 chili:'chilli',chilly:'chilli',chillies:'chilli','chili powder':'chilli powder','red chilli powder':'chilli powder','red chili powder':'chilli powder','lal mirch':'chilli powder',
 'green chilli':'green chilli','hari mirch':'green chilli',cilantro:'coriander leaves',dhania:'coriander leaves','coriander leaf':'coriander leaves',
 'cooking oil':'oil','vegetable oil':'oil','sunflower oil':'oil',aloo:'potato',gobi:'cauliflower','phool gobi':'cauliflower',palak:'spinach',
 jeera:'cumin','cumin seeds':'cumin',haldi:'turmeric',namak:'salt',pyaz:'onion',pyaaz:'onion',tamatar:'tomato',lehsun:'garlic',adrak:'ginger',
 anda:'egg',ande:'egg',murgh:'chicken',machli:'fish',chawal:'rice',chana:'chickpeas',chole:'chickpeas',kadala:'chickpeas',
 'toor dal':'toor dal','tur dal':'toor dal','arhar dal':'toor dal',kandi:'toor dal',pappu:'dal',
 'ఉల్లిపాయ':'onion','ఉల్లిపాయలు':'onion','టమాటా':'tomato','టమాటాలు':'tomato','ఉప్పు':'salt','పసుపు':'turmeric','నూనె':'oil','చికెన్':'chicken','పనీర్':'paneer','గుడ్లు':'egg','బియ్యం':'rice','పప్పు':'dal','అల్లం':'ginger','వెల్లుల్లి':'garlic',
 'प्याज':'onion','प्याज़':'onion','टमाटर':'tomato','नमक':'salt','हल्दी':'turmeric','तेल':'oil','चिकन':'chicken','पनीर':'paneer','अंडा':'egg','अंडे':'egg','चावल':'rice','दाल':'dal','अदरक':'ginger','लहसुन':'garlic',
};
// Required item -> what else may satisfy it. A general term the user types covers specific varieties.
const COVERED_BY:Record<string,string[][]>={
 'ginger garlic paste':[['ginger','garlic']],
 'tomato puree':[['tomato']],
 'kashmiri chilli powder':[['chilli powder']],
 'basmati rice':[['rice']],
 'rice':[['basmati rice']],
 'water':[['drinking water']],
 'toor dal':[['dal']],'moong dal':[['dal']],'yellow moong dal':[['dal']],'masoor dal':[['dal']],
 'tamarind pulp':[['tamarind']],
 'chickpeas':[['chickpea']],
};
export const STAPLES=['salt','water','oil','turmeric'];

const singular=(w:string)=>w.length>3&&/oes$/.test(w)?w.slice(0,-2):w.length>3&&/ies$/.test(w)&&!/chillies$/.test(w)?w.slice(0,-3)+'y':w.length>3&&/[^s]s$/.test(w)?w.slice(0,-1):w;
export function canonical(raw:string){
 let s=raw.toLowerCase().normalize('NFC').replace(/\(.*?\)/g,' ').replace(/[^\p{L}\p{M}\s-]/gu,' ').replace(/\s+/g,' ').trim();
 // Discard quantities/units pasted from a recipe ingredient chip.
 s=s.replace(/^(?:a |an )?/,'').replace(/\b(?:cups?|tbsp|tsp|teaspoons?|tablespoons?|grams?|kilograms?|kg|g|ml|litres?|liters?|liters?|litre)\b/g,' ').replace(/\s+/g,' ').trim();
 if(SYNONYMS[s])return SYNONYMS[s];
 s=s.replace(DESCRIPTORS,' ').replace(/\s+/g,' ').trim();
 s=s.split(' ').map(singular).join(' ');
 for(let i=0;i<3&&SYNONYMS[s]&&SYNONYMS[s]!==s;i++)s=SYNONYMS[s];
 // Multi-word synonyms inside a phrase ("red chili powder" -> "chilli powder").
 s=s.replace(/\bchili\b/g,'chilli').replace(/^red chilli powder$/,'chilli powder');
 return SYNONYMS[s]??s;
}
/** "Yellow moong or toor dal" -> alternatives; any one satisfies the requirement. */
function alternatives(name:string){
 const parts=name.split(/\s+or\s+/i).map(p=>p.trim()).filter(Boolean);
 if(parts.length===2&&!/\s/.test(parts[0])&&/\s/.test(parts[1])){const tail=parts[1].split(' ').slice(1).join(' ');parts[0]=`${parts[0]} ${tail}`}
 return parts.map(canonical);
}
function satisfied(required:string,have:Set<string>){
 if(have.has(required))return true;
 return (COVERED_BY[required]??[]).some(group=>group.every(g=>have.has(g)));
}

export function matchPantry(recipes:RecipeLike[],available:string[],opts:{includeStaples:boolean;nearMatches:boolean;maxMissing?:number}){
 const have=new Set(available.map(canonical));
 if(opts.includeStaples)STAPLES.forEach(s=>have.add(s));
 const exact:unknown[]=[];const near:unknown[]=[];
 for(const r of recipes){
  const required=r.ingredients.filter(i=>!i.optional);
  const missing:string[]=[];const matched:string[]=[];
  for(const ing of required)(alternatives(ing.name).some(a=>satisfied(a,have))?matched:missing).push(ing.name);
  const row={recipe:r,required:required.map(i=>i.name),matched,missing,matchedCount:matched.length,requiredCount:required.length};
  // requiredIngredients ⊆ availableIngredients
  if(!missing.length)exact.push(row);
  else if(opts.nearMatches&&missing.length<=(opts.maxMissing??4)&&matched.length>=2)near.push(row);
 }
 const byMissing=(a:any,b:any)=>a.missing.length-b.missing.length||b.matchedCount-a.matchedCount;
 return {exact:(exact as any[]).sort((a,b)=>a.requiredCount-b.requiredCount),near:(near as any[]).sort(byMissing).slice(0,12),normalized:[...have]};
}

// ---- Related recipes ----
const PRIMARY:[string,RegExp][]=[
 ['chicken',/chicken|murgh/],['mutton',/mutton|lamb|goat/],['fish',/fish|machli/],['prawn',/prawn|shrimp/],['egg',/\begg/],
 ['paneer',/paneer/],['lentils',/\bdal\b|pappu|lentil|sambar|moong|toor|masoor/],['chickpeas',/chana|chole|chickpea/],
 ['mushroom',/mushroom/],['potato',/potato|aloo/],['cauliflower',/cauliflower|gobi/],['spinach',/spinach|palak/],['rice',/\brice\b|biryani|pulao/],['vegetables',/vegetable|kurma|korma/],
];
const FAMILY:[string,RegExp][]=[
 ['lentil curry',/\bdal\b|pappu|sambar|tadka/],['rice dish',/\brice\b|biryani|pulao/],['fry',/\bfry\b|roast|sukka|65/],
 ['gravy curry',/curry|masala|kurma|korma|butter|gravy|makhani|kadai|kadhai|shahi|tikka masala|palak/],
];
export function profile(r:RecipeLike){
 const name=r.name.toLowerCase();
 const ingText=r.ingredients.slice(0,3).map(i=>i.name.toLowerCase()).join(' ');
 const primary=PRIMARY.find(([,re])=>re.test(name))?.[0]??PRIMARY.find(([,re])=>re.test(ingText))?.[0]??null;
 const family=FAMILY.find(([,re])=>re.test(name))?.[0]??null;
 const ingredients=new Set(r.ingredients.map(i=>canonical(i.name)).filter(n=>!STAPLES.includes(n)));
 return {primary,family,ingredients,tags:new Set(r.tags.map(t=>t.toLowerCase()))};
}
export function relatedRecipes<T extends RecipeLike>(current:T,pool:T[],limit=6){
 const me=profile(current);
 const nonVeg=(c:string)=>c==='Non-Vegetarian';
 const scored=pool.filter(r=>r.id!==current.id&&r.slug!==current.slug).map(r=>{
  const p=profile(r);
  // Never cross the veg / non-veg line just because both are curries.
  if(nonVeg(r.category)!==nonVeg(current.category)&&!(me.primary&&p.primary===me.primary))return {recipe:r,score:0,primary:p.primary,reasons:[]};const reasons:string[]=[];let score=0;
  if(me.primary&&p.primary===me.primary){score+=50;reasons.push(`Also made with ${me.primary}`)}
  if(me.family&&p.family===me.family){score+=22;reasons.push(me.family==='lentil curry'?'Another dal':`Another ${me.family}`)}
  if(r.category===current.category){score+=10;if(!reasons.length)reasons.push(r.category)}
  if(r.cuisine===current.cuisine){score+=6;reasons.push(`${r.cuisine} cuisine`)}
  const sharedTags=[...p.tags].filter(t=>me.tags.has(t)).length;score+=Math.min(sharedTags,3)*4;
  const inter=[...p.ingredients].filter(i=>me.ingredients.has(i)).length;const union=new Set([...p.ingredients,...me.ingredients]).size||1;
  score+=Math.round(inter/union*20);
  return {recipe:r,score,primary:p.primary,reasons:reasons.slice(0,2)};
 });
 // Must share the main ingredient or dish family, or be a strong same-category match: never filler.
 return scored.filter(s=>s.score>=28).sort((a,b)=>b.score-a.score).slice(0,limit);
}
