export class ProviderError extends Error {
 constructor(message:string,public status=502,public code='AI_UNAVAILABLE'){super(message)}
}
