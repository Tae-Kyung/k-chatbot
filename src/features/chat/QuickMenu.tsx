'use client';

interface QuickMenuProps {
  onSelect: (category: string) => void;
  labels: {
    visa: string;
    academic: string;
    career: string;
  };
}

export function QuickMenu({ onSelect, labels }: QuickMenuProps) {
  const categories = [
    { id: 'visa', label: labels.visa, icon: '📋' },
    { id: 'academic', label: labels.academic, icon: '🎓' },
    { id: 'career', label: labels.career, icon: '💼' },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-2">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-[var(--color-primary,#0066CC)] hover:text-[var(--color-primary,#0066CC)]"
        >
          <span>{cat.icon}</span>
          {cat.label}
        </button>
      ))}
    </div>
  );
}
