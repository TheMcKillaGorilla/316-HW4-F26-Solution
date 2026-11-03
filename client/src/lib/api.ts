/**
 * api.ts
 *
 * FACADE: the one door between the client and the server. The rest of the
 * application calls api.getList(id) and gets a ListDTO back. It never sees a
 * URL, an HTTP method, a status code, JSON parsing, a cookie or fetch itself.
 * If the API changes, this is the one file that changes with it.
 *
 * The return types come from the shared workspace, the same types the server's
 * DTO functions promise to produce.
 *
 * Vite forwards every /api request to the Express server (see vite.config.ts),
 * so these relative URLs work unchanged, and the browser sends the login
 * cookie along with each one by itself.
 */
import type { ErrorBody, ListDTO, ListMetadata, UserDTO } from '@wolfie-lists/shared';

/** thrown for anything that goes wrong talking to the server */
export class ApiError extends Error {
    constructor(message: string, public status: number | null = null) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * Called when the server says the login has run out (a 401 from anything but
 * the login form itself). SessionContext sets it to send the user to log in.
 */
let onUnauthorized: () => void = () => {};

export function setUnauthorizedHandler(handler: () => void) {
    onUnauthorized = handler;
}

/**
 * Requests go out one at a time, in the order they were made. Without this,
 * two quick edits send two PUTs that can arrive in either order, and the older
 * list could be the one saved. It also means opening a list always waits for
 * the last save of it to land.
 */
let queue: Promise<unknown> = Promise.resolve();

function request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const result = queue.then(() => send<T>(method, url, body));
    // the next request waits for this one whether it worked or not
    queue = result.catch(() => {});
    return result;
}

async function send<T>(method: string, url: string, body?: unknown): Promise<T> {
    // FormData (a file upload) goes as it is, and fetch sets its own Content-Type
    const isForm = body instanceof FormData;
    let response: Response;
    try {
        response = await fetch(url, {
            method,
            headers: body === undefined || isForm ? {} : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : isForm ? body : JSON.stringify(body)
        });
    } catch {
        // fetch only rejects when no answer came back at all
        throw new ApiError('The Wolfie Lists server could not be reached. Is it running?');
    }

    if (response.status === 204) return null as T;

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        if (response.status === 401 && !url.startsWith('/api/auth/')) onUnauthorized();
        const message = (data as ErrorBody | null)?.error ?? `The server answered ${response.status}.`;
        throw new ApiError(message, response.status);
    }
    return data as T;
}

// ----- accounts -----

export const register = (email: string, password: string) =>
    request<UserDTO>('POST', '/api/auth/register', { email, password });

export const login = (email: string, password: string) =>
    request<UserDTO>('POST', '/api/auth/login', { email, password });

export const logout = () => request<null>('POST', '/api/auth/logout');

export const getMe = () => request<UserDTO>('GET', '/api/users/me');

export const changePassword = (currentPassword: string, newPassword: string) =>
    request<null>('PUT', '/api/users/me/password', { currentPassword, newPassword });

export function uploadAvatar(file: File): Promise<UserDTO> {
    const form = new FormData();
    form.append('avatar', file);
    return request<UserDTO>('PUT', '/api/users/me/avatar', form);
}

// ----- lists -----

export const getAllMetadata = () => request<ListMetadata[]>('GET', '/api/lists');

export const getList = (id: string) => request<ListDTO>('GET', `/api/lists/${id}`);

/** @returns the new list's metadata */
export const createList = () => request<ListMetadata>('POST', '/api/lists');

/** @returns the saved list's new metadata */
export const saveList = ({ id, name, items }: ListDTO) =>
    request<ListMetadata>('PUT', `/api/lists/${id}`, { name, items });

/** @returns the copy's metadata */
export const duplicateList = (id: string) => request<ListMetadata>('POST', `/api/lists/${id}/duplicate`);

export const deleteList = (id: string) => request<null>('DELETE', `/api/lists/${id}`);
