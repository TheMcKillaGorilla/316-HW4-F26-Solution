/**
 * setup.ts
 *
 * Runs before every test file: adds the DOM matchers (toBeInTheDocument,
 * toHaveValue, ...) and unmounts whatever each test rendered.
 *
 * Nothing is mocked here. The tests render the real React Router, in memory
 * rather than in an address bar (see helpers/harness.tsx), so a test checks
 * where the application went by looking at the screen.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// findBy... and waitFor give up after 1 second by default. The first test in
// a file draws the whole application from cold while the other files run
// alongside it, and on a busy machine that can take longer than that.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
    cleanup();
});
