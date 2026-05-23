'use client';

import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
} from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type CardData = {
  category: string;
  title: string;
  src: string;
  meta: string[];
  description: string;
  href: string;
  extra?: React.ReactNode;
};

type CarouselContextValue = {
  currentIndex: number;
};

const CarouselContext = createContext<CarouselContextValue>({ currentIndex: 0 });

export function Carousel({ items }: { items: JSX.Element[] }) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [currentIndex] = useState(0);

  const checkScrollability = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  const scrollLeftBy = () => carouselRef.current?.scrollBy({ left: -320, behavior: 'smooth' });
  const scrollRightBy = () => carouselRef.current?.scrollBy({ left: 320, behavior: 'smooth' });

  useEffect(() => {
    checkScrollability();
    const el = carouselRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScrollability, { passive: true });
    window.addEventListener('resize', checkScrollability);
    return () => {
      el.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [checkScrollability]);

  return (
    <CarouselContext.Provider value={{ currentIndex }}>
      <div className="relative w-full">
        <div
          ref={carouselRef}
          className="uk-no-scrollbar mx-auto flex w-full max-w-[920px] overflow-x-auto scroll-smooth py-6"
          style={{ scrollbarWidth: 'none' }}
        >
          <div className="flex w-max flex-row justify-start gap-4 px-4 md:px-6">
            {items.map((item, index) => (
              <motion.div
                key={'card' + index}
                initial={{ opacity: 0, y: 18 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.45, delay: 0.06 * index, ease: [0.23, 1, 0.32, 1] },
                }}
                className="rounded-3xl"
              >
                {item}
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-2 flex justify-center gap-2">
          <button
            type="button"
            onClick={scrollLeftBy}
            disabled={!canScrollLeft}
            aria-label="Nach links scrollen"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-ink-50 transition-colors duration-150 hover:border-white/15 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={scrollRightBy}
            disabled={!canScrollRight}
            aria-label="Nach rechts scrollen"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-ink-50 transition-colors duration-150 hover:border-white/15 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <style jsx global>{`
        .uk-no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </CarouselContext.Provider>
  );
}

export function Card({ card }: { card: CardData; index?: number }) {
  return (
    <Link
      href={card.href}
      className="group relative z-10 flex h-72 w-48 shrink-0 flex-col items-start justify-between overflow-hidden rounded-3xl border border-white/[0.06] text-left transition-colors duration-200 hover:border-white/[0.18] md:h-[28rem] md:w-64"
    >
      <div className="pointer-events-none absolute inset-0 z-30 bg-gradient-to-b from-black/25 via-transparent to-black/60 transition-opacity duration-200 group-hover:opacity-80" />

      <div className="relative z-40 w-full p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.4px] text-white/75">
          {card.category}
        </p>
        <p className="mt-1.5 text-[17px] font-medium leading-[1.15] tracking-[-0.2px] text-white [text-wrap:balance] md:text-[20px]">
          {card.title}
        </p>
      </div>

      <div className="relative z-40 w-full p-5">
        {card.meta.length > 0 && (
          <div className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {card.meta.map((m, i) => (
              <span
                key={i}
                className="font-mono text-[10px] uppercase tracking-[0.3px] text-white/55"
              >
                {i > 0 && <span className="mr-1.5 text-white/30">·</span>}
                {m}
              </span>
            ))}
          </div>
        )}
        <p className="line-clamp-3 text-[12.5px] leading-[1.45] text-white/70">
          {card.description}
        </p>
        {card.extra && <div className="mt-3">{card.extra}</div>}
      </div>

      <CardSurface src={card.src} />
    </Link>
  );
}

function CardSurface({ src }: { src: string }) {
  const isGradient = src.startsWith('linear-gradient') || src.startsWith('radial-gradient');
  if (isGradient) {
    return <div className="absolute inset-0 z-10 h-full w-full" style={{ background: src }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      className="absolute inset-0 z-10 h-full w-full object-cover"
    />
  );
}
