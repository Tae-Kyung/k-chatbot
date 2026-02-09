'use client';

import { useEffect, useState, useCallback } from 'react';
import { ADMIN_POLLING_INTERVAL_MS } from '@/config/constants';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { DocumentUploadPanel } from './_components/DocumentUploadPanel';
import { DocumentTable, type DocumentItem } from './_components/DocumentTable';
import { BulkActionBar } from './_components/BulkActionBar';
import { Pagination } from './_components/Pagination';

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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [useVision, setUseVision] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'file' | 'url' | 'qa'>('all');
  const limit = 10;

  const fetchDocuments = useCallback(async (p?: number, q?: string, t?: string) => {
    const currentPage = p ?? page;
    const currentSearch = q ?? search;
    const currentType = t ?? typeFilter;
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(limit),
      });
      if (currentSearch) params.set('search', currentSearch);
      if (currentType && currentType !== 'all') params.set('type', currentType);

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
  }, [page, search, typeFilter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Poll for status updates while any document is pending or processing
  useEffect(() => {
    const hasInProgress = documents.some(
      (d) => d.status === 'pending' || d.status === 'processing'
    );
    if (!hasInProgress) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, ADMIN_POLLING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

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
          fetch('/api/admin/documents/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: data.data.id, useVision }),
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
    const urls = urlInput.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
    if (urls.length === 0) return;

    const invalidUrls = urls.filter((u) => {
      try { new URL(u); return false; } catch { return true; }
    });
    if (invalidUrls.length > 0) {
      setMessage({ type: 'error', text: `잘못된 URL 형식: ${invalidUrls[0]}` });
      return;
    }

    setUploading(true);
    setMessage(null);
    setUploadProgress('');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < urls.length; i++) {
      setUploadProgress(`(${i + 1}/${urls.length}) ${urls[i]}`);
      try {
        const res = await fetch('/api/admin/crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urls[i] }),
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
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

    setUploadProgress('');
    setUrlInput('');
    setPage(1);
    fetchDocuments(1);

    if (failCount === 0) {
      setMessage({ type: 'success', text: `${successCount}개 URL이 등록되었습니다. 처리를 시작합니다...` });
    } else {
      setMessage({ type: 'error', text: `등록 성공 ${successCount}개, 실패 ${failCount}개` });
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

  const handleReprocess = async (id: string, withVision = false) => {
    setMessage(null);
    try {
      const res = await fetch('/api/admin/documents/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: id, useVision: withVision }),
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
        setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
        fetchDocuments();
      }
    } catch {
      // Silently fail
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}개 항목을 삭제하시겠습니까?`)) return;

    setDeleting(true);
    setMessage(null);
    let successCount = 0;
    let failCount = 0;

    for (const id of selected) {
      try {
        const res = await fetch(`/api/admin/documents/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    setSelected(new Set());
    setDeleting(false);
    fetchDocuments();

    if (failCount === 0) {
      setMessage({ type: 'success', text: `${successCount}개 항목이 삭제되었습니다.` });
    } else {
      setMessage({ type: 'error', text: `삭제 성공 ${successCount}개, 실패 ${failCount}개` });
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === documents.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(documents.map((d) => d.id)));
    }
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchDocuments(p);
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">데이터 관리</h2>

      {message && (
        <div className={`mb-4 rounded-lg p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <DocumentUploadPanel
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        uploading={uploading}
        uploadProgress={uploadProgress}
        useVision={useVision}
        setUseVision={setUseVision}
        urlInput={urlInput}
        setUrlInput={setUrlInput}
        qaQuestion={qaQuestion}
        setQaQuestion={setQaQuestion}
        qaAnswer={qaAnswer}
        setQaAnswer={setQaAnswer}
        onFileUpload={handleFileUpload}
        onUrlSubmit={handleUrlSubmit}
        onQaSubmit={handleQaSubmit}
      />

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-gray-700">
              등록된 데이터 소스 {total > 0 && <span className="font-normal text-gray-400">({total})</span>}
            </h3>
            <div className="flex rounded-lg border bg-gray-50 p-0.5">
              {([
                { key: 'all', label: '전체' },
                { key: 'file', label: '파일' },
                { key: 'url', label: 'URL' },
                { key: 'qa', label: 'Q&A' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setTypeFilter(key);
                    setPage(1);
                    setSelected(new Set());
                    fetchDocuments(1, undefined, key);
                  }}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    typeFilter === key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
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
            <button type="submit" className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200">
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

        <BulkActionBar
          selectedCount={selected.size}
          deleting={deleting}
          onBulkDelete={handleBulkDelete}
          onClearSelection={() => setSelected(new Set())}
        />

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <LoadingSpinner className="h-6 w-6" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-gray-400">
            등록된 데이터가 없습니다
          </div>
        ) : (
          <DocumentTable
            documents={documents}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onReprocess={handleReprocess}
            onDelete={handleDelete}
          />
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
