interface BulkActionBarProps {
  selectedCount: number;
  deleting: boolean;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

export function BulkActionBar({ selectedCount, deleting, onBulkDelete, onClearSelection }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 border-b bg-blue-50 px-6 py-2">
      <span className="text-xs text-blue-700">{selectedCount}개 선택됨</span>
      <button
        onClick={onBulkDelete}
        disabled={deleting}
        className="rounded bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
      >
        {deleting ? '삭제 중...' : '선택 삭제'}
      </button>
      <button
        onClick={onClearSelection}
        className="text-xs text-gray-500 hover:text-gray-700"
      >
        선택 해제
      </button>
    </div>
  );
}
