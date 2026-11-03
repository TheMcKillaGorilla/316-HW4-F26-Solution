/**
 * harness.tsx
 *
 * Ways of putting the application on screen for a test. Each installs the
 * fake server first, holding whatever lists the test asks for, and renders
 * under StrictMode as in development, so an effect that is not safe to run
 * twice fails here rather than in the browser.
 *
 * The router is React Router's own. MemoryRouter is BrowserRouter without the
 * address bar: it keeps the URL in memory, starting from initialEntries, so a
 * test can open the application at any URL and every <Link>, navigate() and
 * <Navigate> really does go where it says.
 */
import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import type { ListDTO } from '@wolfie-lists/shared';
import App from '@/App';
import { ModalProvider, useModals } from '@/context/ModalContext';
import { CurrentListProvider, useCurrentList } from '@/context/CurrentListContext';
import { useListEditor } from '@/hooks/useListEditor';
import { installFakeServer } from './fakeServer';
import { WEEKEND_LIST } from './fixtures';

/**
 * Shows the URL the router is at, i.e. /lists/list-weekend?new, so a test can
 * read it with currentUrl(). With no address bar, this is the address bar.
 */
function LocationDisplay() {
    const { pathname, search } = useLocation();
    return <p data-testid="location">{pathname + search}</p>;
}

/** @returns the URL the application is at, as LocationDisplay shows it */
export const currentUrl = () => screen.getByTestId('location').textContent;

/**
 * Renders the whole application, routes, layouts and guards included, opened
 * at one URL.
 *
 * Who is logged in is up to the fake server, exactly as it is up to the real
 * one: SessionProvider asks it, and until it answers the layouts wait. So a
 * test should find something on screen before it does anything else.
 *
 * @param url where the application opens
 * @param loggedIn false to start with nobody logged in
 * @param lists the logged in user's lists, in home screen order
 * @returns the testing library result, a userEvent instance, and the fake server
 */
export function renderApp({ url = '/lists', loggedIn = true, lists = [WEEKEND_LIST] }:
                          { url?: string; loggedIn?: boolean; lists?: ListDTO[] } = {}) {
    const server = installFakeServer(lists, { loggedIn });
    const result = render(
        <StrictMode>
            <MemoryRouter initialEntries={[url]}>
                <App />
                <LocationDisplay />
            </MemoryRouter>
        </StrictMode>
    );
    return { server, user: userEvent.setup(), ...result };
}

/** what renderOpenList's probe reads on every render */
export interface OpenListContext {
    editor: ReturnType<typeof useListEditor>;
    currentList: ReturnType<typeof useCurrentList>;
    modals: ReturnType<typeof useModals>;
}

/**
 * Renders just the providers, with the first list open, and hands the test direct
 * access to the editor hook and the contexts. The editing tests use this to
 * drive the real contexts and the real history without clicking.
 *
 * @returns `context`, whose .current is refreshed on every render, plus the fake server
 */
export function renderOpenList({ lists = [WEEKEND_LIST] }: { lists?: ListDTO[] } = {}) {
    const server = installFakeServer(lists);

    // not state: updated on every render so a test always reads the latest.
    // It is filled in by the first render, which happens before render() returns.
    const context = {} as { current: OpenListContext };

    function Probe() {
        context.current = {
            editor: useListEditor(),
            currentList: useCurrentList(),
            modals: useModals()
        };
        return null;
    }

    // a router too, since closing a list navigates
    const result = render(
        <StrictMode>
            <MemoryRouter initialEntries={[`/lists/${lists[0].id}`]}>
                <ModalProvider>
                    <CurrentListProvider listId={lists[0].id}>
                        <Probe />
                    </CurrentListProvider>
                </ModalProvider>
            </MemoryRouter>
        </StrictMode>
    );

    return { context, server, user: userEvent.setup(), ...result };
}
