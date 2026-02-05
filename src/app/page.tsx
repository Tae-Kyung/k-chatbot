'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { University } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

function UniversityLogo({ uni }: { uni: University }) {
  const [imgError, setImgError] = useState(false);

  if (uni.logo_url && !imgError) {
    return (
      <img
        src={uni.logo_url}
        alt={uni.name}
        className="h-12 w-12 object-contain"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <span className="text-2xl font-bold" style={{ color: uni.primary_color }}>
      {uni.name_en.charAt(0)}
    </span>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUniversities() {
      const supabase = createClient();
      const { data } = await supabase
        .from('universities')
        .select('*')
        .order('name');
      setUniversities(data || []);
      setLoading(false);
    }
    fetchUniversities();
  }, []);

  const handleSelect = (universityId: string) => {
    router.push(`/chat/${universityId}`);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4">
      <div className="mb-12 text-center">
        <h1 className="mb-3 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          K-Student Success
        </h1>
        <h2 className="mb-2 text-xl font-medium text-blue-600 sm:text-2xl">
          AI Guide
        </h2>
        <p className="mx-auto max-w-md text-base text-gray-500">
          외국인 유학생을 위한 AI 상담 서비스
        </p>
        <p className="text-sm text-gray-400">
          AI Counseling Service for International Students
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400">
          <svg
            className="h-5 w-5 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading...
        </div>
      ) : (
        <div className="grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-3">
          {universities.map((uni) => (
            <button
              key={uni.id}
              onClick={() => handleSelect(uni.id)}
              className="group flex flex-col items-center gap-4 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${uni.primary_color}15` }}
              >
                <UniversityLogo uni={uni} />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold text-gray-800">
                  {uni.name}
                </p>
                <p className="mt-1 text-xs text-gray-400">{uni.name_en}</p>
              </div>
              <div
                className="h-1 w-12 rounded-full transition-all group-hover:w-16"
                style={{ backgroundColor: uni.primary_color }}
              />
            </button>
          ))}
        </div>
      )}

      <p className="mt-12 text-center text-xs text-gray-400">
        Powered by AI &middot; 6 Languages Supported
      </p>
    </div>
  );
}
