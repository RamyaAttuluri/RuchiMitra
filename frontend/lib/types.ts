export type Ingredient = { id?:string; identity?:string; displayName?:string; optional?:boolean; scalable?:boolean; name: string; quantity: number | null; unit: string };
export type CookingStep = { id?:string; number?:number; temperature?:string; heatLevel?:string; title: string; text: string; minutes: number | null };
export type Translation = { name: string; ingredients: string[]; steps: {title:string; text:string}[]; intro: string; description?: string; tip?: string; servings?:number };
export type RecipeStatus = 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
export type RecipeData = {
 id: string; slug:string; name:string; description:string; cuisine:string; category:string;
 difficulty:string; prepMinutes:number; cookMinutes:number; servings:number; imageUrl:string;
 tags:string[]; ingredients:Ingredient[]; steps:CookingStep[]; tip:string;
 translations:Record<string,Translation>; source:string;
 status?: RecipeStatus; createdAt?: string; updatedAt?: string;
};
export type Lang = 'en' | 'hi' | 'te';
