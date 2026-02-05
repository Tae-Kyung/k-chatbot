import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin, unauthorizedResponse } from '@/lib/auth/middleware';
import { successResponse, errorResponse } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth) return unauthorizedResponse();

    const supabase = await createServiceClient();
    const universityId = auth.profile.university_id;

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7'; // days
    const since = new Date();
    since.setDate(since.getDate() - parseInt(period));

    // Total conversations
    const { count: totalConversations } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('university_id', universityId)
      .gte('created_at', since.toISOString());

    // Total messages
    const { count: totalMessages } = await supabase
      .from('messages')
      .select('*, conversations!inner(*)', { count: 'exact', head: true })
      .eq('conversations.university_id', universityId)
      .eq('role', 'user')
      .gte('created_at', since.toISOString());

    // Language distribution
    const { data: langDist } = await supabase
      .from('conversations')
      .select('language')
      .eq('university_id', universityId)
      .gte('created_at', since.toISOString());

    const languageDistribution: Record<string, number> = {};
    langDist?.forEach((conv: { language: string }) => {
      languageDistribution[conv.language] =
        (languageDistribution[conv.language] || 0) + 1;
    });

    // Feedback stats
    const { data: feedbackData } = await supabase
      .from('feedback')
      .select('rating, messages!inner(conversation_id, conversations!inner(university_id))')
      .eq('messages.conversations.university_id', universityId)
      .gte('created_at', since.toISOString());

    const feedbackStats = {
      total: feedbackData?.length || 0,
      positive: feedbackData?.filter((f: { rating: number }) => f.rating >= 4).length || 0,
      negative: feedbackData?.filter((f: { rating: number }) => f.rating <= 2).length || 0,
    };

    return successResponse({
      totalConversations: totalConversations || 0,
      totalMessages: totalMessages || 0,
      languageDistribution,
      feedbackStats,
      period: parseInt(period),
    });
  } catch {
    return errorResponse('Internal server error', 500);
  }
}
