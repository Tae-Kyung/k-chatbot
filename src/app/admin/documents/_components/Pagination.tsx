interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t px-6 py-3">
      <p className="text-xs text-gray-500">
        {total}개 중 {(page - 1) * limit + 1}-{Math.min(page * limit, total)}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
        >
          &laquo;
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
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
                onClick={() => onPageChange(item)}
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
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
        >
          &rsaquo;
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
        >
          &raquo;
        </button>
      </div>
    </div>
  );
}
