/**
 * SplashPage.tsx, at /
 *
 * The large logo and the two ways in.
 *
 * Every page renders its own <title>. React 19 moves a <title> rendered
 * anywhere into the document's <head>, so the browser tab names the page.
 */
import { Link } from 'react-router';

export default function SplashPage() {
    return (
        <section aria-label="Welcome" className="flex flex-col items-center gap-6 text-center text-sbu-white">
            <title>Wolfie Lists</title>
            <img id="splash-logo" src="/images/wolfie-logo.png" alt="Wolfie, the Stony Brook Seawolf"
                 width="1464" height="1054"
                 className="h-auto w-[min(22rem,70vw)] drop-shadow-[0_0.5rem_1.25rem_rgba(0,0,0,0.45)]" />
            <h1 className="m-0 font-script text-[4.5rem] leading-none font-normal tracking-[0.03em]
                           [text-shadow:0_0.1875rem_0.375rem_rgba(0,0,0,0.4)] max-[46rem]:text-[3.25rem]">
                Wolfie Lists
            </h1>
            <p className="m-0 max-w-[26rem] text-[1.125rem] text-sbu-white/90">
                Keep track of everything you need to do, from homework to hackathons.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
                <Link to="/register" className={`${SPLASH_BUTTON} bg-sbu-white text-sbu-red hover:bg-grey-100`}>
                    Create Account
                </Link>
                <Link to="/login"
                      className={`${SPLASH_BUTTON} border-2 border-sbu-white text-sbu-white hover:bg-white/15`}>
                    Log In
                </Link>
            </div>
        </section>
    );
}

const SPLASH_BUTTON =
    'min-w-40 rounded-full px-6 py-3 text-[1.0625rem] font-bold no-underline shadow-card '
    + 'transition-colors duration-150 focus-visible:outline-[0.1875rem] focus-visible:outline-offset-2 '
    + 'focus-visible:outline-sbu-white';
