/**
 * NotFoundPage.tsx
 *
 * Shown for any URL that matches no route.
 */
import { Link } from 'react-router';

export default function NotFoundPage() {
    return (
        <main className="flex h-screen flex-col items-center justify-center gap-4 text-center">
            <title>Not Found · Wolfie Lists</title>
            <h1 className="m-0 text-[1.75rem]">There is no page here.</h1>
            <Link to="/" className="font-semibold text-sbu-red">Go to Wolfie Lists</Link>
        </main>
    );
}
