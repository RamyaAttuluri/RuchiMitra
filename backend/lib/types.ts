export type Ingredient = { name: string; quantity: number | null; unit: string };
export type CookingStep = { title: string; text: string; minutes: number | null };
export type Translation = { name: string; ingredients: string[]; steps: {title:string; text:string}[]; intro: string; description?: string; tip?: string };
export type RecipeData = {
 id: string; slug:string; name:string; description:string; cuisine:string; category:string;
 difficulty:string; prepMinutes:number; cookMinutes:number; servings:number; imageUrl:string;
 tags:string[]; ingredients:Ingredient[]; steps:CookingStep[]; tip:string;
 translations:Record<string,Translation>; source:string;
};
