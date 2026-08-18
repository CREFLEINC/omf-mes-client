import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { PageMeta } from './types';

const t = messages.stockAdjust;

/**
 * 쪽 계산 — 「지금 어디를 보고 있는가」와 「어디로 갈 수 있는가」.
 *
 * **서버가 준 `page`를 정본으로 쓴다.** 주소의 쪽 번호를 쓰면 서버가 다른 쪽을 돌려줬을 때
 * 표시와 내용이 어긋난다.
 *
 * **상세의 라인 표에는 쪽이 없다.** 계약의 조정 상세가 라인을 전건으로 주고 쪽 정보를 싣지
 * 않는다(실측) — 이 계산은 이력 목록 표만 다룬다.
 */
export interface PageView {
  /** 1부터 센 현재 쪽 */
  page: number;
  totalPages: number;
  /** 「51–100 / 전체 120건」 */
  rangeLabel: string;
  canPrev: boolean;
  canNext: boolean;
  /** 결과가 있는데 이 쪽에는 없다 — 주소 조작·조건 변경으로 생긴다. 빈 상태의 안내가 갈린다 */
  isBeyondLast: boolean;
}

export const toPageView = (meta: PageMeta, shown: number): PageView => {
  /* 서버가 0을 주면 나눗셈이 무한대가 된다. 계산이 깨지지 않게 하한을 둔다. */
  const size = meta.size > 0 ? meta.size : 1;
  const page = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / size);

  const start = (page - 1) * size + 1;

  return {
    page,
    totalPages,
    /* 보이는 것이 없으면 범위를 지어내지 않는다. 전체 건수는 그대로 밝힌다. */
    rangeLabel:
      shown > 0
        ? t.pageNav.range(start, start + shown - 1, meta.total)
        : t.pageNav.totalOnly(meta.total),
    canPrev: page > 1,
    canNext: page < totalPages,
    isBeyondLast: meta.total > 0 && page > totalPages,
  };
};

export interface PageNavProps {
  view: PageView;
  /**
   * 잠겼는가. **쪽을 옮기면 고른 전표가 풀리므로**(조건이 바뀌는 것과 같은 자리) 나가는 중인
   * 쓰기가 있으면 잠근다 — 화면의 한 문(`applyUserNavigation`)이 둘째 겹으로 다시 막는다.
   */
  isLocked?: boolean;
  onChange: (page: number) => void;
}

/**
 * 쪽 이동 — 이전·다음과 지금 위치뿐이다.
 *
 * **쪽 번호 목록(1 2 3 … 10)을 만들지 않는다.** 생략 기호가 있는 번호 목록은 자기만의 생략
 * 규칙·현재 위치 표시·키보드 이동 규약을 갖는 별도의 부품이 되고, 지난 조정을 되찾는 데
 * 「7쪽으로 점프」는 정상 경로가 아니다 — 사유·실사·전기일로 좁히는 것이 정상 경로다.
 *
 * 배치는 이미 있는 「하단 액션 줄」을 그대로 쓴다. 새 클래스를 만들지 않는다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const PageNav = ({ view, isLocked = false, onChange }: PageNavProps) => (
  <nav className="form-actions" aria-label={t.pageNav.label}>
    <p className="field-note form-actions-secondary">{view.rangeLabel}</p>
    <Button
      variant="outlined"
      size="sm"
      disabled={!view.canPrev || isLocked}
      onClick={() => {
        onChange(view.page - 1);
      }}
    >
      {t.actions.prevPage}
    </Button>
    <Button
      variant="outlined"
      size="sm"
      disabled={!view.canNext || isLocked}
      onClick={() => {
        onChange(view.page + 1);
      }}
    >
      {t.actions.nextPage}
    </Button>
  </nav>
);
