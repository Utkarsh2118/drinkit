import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '../types.ts';
import { ProductCard } from './ProductCard.tsx';

interface ProductRailProps {
  id?: string;
  title: string;
  subtitle?: string;
  badge?: string;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onSeeAll?: () => void;
}

export const ProductRail: React.FC<ProductRailProps> = ({
  id,
  title,
  subtitle,
  badge,
  products,
  onSelectProduct,
  onSeeAll,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [products]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = Math.max(el.clientWidth * 0.75, 320);
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (!products || products.length === 0) {
    return null;
  }

  return (
    <section id={id} className="relative group/rail">
      {/* Section Header */}
      <div className="flex items-end justify-between mb-3 px-0.5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              {title}
            </h2>
            {badge && (
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onSeeAll && (
            <button
              onClick={onSeeAll}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-0.5 py-1 px-1.5 -mr-1.5 transition-colors"
            >
              <span>See all</span>
              <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>

      {/* Rail Container */}
      <div className="relative">
        {/* Desktop Left Navigation Button */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scroll('left')}
            aria-label={`Scroll ${title} left`}
            className="hidden md:flex absolute -left-3.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 shadow-md hover:bg-slate-50 hover:text-slate-900 items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}

        {/* Scrollable Track */}
        <div
          ref={scrollContainerRef}
          className="flex gap-2.5 sm:gap-3 md:gap-3.5 overflow-x-auto pb-2 pt-0.5 scrollbar-none snap-x snap-mandatory scroll-smooth -mx-3 px-3 sm:mx-0 sm:px-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {products.map(product => (
            <div
              key={product.id}
              className="w-[146px] xs:w-[158px] sm:w-[185px] md:w-[195px] lg:w-[205px] xl:w-[215px] shrink-0 snap-start flex flex-col"
            >
              <ProductCard product={product} onSelect={onSelectProduct} />
            </div>
          ))}
        </div>

        {/* Desktop Right Navigation Button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scroll('right')}
            aria-label={`Scroll ${title} right`}
            className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 shadow-md hover:bg-slate-50 hover:text-slate-900 items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}
      </div>
    </section>
  );
};
