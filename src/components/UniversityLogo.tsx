'use client';

import { useState } from 'react';
import type { University } from '@/types/database';

interface UniversityLogoProps {
  university: University;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: { img: 'h-6 w-6', text: 'text-sm' },
  md: { img: 'h-8 w-8', text: 'text-lg' },
  lg: { img: 'h-12 w-12', text: 'text-2xl' },
};

export function UniversityLogo({ university, size = 'md' }: UniversityLogoProps) {
  const [imgError, setImgError] = useState(false);
  const s = SIZES[size];

  if (university.logo_url && !imgError) {
    return (
      <img
        src={university.logo_url}
        alt={university.name}
        className={`${s.img} object-contain`}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <span className={`${s.text} font-bold`} style={{ color: university.primary_color }}>
      {university.name_en.charAt(0)}
    </span>
  );
}
