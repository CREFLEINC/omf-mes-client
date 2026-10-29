import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { Select } from '../select';

/**
 * C-8 페이지 이동 공용 부품. 목록 아래 한 줄: 왼쪽에 총 건수와 페이지 크기, 오른쪽에 [처음] [이전] n/N [다음] [마지막].
 * 비활성 버튼에는 사유를 붙이지 않는다(위치로 자명, C-8).
 */
const t = messages.screenPatterns.pageNav;

export const PAGE_SIZES = [20, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export interface PageNavMeta {
  page: number;
  size: number;
  total: number;
}

export interface PageNavProps<S extends number = PageSize> {
  meta: PageNavMeta;
  onChangePage: (page: number) => void;
  /** 주지 않으면 페이지 크기 선택을 그리지 않는다. */
  onChangeSize?: (size: S) => void;
  /** 고를 페이지 크기. 기본은 `PAGE_SIZES`(20 · 50 · 100). */
  sizes?: readonly S[];
  /** 처음 · 이전 · 다음 · 마지막 단추 크기. 기본 `sm` — 검사 기준 목록처럼 키워 쓸 화면이 켠다(#196). */
  buttonSize?: 'sm' | 'md';
}

export const totalPagesOf = (meta: PageNavMeta): number => {
  const size = Number.isSafeInteger(meta.size) && meta.size > 0 ? meta.size : 1;
  const total = Number.isSafeInteger(meta.total) && meta.total > 0 ? meta.total : 0;
  return Math.max(1, Math.ceil(total / size));
};

export const PageNav = <S extends number = PageSize>({
  meta,
  onChangePage,
  onChangeSize,
  sizes = PAGE_SIZES as unknown as readonly S[],
  buttonSize = 'sm',
}: PageNavProps<S>) => {
  const totalPages = totalPagesOf(meta);
  const page = Math.min(Math.max(1, meta.page), totalPages);

  return (
    <nav className="page-nav" aria-label={t.label}>
      <div className="page-nav-left">
        <span className="page-nav-total">{t.total(Math.max(0, meta.total))}</span>
        {onChangeSize !== undefined && (
          <Select
            aria-label={t.pageSize}
            size="sm"
            className="page-nav-size"
            value={String(meta.size)}
            options={sizes.map((size) => ({
              value: String(size),
              label: t.pageSizeOption(size),
            }))}
            onChange={(value) => {
              const size = sizes.find((option) => String(option) === value);
              if (size !== undefined) onChangeSize(size);
            }}
          />
        )}
      </div>
      <div className="page-nav-right">
        <Button
          size={buttonSize}
          variant="outlined"
          disabled={page <= 1}
          onClick={() => onChangePage(1)}
        >
          {t.first}
        </Button>
        <Button
          size={buttonSize}
          variant="outlined"
          disabled={page <= 1}
          onClick={() => onChangePage(page - 1)}
        >
          {t.prev}
        </Button>
        <span className="page-nav-position" aria-live="polite">
          {t.position(page, totalPages)}
        </span>
        <Button
          size={buttonSize}
          variant="outlined"
          disabled={page >= totalPages}
          onClick={() => onChangePage(page + 1)}
        >
          {t.next}
        </Button>
        <Button
          size={buttonSize}
          variant="outlined"
          disabled={page >= totalPages}
          onClick={() => onChangePage(totalPages)}
        >
          {t.last}
        </Button>
      </div>
    </nav>
  );
};
