/**
 * App.tsx
 *
 * Every page in the application, and the layouts around them, in one
 * screenful. With React Router the routes are components too, and their
 * nesting is the page structure:
 *
 *     <PublicLayout>                 only for people who are NOT logged in
 *         /                          the splash screen
 *         /login
 *         /register
 *     <AppLayout>                    only for people who ARE logged in
 *         /lists                     the home screen
 *         /lists/:id                 one list (?new selects its name)
 *         /account
 *
 * A route with an element but no path is a LAYOUT ROUTE: it adds no part to
 * the URL, it just wraps every route inside it. Its <Outlet /> is where the
 * matching child page goes. That is what lets each group share one guard and
 * one frame, and it is the component architecture of this application.
 *
 * The providers are outermost because every page needs them. SessionProvider
 * is inside BrowserRouter (see main.tsx) because logging out navigates.
 */
import { Route, Routes } from 'react-router';
import { ModalProvider } from '@/context/ModalContext';
import { SessionProvider } from '@/context/SessionContext';
import ModalLayer from '@/components/modals/ModalLayer';
import PublicLayout from '@/layouts/PublicLayout';
import AppLayout from '@/layouts/AppLayout';
import SplashPage from '@/pages/SplashPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ListsPage from '@/pages/ListsPage';
import ListPage from '@/pages/ListPage';
import AccountPage from '@/pages/AccountPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App() {
    return (
        <ModalProvider>
            <SessionProvider>
                <Routes>
                    <Route element={<PublicLayout />}>
                        <Route index element={<SplashPage />} />
                        <Route path="login" element={<LoginPage />} />
                        <Route path="register" element={<RegisterPage />} />
                    </Route>
                    <Route element={<AppLayout />}>
                        <Route path="lists" element={<ListsPage />} />
                        <Route path="lists/:id" element={<ListPage />} />
                        <Route path="account" element={<AccountPage />} />
                    </Route>
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
                <ModalLayer />
            </SessionProvider>
        </ModalProvider>
    );
}
