// Authentication helper functions
import { getSupabaseBrowserClient } from './supabase-client';
import type { Provider } from '@supabase/supabase-js';
import { getCallbackURL, getURL } from './url-helpers';

export interface SignUpData {
    email: string;
    password: string;
    fullName?: string;
}

export interface SignInData {
    email: string;
    password: string;
}

export async function signUp(data: SignUpData) {
    const supabase = getSupabaseBrowserClient();

    const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
            data: {
                full_name: data.fullName || '',
            },
        },
    });

    if (error) {
        throw error;
    }

    return authData;
}

export async function signIn(data: SignInData) {
    const supabase = getSupabaseBrowserClient();

    const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
    });

    if (error) {
        throw error;
    }

    return authData;
}

export async function signInWithProvider(provider: Provider) {
    const supabase = getSupabaseBrowserClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
            redirectTo: getCallbackURL(),
        },
    });

    if (error) {
        throw error;
    }

    return data;
}

export async function signOut() {
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
        throw error;
    }
}

export async function getCurrentUser() {
    const supabase = getSupabaseBrowserClient();

    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
        throw error;
    }

    return user;
}

export async function getSession() {
    const supabase = getSupabaseBrowserClient();

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
        throw error;
    }

    return session;
}

export async function resetPassword(email: string) {
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getURL()}auth/reset-password`,
    });

    if (error) {
        throw error;
    }
}

export async function updatePassword(newPassword: string) {
    const supabase = getSupabaseBrowserClient();

    const { error } = await supabase.auth.updateUser({
        password: newPassword,
    });

    if (error) {
        throw error;
    }
}
