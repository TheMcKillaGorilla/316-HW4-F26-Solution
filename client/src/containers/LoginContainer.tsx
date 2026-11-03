/**
 * LoginContainer.tsx
 *
 * The login form. On success the server has set the login cookie, the
 * session learns who is logged in, and the user goes on to their lists.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import * as api from '@/lib/api';
import { useSession } from '@/context/SessionContext';
import Form from '@/components/Form';

export default function LoginContainer() {
    const navigate = useNavigate();
    const { setUser } = useSession();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    async function logIn() {
        if (email.trim() === '' || password === '') {
            throw new Error('Enter your email address and your password.');
        }
        setUser(await api.login(email, password));
        // replace, so Back does not return to the login form
        navigate('/lists', { replace: true });
    }

    return (
        <>
            <h1 className="m-0 text-center text-[1.5rem] font-bold">Log In</h1>
            <Form id="login-form" onSubmit={logIn}>
                <Form.Error />
                <Form.Field id="login-email" label="Email" type="email" autoComplete="email" autoFocus
                            value={email} onChange={(event) => setEmail(event.target.value)} />
                <Form.Field id="login-password" label="Password" type="password" autoComplete="current-password"
                            value={password} onChange={(event) => setPassword(event.target.value)} />
                <Form.Submit pendingLabel="Logging In…">Log In</Form.Submit>
            </Form>
            <p className="m-0 text-center text-[0.9375rem] text-grey-700">
                New to Wolfie Lists? <Link to="/register" className="font-semibold text-sbu-red">Create an account</Link>
            </p>
        </>
    );
}
