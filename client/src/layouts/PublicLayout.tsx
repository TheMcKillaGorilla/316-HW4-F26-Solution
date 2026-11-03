/**
 * PublicLayout.tsx
 *
 * The frame around the splash, login and sign up pages, and their GUARD: a
 * user who is already logged in has no business here, and goes to their lists.
 *
 * <Navigate> is a redirect you render. <Outlet> is where the page whose URL
 * matched goes.
 */
import { Navigate, Outlet } from 'react-router';
import { useSession } from '@/context/SessionContext';

export default function PublicLayout() {
    const { user } = useSession();

    if (user) return <Navigate to="/lists" replace />;

    return (
        <main className="card-scroll flex h-screen flex-col items-center overflow-y-auto
                         bg-[radial-gradient(ellipse_at_top,var(--color-sbu-red-light),var(--color-sbu-red-dark)_70%)]
                         px-4 py-10">
            <div className="my-auto flex w-full flex-col items-center">
                {/* nothing until the server has said who is logged in, so a
                    logged in user never sees the splash screen flash past */}
                {user === null && <Outlet />}
            </div>
        </main>
    );
}
