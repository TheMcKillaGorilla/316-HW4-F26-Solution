/**
 * RegisterPage.tsx, at /register
 */
import AuthCard from '@/components/AuthCard';
import RegisterContainer from '@/containers/RegisterContainer';

export default function RegisterPage() {
    return (
        <AuthCard label="Create an account">
            <title>Create an Account · Wolfie Lists</title>
            <RegisterContainer />
        </AuthCard>
    );
}
