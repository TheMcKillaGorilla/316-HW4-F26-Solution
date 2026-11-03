/**
 * AvatarMenu.tsx
 *
 * The user's avatar at the right of the header. Pressing it opens a small
 * menu with their email, a link to their account page, and Log Out. A click
 * anywhere else, or Escape, closes it again.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useSession, useUser } from '@/context/SessionContext';
import Avatar from './Avatar';

export default function AvatarMenu() {
    const user = useUser();
    const { logout } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return undefined;

        function handlePointerDown(event: PointerEvent) {
            if (!menuRef.current?.contains(event.target as Node)) setIsOpen(false);
        }
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') setIsOpen(false);
        }

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    return (
        <div ref={menuRef} className="relative">
            <button
                id="account-menu-button"
                type="button"
                aria-label={`Account menu for ${user.email}`}
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onClick={() => setIsOpen((open) => !open)}
                className="cursor-pointer rounded-full border-2 border-sbu-white/80 p-0 leading-none
                           transition-[border-color] duration-150 hover:border-sbu-white
                           focus-visible:outline-[0.1875rem] focus-visible:outline-offset-2
                           focus-visible:outline-sbu-white">
                <Avatar user={user} size={2.5} />
            </button>

            {isOpen && (
                <div id="account-menu" role="menu" aria-label="Account"
                     className="absolute top-[calc(100%+0.5rem)] right-0 z-50 w-64 overflow-hidden
                                rounded-card bg-sbu-white text-grey-900 shadow-modal">
                    <div className="flex items-center gap-3 border-b border-grey-200 px-4 py-3">
                        <Avatar user={user} size={2.25} />
                        <span id="account-menu-email" className="min-w-0 truncate text-[0.9375rem]">
                            {user.email}
                        </span>
                    </div>
                    <Link to="/account" role="menuitem" onClick={() => setIsOpen(false)}
                          className={MENU_ITEM}>
                        Account Settings
                    </Link>
                    <button type="button" role="menuitem" id="logout-button"
                            onClick={() => { setIsOpen(false); void logout(); }}
                            className={`${MENU_ITEM} w-full text-left`}>
                        Log Out
                    </button>
                </div>
            )}
        </div>
    );
}

const MENU_ITEM =
    'block cursor-pointer border-none bg-transparent px-4 py-2.5 text-[0.9375rem] text-grey-900 '
    + 'no-underline hover:bg-grey-100 focus-visible:bg-grey-100 focus-visible:outline-none';
