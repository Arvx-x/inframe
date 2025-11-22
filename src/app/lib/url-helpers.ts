/**
 * Get the base URL for the current environment
 * Works in both client and server contexts
 */
export function getURL(): string {
    let url: string;

    // Server-side: use environment variables
    if (typeof window === 'undefined') {
        url =
            process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
            process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
            'http://localhost:3000';
    } else {
        // Client-side: use window.location or environment variables
        url =
            process?.env?.NEXT_PUBLIC_SITE_URL ?? // Set this to your site URL in production env.
            process?.env?.NEXT_PUBLIC_VERCEL_URL ?? // Automatically set by Vercel.
            window.location.origin;
    }

    // Make sure to include `https://` when not localhost.
    url = url.startsWith('http') ? url : `https://${url}`;

    // Make sure to include a trailing `/`.
    url = url.endsWith('/') ? url : `${url}/`;

    return url;
}

/**
 * Get the callback URL for OAuth redirects
 */
export function getCallbackURL(): string {
    return `${getURL()}auth/callback`;
}

