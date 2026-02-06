'use client';

import { useEffect, useState } from 'react';

interface RagSettings {
  embedding_model: string;
  top_k: number;
  match_threshold: number;
  rerank_enabled: boolean;
  hyde_enabled: boolean;
}

const DEFAULT_SETTINGS: RagSettings = {
  embedding_model: 'text-embedding-3-small',
  top_k: 5,
  match_threshold: 0.3,
  rerank_enabled: false,
  hyde_enabled: false,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<RagSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success && data.data) {
        setSettings({
          embedding_model: data.data.embedding_model ?? DEFAULT_SETTINGS.embedding_model,
          top_k: data.data.top_k ?? DEFAULT_SETTINGS.top_k,
          match_threshold: data.data.match_threshold ?? DEFAULT_SETTINGS.match_threshold,
          rerank_enabled: data.data.rerank_enabled ?? DEFAULT_SETTINGS.rerank_enabled,
          hyde_enabled: data.data.hyde_enabled ?? DEFAULT_SETTINGS.hyde_enabled,
        });
      }
    } catch {
      setMessage({ type: 'error', text: '설정을 불러오는데 실패했습니다.' });
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: '설정이 저장되었습니다.' });
      } else {
        setMessage({ type: 'error', text: data.error || '저장에 실패했습니다.' });
      }
    } catch {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="h-8 w-8 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">RAG 설정</h2>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-800">검색 파라미터</h3>

        <div className="space-y-6">
          {/* Embedding Model */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              임베딩 모델
            </label>
            <select
              value={settings.embedding_model}
              onChange={(e) => setSettings({ ...settings, embedding_model: e.target.value })}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="text-embedding-3-small">text-embedding-3-small (1536차원, 경제적)</option>
              <option value="text-embedding-3-large">text-embedding-3-large (3072차원, 고정밀)</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              문서 임베딩에 사용할 OpenAI 모델을 선택합니다. 모델 변경 시 기존 문서를 재처리해야 합니다.
            </p>
          </div>

          {/* Top-K */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Top-K (검색 결과 수)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={20}
                value={settings.top_k}
                onChange={(e) =>
                  setSettings({ ...settings, top_k: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) })
                }
                className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-500">1 ~ 20</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              질문에 대해 검색할 문서 청크의 최대 개수입니다. 값이 클수록 더 많은 컨텍스트를 제공하지만 응답이 느려질 수 있습니다.
            </p>
          </div>

          {/* Match Threshold */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              유사도 임계치 (Match Threshold)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.match_threshold}
                onChange={(e) =>
                  setSettings({ ...settings, match_threshold: parseFloat(e.target.value) })
                }
                className="w-64"
              />
              <span className="w-12 text-center text-sm font-mono text-gray-700">
                {settings.match_threshold.toFixed(2)}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              이 값 이상의 유사도를 가진 문서만 검색 결과에 포함됩니다. 높을수록 정확하지만 결과가 줄어들 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-800">고급 기능</h3>

        <div className="space-y-6">
          {/* HyDE */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="hyde"
              checked={settings.hyde_enabled}
              onChange={(e) => setSettings({ ...settings, hyde_enabled: e.target.checked })}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <label htmlFor="hyde" className="block text-sm font-medium text-gray-700">
                HyDE (Hypothetical Document Embeddings) 활성화
              </label>
              <p className="mt-1 text-xs text-gray-500">
                외국어 질문 시 한국어 가상 답변을 먼저 생성한 후, 그 답변의 임베딩으로 문서를 검색합니다.
                단순 번역보다 검색 정확도가 높지만 응답 시간이 약간 증가합니다.
              </p>
            </div>
          </div>

          {/* Reranker */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="rerank"
              checked={settings.rerank_enabled}
              disabled
              className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-400"
            />
            <div>
              <label htmlFor="rerank" className="block text-sm font-medium text-gray-400">
                리랭커 (Reranker) 활성화
              </label>
              <p className="mt-1 text-xs text-gray-400">
                추후 지원 예정 — 검색 결과를 LLM으로 재정렬하여 관련성을 높입니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {saving ? '저장 중...' : '설정 저장'}
        </button>
      </div>
    </div>
  );
}
