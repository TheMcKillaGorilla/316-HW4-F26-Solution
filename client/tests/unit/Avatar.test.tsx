/**
 * Avatar.test.tsx
 *
 * The user's picture, or the first letter of their email until they have one.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Avatar from '@/components/Avatar';

describe('Avatar', () => {
    it('shows the first letter of the email when there is no picture', () => {
        const { container } = render(<Avatar user={{ email: 'wolfie@stonybrook.edu', avatarUrl: null }} />);

        expect(container).toHaveTextContent('w');
        expect(container.querySelector('img')).toBeNull();
    });

    it('shows the picture when there is one, and no letter', () => {
        const { container } = render(
            <Avatar user={{ email: 'wolfie@stonybrook.edu', avatarUrl: '/api/users/me/avatar?v=1' }} />);

        expect(container.querySelector('img')).toHaveAttribute('src', '/api/users/me/avatar?v=1');
        expect(container).toHaveTextContent('');
    });

    /** whatever sits beside an avatar already says whose it is */
    it('is decoration as far as a screen reader is concerned', () => {
        const { container: letter } = render(<Avatar user={{ email: 'wolfie@stonybrook.edu', avatarUrl: null }} />);
        const { container: picture } = render(<Avatar user={{ email: 'w@x.edu', avatarUrl: '/a.png' }} />);

        expect(letter.firstElementChild).toHaveAttribute('aria-hidden', 'true');
        expect(picture.querySelector('img')).toHaveAttribute('alt', '');
    });

    it('is drawn at the size it is asked for', () => {
        const { container } = render(<Avatar user={{ email: 'w@x.edu', avatarUrl: null }} size={4} />);

        expect(container.firstElementChild).toHaveStyle({ width: '4rem', height: '4rem' });
    });
});
