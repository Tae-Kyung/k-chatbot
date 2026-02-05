'use client';

import { useEffect, useState, useCallback } from 'react';

interface DocumentItem {
  id: string;
  file_name: string;
  file_type: string;
  storage_path: string | null;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [activeTab, setActiveTab] = useState<'file' | 'url' | 'qa'>('file');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const limit = 10;

  const fetchDocuments = useCallback(async (p?: number, q?: string) => {
    const currentPage = p ?? page;
    const currentSearch = q ?? search;
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(limit),
      });
      if (currentSearch) params.set('search', currentSearch);

      const res = await fetch(`/api/admin/documents?${params}`);
      const data = await res.json();
      if (data.success) {
        setDocuments(data.data.documents);
        setTotalPages(data.data.totalPages);
        setTotal(data.data.total);
      }
    } catch {
      // Silently fail
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setMessage(null);

    const total = files.length;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < total; i++) {
      const file = files[i];
      setUploadProgress(`(${i + 1}/${total}) ${file.name}`);

      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/admin/documents', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (data.success) {
          successCount++;
          // Trigger processing (don't await — process in background)
          fetch('/api/admin/documents/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: data.data.id }),
          });
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setPage(1);
    fetchDocuments(1);
    setUploadProgress('');

    if (failCount === 0) {
      setMessage({ type: 'success', text: `${successCount}개 파일이 업로드되었습니다. 처리를 시작합니다...` });
    } else {
      setMessage({ type: 'error', text: `성공 ${successCount}개, 실패 ${failCount}개` });
    }

    setUploading(false);
    e.target.value = '';
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    setUploading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'URL이 등록되었습니다.' });
        setUrlInput('');
        fetchDocuments();
      } else {
        setMessage({ type: 'error', text: data.error || 'URL 등록 실패' });
      }
    } catch {
      setMessage({ type: 'error', text: '등록 중 오류가 발생했습니다.' });
    }
    setUploading(false);
  };

  const handleQaSubmit = async () => {
    if (!qaQuestion.trim() || !qaAnswer.trim()) return;
    setUploading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: qaQuestion, answer: qaAnswer }),
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Q&A가 등록되었습니다.' });
        setQaQuestion('');
        setQaAnswer('');
        fetchDocuments();
      } else {
        setMessage({ type: 'error', text: data.error || 'Q&A 등록 실패' });
      }
    } catch {
      setMessage({ type: 'error', text: '등록 중 오류가 발생했습니다.' });
    }
    setUploading(false);
  };

  const handleReprocess = async (id: string) => {
    setMessage(null);
    try {
      const res = await fetch('/api/admin/documents/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: '재처리가 완료되었습니다.' });
      } else {
        setMessage({ type: 'error', text: data.error || '재처리 실패' });
      }
      fetchDocuments();
    } catch {
      setMessage({ type: 'error', text: '재처리 중 오류가 발생했습니다.' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/admin/documents/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchDocuments();
      }
    } catch {
      // Silently fail
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      processing: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    );
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">데이터 관리</h2>

      {message && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="mb-6 rounded-xl border bg-white p-6 shadow-sm">
        <div className="mb-4 flex gap-2">
          {(['file', 'url', 'qa'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab === 'file' ? '파일 업로드' : tab === 'url' ? 'URL 크롤링' : 'Q&A 등록'}
            </button>
          ))}
        </div>

        {activeTab === 'file' && (
          <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-gray-300 p-8">
            <p className="text-sm text-gray-500">PDF, HWP 파일을 업로드하세요 (최대 10MB, 여러 파일 선택 가능)</p>
            <label className="cursor-pointer rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700">
              {uploading ? '업로드 중...' : '파일 선택'}
              <input type="file" accept=".pdf,.hwp" multiple onChange={handleFileUpload} disabled={uploading} className="hidden" />
            </label>
            {uploading && uploadProgress && (
              <p className="text-xs text-gray-500">{uploadProgress}</p>
            )}
          </div>
        )}

        {activeTab === 'url' && (
          <div className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/page"
              className="flex-1 rounded-lg border bg-white px-4 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
            />
            <button
              onClick={handleUrlSubmit}
              disabled={uploading || !urlInput.trim()}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? '처리 중...' : '크롤링'}
            </button>
          </div>
        )}

        {activeTab === 'qa' && (
          <div className="space-y-3">
            <input
              value={qaQuestion}
              onChange={(e) => setQaQuestion(e.target.value)}
              placeholder="질문을 입력하세요"
              className="w-full rounded-lg border bg-white px-4 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
            />
            <textarea
              value={qaAnswer}
              onChange={(e) => setQaAnswer(e.target.value)}
              placeholder="답변을 입력하세요"
              rows={4}
              className="w-full resize-none rounded-lg border bg-white px-4 py-2 text-sm text-gray-900 outline-none focus:border-blue-500"
            />
            <button
              onClick={handleQaSubmit}
              disabled={uploading || !qaQuestion.trim() || !qaAnswer.trim()}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? '처리 중...' : 'Q&A 등록'}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-700">
            등록된 데이터 소스 {total > 0 && <span className="font-normal text-gray-400">({total})</span>}
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput);
              setPage(1);
              fetchDocuments(1, searchInput);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="파일명 검색..."
              className="w-48 rounded-lg border bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200"
            >
              검색
            </button>
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setSearch('');
                  setPage(1);
                  fetchDocuments(1, '');
                }}
                className="rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:text-gray-600"
              >
                초기화
              </button>
            )}
          </form>
        </div>
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <svg className="h-6 w-6 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400">
            등록된 데이터가 없습니다
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-6 py-3">파일명</th>
                  <th className="px-6 py-3">유형</th>
                  <th className="px-6 py-3">상태</th>
                  <th className="px-6 py-3">등록일</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="max-w-[200px] px-6 py-3 font-medium text-gray-800">
                      <div className="truncate">{doc.file_name}</div>
                      {doc.status === 'failed' && doc.metadata?.error ? (
                        <div className="mt-1 truncate text-xs text-red-500" title={String(doc.metadata.error)}>
                          {String(doc.metadata.error)}
                        </div>
                      ) : null}
                      {doc.status === 'completed' && doc.metadata?.chunk_count ? (
                        <div className="mt-1 text-xs text-gray-400">
                          {String(doc.metadata.chunk_count)}개 청크
                        </div>
                      ) : null}
                    </td>
                    <td className="px-6 py-3 text-gray-500">{doc.file_type}</td>
                    <td className="px-6 py-3">{statusBadge(doc.status)}</td>
                    <td className="px-6 py-3 text-gray-500">
                      {new Date(doc.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        {doc.status === 'failed' && (
                          <button
                            onClick={() => handleReprocess(doc.id)}
                            className="text-orange-500 hover:text-orange-700"
                          >
                            재처리
                          </button>
                        )}
                        {doc.storage_path && (
                          <a
                            href={`/api/admin/documents/${doc.id}/download`}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            다운로드
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-6 py-3">
            <p className="text-xs text-gray-500">
              {total}개 중 {(page - 1) * limit + 1}-{Math.min(page * limit, total)}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setPage(1); fetchDocuments(1); }}
                disabled={page === 1}
                className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                &laquo;
              </button>
              <button
                onClick={() => { const p = page - 1; setPage(p); fetchDocuments(p); }}
                disabled={page === 1}
                className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                &lsaquo;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | string)[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, i) =>
                  typeof item === 'string' ? (
                    <span key={`dot-${i}`} className="px-1 text-xs text-gray-300">...</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => { setPage(item); fetchDocuments(item); }}
                      className={`min-w-[28px] rounded px-2 py-1 text-xs ${
                        page === item
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {item}
                    </button>
                  ),
                )}
              <button
                onClick={() => { const p = page + 1; setPage(p); fetchDocuments(p); }}
                disabled={page === totalPages}
                className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                &rsaquo;
              </button>
              <button
                onClick={() => { setPage(totalPages); fetchDocuments(totalPages); }}
                disabled={page === totalPages}
                className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                &raquo;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
