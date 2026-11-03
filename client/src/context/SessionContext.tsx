/**
 * SessionContext.tsx
 *
 * Who is logged in, for the whole application.
 *
 * The login cookie is httpOnly, so no script can read it to find out. When
 * the application opens, it simply asks the server, GET /api/users/me, and
 * the answer is the user, or a 401 meaning nobody. Until that answer arrives
 * the user is undefined, "not known yet", which is different from null,
 * "known to be nobody", and the layouts wait rather than guess.
 *
 * Logging in, signing up and logging out change it, and so does any 401 from
 * the server later on, which means the login has run out.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { UserDTO } from '@wolfie-lists/shared';
import * as api from '@/lib/api';

interface SessionContextValue {
    /** undefined until the server has said, then the user or null */
    user: UserDTO | null | undefined;
    /** after logging in or signing up, or a change the server reports, i.e. a new avatar */
    setUser: (user: UserDTO | null) => void;
    logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
    const value = useContext(SessionContext);
    if (value === null) throw new Error('useSession must be used inside a <SessionProvider>');
    return value;
}

/**
 * For components behind the AppLayout guard, which only renders them once
 * somebody is logged in, so they can take a user for granted.
 */
export function useUser(): UserDTO {
    const { user } = useSession();
    if (!user) throw new Error('useUser must be used inside the AppLayout');
    return user;
}

export function SessionProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserDTO | null | undefined>(undefined);
    const navigate = useNavigate();

    // ask once, when the application opens; the ignore flag is for StrictMode
    useEffect(() => {
        let ignore = false;
        api.getMe()
            .then((me) => { if (!ignore) setUser(me); })
            .catch(() => { if (!ignore) setUser(null); });
        return () => { ignore = true; };
    }, []);

    // a login that runs out while the app is open: forget the user, and the
    // AppLayout guard sends them back to the splash screen
    useEffect(() => {
        api.setUnauthorizedHandler(() => setUser(null));
        return () => api.setUnauthorizedHandler(() => {});
    }, []);

    async function logout() {
        // if the server cannot be reached there is nothing more to do, so the
        // user leaves either way
        await api.logout().catch(() => {});
        setUser(null);
        // replace, so Back cannot return to a page that needs a login
        navigate('/', { replace: true });
    }

    return <SessionContext.Provider value={{ user, setUser, logout }}>{children}</SessionContext.Provider>;
}
