/**
 * LoginPage.tsx, at /login
 *
 * Pages stay thin: a title, and the container that actually does the work.
 */
import AuthCard from '@/components/AuthCard';
import LoginContainer from '@/containers/LoginContainer';

export default function LoginPage() {
    return (
        <AuthCard label="Log in">
            <title>Log In · Wolfie Lists</title>
            <LoginContainer />
        </AuthCard>
    );
}
