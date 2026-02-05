import { createClient } from '@/lib/supabase/server';
import { errorResponse } from '@/lib/api/response';
import type { AdminProfile } from '@/types/database';

export async function requireAdmin(): Promise<{
  user: { id: string; email: string };
  profile: AdminProfile;
} | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('admin_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return null;
  }

  return {
    user: { id: user.id, email: user.email! },
    profile,
  };
}

export function unauthorizedResponse() {
  return errorResponse('Unauthorized', 401);
}
