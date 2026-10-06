"use client";
/* eslint-disable @next/next/no-img-element -- plain images keep the block portable outside Next.js. */

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { AnimatePresence, LayoutGroup, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { motionTokens } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import { blogCategories, blogPosts } from "@/components/ui/blog-grid-data";
import type { BlogPost } from "@/components/ui/blog-grid-data";

export type { BlogAuthor, BlogPost } from "@/components/ui/blog-grid-data";

export interface BlogGridProps {
  title?: string;
  description?: string;
  posts?: BlogPost[];
  /** Category filter labels, in order. "All" is added in front. */
  categories?: string[];
  /** Active category, or "All" (controlled). */
  category?: string;
  defaultCategory?: string;
  onCategoryChange?: (category: string) => void;
  /** One based page (controlled). */
  page?: number;
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  /** Cards per page below the featured post. Defaults to 6. */
  pageSize?: number;
  /** Shows the newest post of the current filter as a large card on page one. Defaults to true. */
  showFeatured?: boolean;
  /** Link for each post. When set, cards render as links and the in-place reader is off. */
  getHref?: (post: BlogPost) => string;
  /** Called when a post opens, from a link or the in-place reader. */
  onPostOpen?: (post: BlogPost) => void;
  className?: string;
}

const smooth = motionTokens.spring.smooth;
const morph = motionTokens.spring.morph;
const standard = [...motionTokens.ease.standard] as [number, number, number, number];
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`));

/* The root is its own size container, so the grid folds by the space it has rather than the viewport. */
const s = {
  root: "@container/blog w-full min-w-0 bg-background font-body tracking-body text-foreground",
  inner: "relative mx-auto max-w-[1180px] px-6 py-16 @max-[681px]/blog:px-4 @max-[681px]/blog:py-12",
  index: "grid gap-8",
  header: "grid max-w-[600px] gap-3",
  title: "m-0 font-display text-[length:clamp(1.75rem,1rem_+_3cqi,var(--text-4xl))] leading-display font-medium tracking-display",
  description: "m-0 text-base leading-body text-pretty text-text-secondary",
  filters: "-mx-6 flex gap-[2px] overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden @max-[681px]/blog:-mx-4 @max-[681px]/blog:px-4",
  filter: "relative isolate h-9 flex-none cursor-pointer rounded-pill border-0 bg-transparent px-4 text-sm leading-body font-medium whitespace-nowrap [-webkit-tap-highlight-color:transparent] transition-colors duration-160 ease-standard motion-reduce:transition-none",
  filterHighlight: "absolute inset-0 -z-10 rounded-[inherit] bg-foreground",
  /* Page and pagination share one measured box, so a shorter filter or page closes its gap on a spring. It only clips while it moves. */
  clip: "min-w-0 data-[clip]:overflow-hidden",
  stack: "grid gap-8",
  page: "grid gap-12 @max-[681px]/blog:gap-10",
  grid: "grid grid-cols-3 gap-x-6 gap-y-12 @max-[901px]/blog:grid-cols-2 @max-[681px]/blog:gap-x-4 @max-[681px]/blog:gap-y-10 @max-[541px]/blog:grid-cols-1",
  card: "group/card grid content-start gap-4 rounded-[22px] text-inherit no-underline [-webkit-tap-highlight-color:transparent]",
  featured: "group/card grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] content-start items-center gap-10 rounded-[22px] text-inherit no-underline [-webkit-tap-highlight-color:transparent] @max-[901px]/blog:gap-6 @max-[681px]/blog:grid-cols-[minmax(0,1fr)] @max-[681px]/blog:gap-4",
  imageFrame: "relative overflow-hidden bg-surface-muted transition-transform duration-160 ease-standard group-active/card:scale-[.99] motion-reduce:transition-none",
  imageFrameCard: "aspect-[3/2] rounded-[20px]",
  imageFrameFeatured: "aspect-[16/10] rounded-[26px] @max-[681px]/blog:aspect-[3/2] @max-[681px]/blog:rounded-[20px]",
  image: "block size-full object-cover transition-transform duration-480 ease-standard pointer-fine:group-hover/card:scale-[1.03] motion-reduce:transition-none motion-reduce:pointer-fine:group-hover/card:transform-none",
  cardBody: "grid content-start gap-2",
  meta: "m-0 flex flex-wrap gap-[6px] text-xs leading-body text-text-muted [&>span:first-child]:font-medium [&>span:first-child]:text-foreground",
  cardTitle: "m-0 text-lg leading-[1.3] font-medium text-balance transition-colors duration-160 ease-standard pointer-fine:group-hover/card:text-text-secondary motion-reduce:transition-none",
  featuredTitle: "m-0 font-display text-[length:clamp(var(--text-2xl),1rem_+_2.2cqi,var(--text-3xl))] leading-display font-medium tracking-display text-balance",
  excerpt: "m-0 line-clamp-2 text-sm leading-[1.5] text-pretty text-text-secondary",
  excerptFeatured: "line-clamp-3 text-base",
  byline: "mt-2 flex min-w-0 items-center gap-2 text-sm leading-body",
  avatar: "size-6 flex-none rounded-full bg-surface-muted object-cover",
  authorName: "min-w-0 truncate",
  readTime: "flex-none text-text-muted before:mr-2 before:content-['·']",
  empty: "m-0 py-16 text-center text-text-secondary",
  pagination: "relative flex items-center justify-between gap-3 pt-6 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-border before:content-['']",
  pageNumbers: "flex gap-[2px]",
  pageButton: "relative isolate inline-flex h-9 min-w-9 cursor-pointer items-center justify-center gap-[6px] rounded-pill border-0 bg-transparent text-sm leading-body font-medium text-text-secondary tabular-nums [-webkit-tap-highlight-color:transparent] transition-[color,transform] [transition-duration:160ms,120ms] ease-standard pointer-fine:hover:not-disabled:text-foreground motion-reduce:transition-none",
  pageNumber: "p-0",
  pageStep: "px-3 disabled:cursor-default disabled:text-text-muted disabled:opacity-50 active:not-disabled:scale-[.97] @max-[541px]/blog:p-0 @max-[541px]/blog:[&>span]:hidden",
  pageHighlight: "absolute inset-0 -z-10 rounded-[inherit] bg-surface-muted",
  reader: "mx-auto grid max-w-[760px] gap-8",
  back: "-ml-2 inline-flex h-9 w-fit cursor-pointer items-center gap-[6px] rounded-pill border-0 bg-transparent py-0 pr-3 pl-2 text-sm leading-body font-medium text-text-secondary transition-[color,background-color] duration-160 ease-standard pointer-fine:hover:bg-surface-muted pointer-fine:hover:text-foreground motion-reduce:transition-none",
  readerHead: "grid gap-3",
  readerTitle: "m-0 font-display text-[length:clamp(var(--text-2xl),1rem_+_3.4cqi,var(--text-4xl))] leading-display font-medium tracking-display text-balance",
  readerImage: "aspect-video overflow-hidden rounded-[26px] bg-surface-muted",
  readerBody: "grid gap-5",
  readerP: "m-0 text-lg leading-[1.65] text-pretty text-text-secondary @max-[681px]/blog:text-base",
  lead: "m-0 text-[length:var(--text-xl)] leading-[1.5] text-pretty text-foreground @max-[681px]/blog:text-lg",
};

function useControllable<T>(value: T | undefined, initial: T, onChange?: (next: T) => void) {
  const [inner, setInner] = useState(initial);
  const current = value !== undefined ? value : inner;
  const set = (next: T) => { if (value === undefined) setInner(next); onChange?.(next); };
  return [current, set] as const;
}

/** Springs its height when the page or filter changes, so the pagination below glides instead of jumping. Other resizes (a late font, a narrower window) apply at once. */
function AutoHeight({ changeKey, reduced, className, children }: { changeKey: string; reduced: boolean; className?: string; children: ReactNode }) {
  const clipRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const height = useMotionValue<number | "auto">("auto");
  const lastKey = useRef(changeKey), armedUntil = useRef(0);
  useLayoutEffect(() => {
    if (lastKey.current === changeKey) return;
    lastKey.current = changeKey;
    armedUntil.current = performance.now() + 900;
  }, [changeKey]);
  useEffect(() => {
    const clip = clipRef.current, content = contentRef.current;
    if (!clip || !content || typeof ResizeObserver === "undefined") return;
    let controls: ReturnType<typeof animate> | undefined;
    const observer = new ResizeObserver(() => {
      const next = content.offsetHeight;
      controls?.stop();
      if (!next || reduced || height.get() === "auto" || performance.now() > armedUntil.current) { height.jump(next || "auto"); delete clip.dataset.clip; return; }
      clip.dataset.clip = "";
      controls = animate(height, next, { ...smooth, onComplete: () => { delete clip.dataset.clip; } });
    });
    observer.observe(content);
    return () => { observer.disconnect(); controls?.stop(); };
  }, [height, reduced]);
  return <motion.div ref={clipRef} className={s.clip} style={{ height }}>
    <div ref={contentRef} className={className}>{children}</div>
  </motion.div>;
}

function Meta({ post }: { post: BlogPost }) {
  return <p className={s.meta}><span>{post.category}</span><span aria-hidden="true">·</span><time dateTime={post.date}>{formatDate(post.date)}</time></p>;
}

function Byline({ post }: { post: BlogPost }) {
  return <div className={s.byline}>
    {post.author.avatar ? <img className={s.avatar} src={post.author.avatar} alt="" width={24} height={24} loading="lazy" /> : <span className={s.avatar} aria-hidden="true" />}
    <span className={s.authorName}>{post.author.name}</span>
    <span className={s.readTime}>{post.readTime} min read</span>
  </div>;
}

export function BlogGrid({
  title = "Journal",
  description = "Product news, design notes and engineering deep dives from the team.",
  posts = blogPosts,
  categories = blogCategories,
  category: categoryProp,
  defaultCategory = "All",
  onCategoryChange,
  page: pageProp,
  defaultPage = 1,
  onPageChange,
  pageSize = 6,
  showFeatured = true,
  getHref,
  onPostOpen,
  className,
}: BlogGridProps) {
  const reduced = useReducedMotion();
  const uid = useId();
  const rootRef = useRef<HTMLElement>(null);
  const [category, setCategoryState] = useControllable(categoryProp, defaultCategory, onCategoryChange);
  const [page, setPageState] = useControllable(pageProp, defaultPage, onPageChange);
  const [direction, setDirection] = useState(0);
  const [reading, setReading] = useState<BlogPost | null>(null);
  /** The post the reader just closed. Its image morphs back into its card while the rest of the index fades in around it. */
  const [returning, setReturning] = useState<string | null>(null);
  const lastOpened = useRef<string | null>(null);

  const sorted = [...posts].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = category === "All" ? sorted : sorted.filter(post => post.category === category);
  const featured = showFeatured && filtered.length > 1 ? (filtered.find(post => post.featured) ?? filtered[0]) : null;
  const rest = featured ? filtered.filter(post => post !== featured) : filtered;
  const pageCount = Math.max(1, Math.ceil(rest.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const pagePosts = rest.slice((safePage - 1) * pageSize, safePage * pageSize);

  function scrollToTop() {
    const node = rootRef.current;
    if (node && node.getBoundingClientRect().top < 0) node.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }
  function setCategory(next: string) {
    if (next === category) return;
    setDirection(0);
    setReturning(null);
    setCategoryState(next);
    setPageState(1);
  }
  function setPage(next: number) {
    if (next === safePage || next < 1 || next > pageCount) return;
    setDirection(next > safePage ? 1 : -1);
    setReturning(null);
    setPageState(next);
    scrollToTop();
  }
  function open(post: BlogPost, event: MouseEvent) {
    onPostOpen?.(post);
    if (getHref) return;
    event.preventDefault();
    lastOpened.current = post.id;
    setReading(post);
    scrollToTop();
  }
  function close() {
    setReturning(lastOpened.current);
    setReading(null);
    requestAnimationFrame(() => {
      const card = rootRef.current?.querySelector<HTMLElement>(`[data-post="${lastOpened.current}"]`);
      card?.focus({ preventScroll: true });
      card?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    });
  }

  const renderCard = (post: BlogPost, isFeatured = false) => {
    const href = getHref?.(post);
    const inner = <>
      {post.image && <motion.div layoutId={reduced ? undefined : `${uid}-image-${post.id}`} transition={morph} className={cn(s.imageFrame, isFeatured ? s.imageFrameFeatured : s.imageFrameCard)}>
        <img className={s.image} src={post.image.src} alt={post.image.alt} loading={isFeatured ? "eager" : "lazy"} />
      </motion.div>}
      <div className={cn(s.cardBody, isFeatured && "gap-3")}>
        <Meta post={post} />
        <h3 className={isFeatured ? s.featuredTitle : s.cardTitle}>{post.title}</h3>
        <p className={cn(s.excerpt, isFeatured && s.excerptFeatured)}>{post.excerpt}</p>
        <Byline post={post} />
      </div>
    </>;
    const className = isFeatured ? s.featured : s.card;
    const fades = returning !== null && (reduced || post.id !== returning);
    return <motion.a key={post.id} className={className} href={href ?? `#${post.id}`} data-post={post.id} onClick={event => open(post, event)} {...enterFade(fades)}>{inner}</motion.a>;
  };

  /** Fades a piece of the index or reader in on its own, so the shared image is never dimmed by a fading parent mid morph. */
  const enterFade = (on: boolean) => ({ initial: on ? { opacity: 0 } : false as const, animate: { opacity: 1 }, transition: { duration: motionTokens.duration.standard, ease: standard } });
  const back = returning !== null;
  const tabs = ["All", ...categories];
  const pageKey = `${category}-${safePage}`;

  return <section ref={rootRef} className={cn(s.root, className)} aria-label={title}>
    <LayoutGroup id={uid}>
      <div className={s.inner}>
        <AnimatePresence mode="popLayout" initial={false}>
          {reading ? <motion.article key="reader" className={s.reader} exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit, ease: standard } }} aria-labelledby={`${uid}-reader-title`}>
            <motion.button type="button" className={s.back} onClick={close} autoFocus {...enterFade(true)}><ArrowLeft size={16} aria-hidden="true" />All posts</motion.button>
            <motion.header className={s.readerHead} {...enterFade(true)}>
              <Meta post={reading} />
              <h2 id={`${uid}-reader-title`} className={s.readerTitle}>{reading.title}</h2>
              <Byline post={reading} />
            </motion.header>
            {reading.image && <motion.div layoutId={reduced ? undefined : `${uid}-image-${reading.id}`} className={s.readerImage} {...(reduced ? enterFade(true) : { transition: morph })}>
              <img className={s.image} src={reading.image.src} alt={reading.image.alt} />
            </motion.div>}
            <motion.div className={s.readerBody} initial={{ opacity: 0, y: reduced ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...smooth, delay: reduced ? 0 : .12 }}>
              <p className={s.lead}>{reading.excerpt}</p>
              {(reading.body ?? []).map(paragraph => <p key={paragraph} className={s.readerP}>{paragraph}</p>)}
            </motion.div>
          </motion.article> : <motion.div key="index" className={s.index} exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit, ease: standard } }}>
            <motion.header className={s.header} {...enterFade(back)}>
              <h2 className={s.title}>{title}</h2>
              {description && <p className={s.description}>{description}</p>}
            </motion.header>

            <motion.div className={s.filters} role="group" aria-label="Filter by category" {...enterFade(back)}>
              {tabs.map(tab => <button key={tab} type="button" className={cn(s.filter, tab === category ? "text-background" : "text-text-secondary pointer-fine:hover:text-foreground")} aria-pressed={tab === category} onClick={() => setCategory(tab)}>
                {tab === category && <motion.span layoutId={`${uid}-filter`} className={s.filterHighlight} transition={reduced ? { duration: 0 } : morph} />}
                <span>{tab}</span>
              </button>)}
            </motion.div>

            <AutoHeight changeKey={`${pageKey}-${pageCount}`} reduced={Boolean(reduced)} className={s.stack}>
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={pageKey}
                className={s.page}
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: direction * 24, y: direction ? 0 : 10 }}
                animate={{ opacity: 1, x: 0, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: direction * -24, transition: { duration: motionTokens.duration.exit, ease: standard } }}
                transition={{ ...smooth, opacity: { duration: motionTokens.duration.standard } }}
              >
                {featured && safePage === 1 && renderCard(featured, true)}
                {pagePosts.length > 0 && <div className={s.grid}>{pagePosts.map(post => renderCard(post))}</div>}
                {filtered.length === 0 && <p className={s.empty}>No posts in {category} yet.</p>}
              </motion.div>
            </AnimatePresence>

            <AnimatePresence initial={back}>
            {pageCount > 1 && <motion.nav key="pagination" className={s.pagination} aria-label="Pagination" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: motionTokens.duration.exit, ease: standard } }} transition={{ duration: motionTokens.duration.standard, ease: standard }}>
              <button type="button" className={cn(s.pageButton, s.pageStep)} onClick={() => setPage(safePage - 1)} disabled={safePage === 1} aria-label="Previous page"><ChevronLeft size={16} aria-hidden="true" /><span>Previous</span></button>
              <div className={s.pageNumbers}>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map(number => <button key={number} type="button" className={cn(s.pageButton, s.pageNumber, number === safePage && "text-foreground")} aria-current={number === safePage ? "page" : undefined} aria-label={`Page ${number}`} onClick={() => setPage(number)}>
                  {number === safePage && <motion.span layoutId={`${uid}-page`} className={s.pageHighlight} transition={reduced ? { duration: 0 } : morph} />}
                  <span>{number}</span>
                </button>)}
              </div>
              <button type="button" className={cn(s.pageButton, s.pageStep)} onClick={() => setPage(safePage + 1)} disabled={safePage === pageCount} aria-label="Next page"><span>Next</span><ChevronRight size={16} aria-hidden="true" /></button>
            </motion.nav>}
            </AnimatePresence>
            </AutoHeight>
          </motion.div>}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  </section>;
}

/** Preview: the blog index with the in-place reader. */
export function BlogGridBlock() {
  return <BlogGrid />;
}

export default BlogGridBlock;
