import React, { useState } from 'react';
import { ImageOff, RefreshCw } from 'lucide-react';

interface ProductImageProps {
  src?: string;
  alt: string;
  className?: string;
  categoryName?: string;
  isAlcoholic?: boolean;
  imageVerified?: boolean;
  imageStatus?: 'verified' | 'unverified' | 'missing' | 'broken' | 'VALID' | 'WRONG_IMAGE' | 'BROKEN_IMAGE' | 'MISSING_IMAGE' | 'UNVERIFIED';
}

export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-contain',
  categoryName = '',
  isAlcoholic = false,
  imageVerified = true,
  imageStatus,
}) => {
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const isMissing =
    !src ||
    src.trim() === '' ||
    imageStatus === 'missing' ||
    imageStatus === 'broken' ||
    imageStatus === 'MISSING_IMAGE' ||
    imageStatus === 'BROKEN_IMAGE' ||
    imageStatus === 'WRONG_IMAGE' ||
    imageVerified === false ||
    hasError;

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasError(false);
    setRetryCount(prev => prev + 1);
  };

  if (isMissing) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-slate-100/70 rounded-xl border border-slate-200/80 text-center select-none">
        <div className="w-9 h-9 rounded-xl bg-white/90 border border-slate-200/80 flex items-center justify-center text-slate-400 mb-2 shadow-xs">
          <ImageOff className="w-4 h-4 stroke-[1.75]" />
        </div>
        <span className="text-[11px] font-bold text-slate-600 leading-tight">
          Image unavailable
        </span>
        <span className="text-[9px] text-slate-400 font-semibold mt-0.5">
          Exact pack shot pending
        </span>
        {hasError && retryCount < 2 && src && (
          <button
            type="button"
            onClick={handleRetry}
            className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-md transition-colors"
          >
            <RefreshCw className="w-2.5 h-2.5" />
            <span>Retry</span>
          </button>
        )}
      </div>
    );
  }

  const effectiveSrc = retryCount > 0 ? `${src}${src.includes('?') ? '&' : '?'}retry=${retryCount}` : src;

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setHasError(true)}
    />
  );
};
