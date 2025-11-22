import { getSupabaseServerClient } from '@/app/lib/supabase-server';
import { getURL } from '@/app/lib/url-helpers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    if (code) {
        const supabase = await getSupabaseServerClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Use getURL() to get the correct base URL for the environment
            const baseUrl = getURL().replace(/\/$/, ''); // Remove trailing slash
            return NextResponse.redirect(`${baseUrl}${next}`);
        }
    }

    // Return the user to an error page with some instructions
    const baseUrl = getURL().replace(/\/$/, ''); // Remove trailing slash
    return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
}
