/**
 * AppLayout.tsx
 *
 * The GUARD for every page behind the login, and the frame they share.
 *
 * Nobody logged in, and the pages inside are never rendered at all: <Navigate>
 * sends the browser to the splash screen instead. A page inside this layout
 * can therefore take a logged in user for granted (see useUser).
 *
 * The guard is for the user's sake, not for security. Anybody can change the
 * JavaScript running in their own browser, so what actually keeps lists
 * private is the server: authenticate.ts, and owner_id on every query.
 */
import { Navigate, Outlet } from 'react-router';
import { useSession } from '@/context/SessionContext';
import AppHeader from '@/components/AppHeader';

export default function AppLayout() {
    const { user } = useSession();

    // the server has not answered yet
    if (user === undefined) {
        return <p className="m-auto pt-[40vh] text-center text-[1.0625rem] text-grey-500">Loading…</p>;
    }
    if (user === null) return <Navigate to="/" replace />;

    return (
        <div id="app" className="flex h-screen flex-col">
            <AppHeader />
            <Outlet />
        </div>
    );
}
