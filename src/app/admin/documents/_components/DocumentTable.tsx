import { StatusBadge } from './StatusBadge';

export interface DocumentItem {
  id: string;
  file_name: string;
  file_type: string;
  storage_path: string | null;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface DocumentTableProps {
  documents: DocumentItem[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onReprocess: (id: string, withVision: boolean) => void;
  onDelete: (id: string) => void;
}

export function DocumentTable({
  documents,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onReprocess,
  onDelete,
}: DocumentTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={documents.length > 0 && selected.size === documents.length}
                onChange={onToggleSelectAll}
                className="h-3.5 w-3.5 rounded border-gray-300"
              />
            </th>
            <th className="px-6 py-3">파일명</th>
            <th className="px-6 py-3">유형</th>
            <th className="px-6 py-3">상태</th>
            <th className="px-6 py-3">등록일</th>
            <th className="px-6 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {documents.map((doc) => (
            <tr key={doc.id} className={`hover:bg-gray-50 ${selected.has(doc.id) ? 'bg-blue-50/50' : ''}`}>
              <td className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(doc.id)}
                  onChange={() => onToggleSelect(doc.id)}
                  className="h-3.5 w-3.5 rounded border-gray-300"
                />
              </td>
              <td className="max-w-[300px] px-6 py-3 font-medium text-gray-800">
                {doc.file_type === 'url' ? (
                  <div>
                    <div className="truncate">
                      <a
                        href={String(doc.metadata?.source_url || doc.file_name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                        title={String(doc.metadata?.source_url || doc.file_name)}
                      >
                        {doc.metadata?.page_title
                          ? String(doc.metadata.page_title)
                          : doc.file_name}
                      </a>
                    </div>
                    {doc.metadata?.page_title ? (
                      <div className="mt-0.5 truncate text-xs text-gray-400" title={doc.file_name}>
                        {doc.file_name}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="truncate">{doc.file_name}</div>
                )}
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
              <td className="px-6 py-3"><StatusBadge status={doc.status} /></td>
              <td className="px-6 py-3 text-gray-500">
                {new Date(doc.created_at).toLocaleDateString('ko-KR')}
              </td>
              <td className="px-6 py-3">
                <div className="flex items-center gap-3">
                  {(doc.status === 'failed' || doc.status === 'processing') && (
                    <>
                      <button
                        onClick={() => onReprocess(doc.id, false)}
                        className="text-orange-500 hover:text-orange-700"
                      >
                        재처리
                      </button>
                      {doc.file_type?.includes('pdf') && (
                        <button
                          onClick={() => onReprocess(doc.id, true)}
                          className="text-purple-500 hover:text-purple-700"
                          title="GPT-4 Vision으로 테이블 인식"
                        >
                          Vision
                        </button>
                      )}
                    </>
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
                    onClick={() => onDelete(doc.id)}
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
  );
}
