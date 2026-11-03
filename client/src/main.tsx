/**
 * main.tsx
 *
 * The entry point. BrowserRouter keeps the page in step with the address bar,
 * so every page has a URL of its own that can be bookmarked, reloaded, and
 * reached with Back and Forward.
 *
 * StrictMode runs every effect twice in development, to make effects that are
 * not safe to run twice fail early. It does nothing in a production build.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import './css/wolfie_lists.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>
);
