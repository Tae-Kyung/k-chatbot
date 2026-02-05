'use client';

import { useEffect, useState } from 'react';

interface ReviewItem {
  id: string;
  content: string;
  created_at: string;
  role: string;
  conversation_id: string;
  conversations: {
    university_id: string;
    language: string;
  };
  feedback: {
    id: string;
    rating: number;
    comment: string | null;
  }[];
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    async function fetchReviews() {
      try {
        const res = await fetch('/api/admin/reviews');
        const data = await res.json();
        if (data.success) {
          setReviews(data.data);
        }
      } catch {
        // Silently fail
      }
      setLoading(false);
    }
    fetchReviews();
  }, []);

  const handleEdit = (review: ReviewItem) => {
    setEditingId(review.id);
    setEditContent(review.content);
  };

  const handleSave = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      const data = await res.json();
      if (data.success) {
        setReviews((prev) =>
          prev.map((r) => (r.id === id ? { ...r, content: editContent } : r))
        );
        setEditingId(null);
      }
    } catch {
      // Silently fail
    }
  };

  const LANG_NAMES: Record<string, string> = {
    ko: '한국어', en: 'English', zh: '中文',
    vi: 'Tiếng Việt', mn: 'Монгол', km: 'ខ្មែរ',
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">답변 검증</h2>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <svg className="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-xl border bg-white text-sm text-gray-400">
          검증할 답변이 없습니다
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-xl border bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {LANG_NAMES[review.conversations?.language] || review.conversations?.language}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(review.created_at).toLocaleString('ko-KR')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {review.feedback.length > 0 && (
                    <span className={`text-xs ${review.feedback[0].rating >= 4 ? 'text-green-600' : 'text-red-600'}`}>
                      {review.feedback[0].rating >= 4 ? '👍' : '👎'} {review.feedback[0].rating}/5
                    </span>
                  )}
                  {editingId !== review.id && (
                    <button
                      onClick={() => handleEdit(review)}
                      className="rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50"
                    >
                      수정
                    </button>
                  )}
                </div>
              </div>

              {editingId === review.id ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={6}
                    className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:border-blue-500"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => handleSave(review.id)}
                      className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {review.content}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
