/**
 * Avatar.tsx
 *
 * A user's picture, or, until they upload one, the first letter of their
 * email in a red circle.
 */
import type { UserDTO } from '@wolfie-lists/shared';

interface AvatarProps {
    user: Pick<UserDTO, 'email' | 'avatarUrl'>;
    /** the diameter, in rem */
    size?: number;
    className?: string;
}

export default function Avatar({ user, size = 2.5, className = '' }: AvatarProps) {
    const style = { width: `${size}rem`, height: `${size}rem`, fontSize: `${size * 0.45}rem` };
    const shape = `inline-flex flex-none items-center justify-center overflow-hidden rounded-full ${className}`;

    if (user.avatarUrl !== null) {
        return <img src={user.avatarUrl} alt="" style={style} className={`${shape} object-cover`} />;
    }
    return (
        <span style={style} aria-hidden="true"
              className={`${shape} bg-sbu-red-dark font-bold text-sbu-white uppercase`}>
            {user.email.charAt(0)}
        </span>
    );
}
