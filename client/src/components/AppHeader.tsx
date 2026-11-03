/**
 * AppHeader.tsx
 *
 * The red bar across the top of every page behind the login. AppLayout
 * renders it once, above its <Outlet />, so it stays put, avatar menu and
 * all, while the pages beneath it change.
 */
import { Link } from 'react-router';
import AvatarMenu from './AvatarMenu';

export default function AppHeader() {
    return (
        <header className="relative z-10 flex items-center justify-center gap-4 bg-sbu-red px-6 py-3
                           text-sbu-white shadow-bar max-[46rem]:justify-start max-[46rem]:px-4">
            <Link to="/lists" aria-label="Wolfie Lists, your lists"
                  className="flex items-center gap-3 text-sbu-white no-underline">
                {/* alt is empty because the words beside it already say Wolfie Lists */}
                <img className="h-11 w-auto drop-shadow-[0_0.125rem_0.25rem_rgba(0,0,0,0.35)]
                                max-[46rem]:h-9"
                     src="/images/wolfie-logo.png" alt="" width="1464" height="1054" />
                <span className="font-script text-[2.5rem] leading-[1.1]
                                 tracking-[0.03em] [text-shadow:0_0.125rem_0.25rem_rgba(0,0,0,0.35)]
                                 max-[46rem]:text-[1.875rem]">
                    Wolfie Lists
                </span>
            </Link>
            <div className="absolute top-1/2 right-6 -translate-y-1/2 max-[46rem]:right-4">
                <AvatarMenu />
            </div>
        </header>
    );
}
