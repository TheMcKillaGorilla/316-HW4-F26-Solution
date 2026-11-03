/**
 * RegisterContainer.tsx
 *
 * The sign up form: email, password twice, and an avatar if the user wants
 * one now. Creating the account also logs them in, and the avatar, if chosen,
 * is uploaded straight afterwards, since only a logged in user can have one.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { MIN_PASSWORD_LENGTH } from '@wolfie-lists/shared';
import * as api from '@/lib/api';
import { useModals } from '@/context/ModalContext';
import { useSession } from '@/context/SessionContext';
import Form from '@/components/Form';
import AvatarPicker from '@/components/AvatarPicker';

export default function RegisterContainer() {
    const navigate = useNavigate();
    const { inform } = useModals();
    const { setUser } = useSession();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [avatar, setAvatar] = useState<File | null>(null);

    async function createAccount() {
        if (email.trim() === '') throw new Error('Enter your email address.');
        if (password.length < MIN_PASSWORD_LENGTH) {
            throw new Error(`A password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
        }
        if (password !== confirmPassword) throw new Error('The two passwords do not match.');

        let user = await api.register(email, password);

        // the account exists now, so a failed upload must not undo it; say so
        // and carry on, since the avatar can be set again from the account page
        if (avatar !== null) {
            try {
                user = await api.uploadAvatar(avatar);
            } catch (error) {
                inform({
                    title: 'Your Avatar Was Not Saved',
                    message: `${(error as Error).message} You can choose one again under Account Settings.`
                });
            }
        }
        // only now, so the session never shows the account without its avatar
        setUser(user);
        navigate('/lists', { replace: true });
    }

    return (
        <>
            <h1 className="m-0 text-center text-[1.5rem] font-bold">Create an Account</h1>
            <Form id="register-form" onSubmit={createAccount}>
                <Form.Error />
                <AvatarPicker user={{ email, avatarUrl: null }} label="Choose an Avatar" onChoose={setAvatar} />
                <Form.Field id="register-email" label="Email" type="email" autoComplete="email" autoFocus
                            value={email} onChange={(event) => setEmail(event.target.value)} />
                <Form.Field id="register-password" label="Password" type="password" autoComplete="new-password"
                            hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
                            value={password} onChange={(event) => setPassword(event.target.value)} />
                <Form.Field id="register-confirm-password" label="Confirm Password" type="password"
                            autoComplete="new-password"
                            value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
                <Form.Submit pendingLabel="Creating Your Account…">Create Account</Form.Submit>
            </Form>
            <p className="m-0 text-center text-[0.9375rem] text-grey-700">
                Already have an account? <Link to="/login" className="font-semibold text-sbu-red">Log in</Link>
            </p>
        </>
    );
}
