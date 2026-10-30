'use client';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <main className="container subpage"><div className="empty-state"><h2>Something went wrong in the kitchen.</h2><p>Please try again. If you're setting this up for the first time, run npm run setup.</p><button className="btn btn-dark" onClick={reset}>Try again</button></div></main>}
