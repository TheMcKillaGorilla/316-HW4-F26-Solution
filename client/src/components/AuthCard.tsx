/**
 * AuthCard.tsx
 *
 * The white card the login and sign up forms sit in, with the logo above it
 * leading back to the splash screen.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export default function AuthCard({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section aria-label={label} className="flex w-full max-w-[26rem] flex-col items-center gap-5">
            <Link to="/" aria-label="Back to the Wolfie Lists welcome page">
                <img src="/images/wolfie-logo.png" alt="" width="1464" height="1054"
                     className="h-24 w-auto drop-shadow-[0_0.375rem_0.75rem_rgba(0,0,0,0.4)]" />
            </Link>
            <div className="flex w-full flex-col gap-5 rounded-modal bg-sbu-white p-7 shadow-modal">
                {children}
            </div>
        </section>
    );
}
