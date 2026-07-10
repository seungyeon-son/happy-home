import type { Notice } from './api';
import { SOURCE_LABELS } from './api';

function DdayBadge({ daysLeft }: { daysLeft: number | null }) {
  if (daysLeft === null) return null;
  const urgent = daysLeft <= 7;
  return (
    <span
      className={`text-[13px] font-bold tabular-nums tracking-tight ${
        urgent ? 'text-accent' : 'text-ink-soft'
      }`}
    >
      D{daysLeft === 0 ? '-DAY' : `-${daysLeft}`}
    </span>
  );
}

export function NoticeCard({ notice, featured = false }: { notice: Notice; featured?: boolean }) {
  return (
    <a
      href={notice.detailUrl}
      target="_blank"
      rel="noreferrer"
      className={`group flex flex-col justify-between border-t border-ink/80 pt-4 pb-8 transition-colors hover:border-accent ${
        featured ? 'md:col-span-8' : 'md:col-span-4'
      } col-span-12`}
    >
      <div>
        <div className="flex items-baseline gap-3">
          <span className="text-[11px] font-semibold tracking-[0.14em] text-ink-soft uppercase">
            {SOURCE_LABELS[notice.source] ?? notice.source}
          </span>
          <span className="text-[13px] font-medium text-ink">{notice.category}</span>
          {notice.isNew && (
            <span className="flex items-center gap-1 text-[11px] font-bold tracking-widest text-accent">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
              NEW
            </span>
          )}
          <span className="ml-auto">
            <DdayBadge daysLeft={notice.daysLeft} />
          </span>
        </div>

        <h3
          className={`mt-4 leading-snug font-semibold tracking-tight break-keep group-hover:text-accent transition-colors ${
            featured ? 'text-2xl md:text-[2rem] md:leading-tight max-w-[26ch]' : 'text-[17px]'
          }`}
        >
          {notice.title}
        </h3>
      </div>

      <div className="mt-6 flex items-baseline gap-2 text-[13px] text-ink-soft">
        <span className="font-medium text-ink">{notice.region}</span>
        <span aria-hidden>·</span>
        <span>{notice.postedAt.replaceAll('-', '.')} 게시</span>
        {notice.closesAt && (
          <>
            <span aria-hidden>→</span>
            <span>{notice.closesAt.replaceAll('-', '.')} 마감</span>
          </>
        )}
      </div>
    </a>
  );
}
