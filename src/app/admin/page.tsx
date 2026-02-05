'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface Stats {
  totalConversations: number;
  totalMessages: number;
  languageDistribution: Record<string, number>;
  feedbackStats: { total: number; positive: number; negative: number };
  period: number;
}

const LANG_COLORS: Record<string, string> = {
  ko: '#3B82F6',
  en: '#10B981',
  zh: '#F59E0B',
  vi: '#EF4444',
  mn: '#8B5CF6',
  km: '#EC4899',
};

const LANG_NAMES: Record<string, string> = {
  ko: '한국어',
  en: 'English',
  zh: '中文',
  vi: 'Tiếng Việt',
  mn: 'Монгол',
  km: 'ខ្មែរ',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [period, setPeriod] = useState('7');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/stats?period=${period}`);
        const data = await res.json();
        if (data.success) {
          setStats(data.data);
        }
      } catch {
        // Silently fail
      }
      setLoading(false);
    }
    fetchStats();
  }, [period]);

  const langData = stats
    ? Object.entries(stats.languageDistribution).map(([lang, count]) => ({
        name: LANG_NAMES[lang] || lang,
        value: count,
        color: LANG_COLORS[lang] || '#6B7280',
      }))
    : [];

  const feedbackData = stats
    ? [
        { name: '긍정', value: stats.feedbackStats.positive, color: '#10B981' },
        { name: '부정', value: stats.feedbackStats.negative, color: '#EF4444' },
        {
          name: '기타',
          value: Math.max(0, stats.feedbackStats.total - stats.feedbackStats.positive - stats.feedbackStats.negative),
          color: '#6B7280',
        },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">질문 통계</h2>
        <div className="flex gap-2">
          {['1', '7', '30'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p === '1' ? '오늘' : `${p}일`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <svg className="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : stats ? (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title="총 대화 수" value={stats.totalConversations} />
            <StatCard title="총 질문 수" value={stats.totalMessages} />
            <StatCard
              title="피드백 만족도"
              value={
                stats.feedbackStats.total > 0
                  ? `${Math.round((stats.feedbackStats.positive / stats.feedbackStats.total) * 100)}%`
                  : '-'
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-700">
                언어별 질문 비율
              </h3>
              {langData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={langData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="value"
                      label={(props) =>
                        `${props.name ?? ''} ${(((props.percent as number) ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      {langData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[250px] items-center justify-center text-sm text-gray-400">
                  데이터가 없습니다
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-semibold text-gray-700">
                피드백 분포
              </h3>
              {feedbackData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={feedbackData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value">
                      {feedbackData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[250px] items-center justify-center text-sm text-gray-400">
                  데이터가 없습니다
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="text-gray-500">통계를 불러올 수 없습니다.</p>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
