import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

/**
 * POP 목록의 쪽 넘김 — **[페이지 위] · [페이지 아래]**(공유계약 G-34).
 *
 * ## 왜 필요한가
 *
 * POP 목록들이 첫 20건만 받고 「N건 중 20건을 보이고 있습니다」라고 «알리기만» 했다. 넘길
 * 조작이 없어 **21번째부터는 고를 수 없었다** — 키오스크라 주소창도 뒤로가기도 없다.
 * 작업지시가 20건을 넘는 설비, 몰려서 발행되는 긴급 W/O 에서 실제로 걸린다(#1005).
 *
 * ⛔ **화면이 응답을 걸러서는 성립하지 않는다.** 목록이 쪽 단위라 «받은 쪽 안에서만» 걸러진다.
 *    조건도 쪽 번호도 서버에 실어야 한다.
 *
 * ⚠ **`production-result` 의 마감 LOT 팝업이 같은 것을 먼저 갖고 있다.** 그쪽은 자기 슬라이스
 *   안에서 돌고 있고 고장난 곳이 없어 건드리지 않았다 — 이 자리로 옮기는 것은 별건이다.
 */

const t = messages.popPageNav;

export interface PageBoundary {
  page: number;
  totalPages: number;
  canPageUp: boolean;
  canPageDown: boolean;
}

export interface PageMetaLike {
  page: number;
  size: number;
  total: number;
}

/**
 * 받은 쪽 정보로 넘길 수 있는지 판정한다.
 *
 * ⚠ **`size` 가 0 으로 와도 나누지 않는다** — 쪽 수가 무한이 되어 [페이지 아래]가 영영 열린다.
 */
export const pageBoundaryOf = (meta: PageMetaLike | undefined): PageBoundary => {
  if (meta === undefined) {
    return { page: 1, totalPages: 0, canPageUp: false, canPageDown: false };
  }

  const page = Math.max(1, meta.page);
  const totalPages = Math.ceil(meta.total / Math.max(1, meta.size));

  return { page, totalPages, canPageUp: page > 1, canPageDown: page < totalPages };
};

export interface PopPageNavProps {
  boundary: PageBoundary;
  /** 무엇의 쪽인지. 화면마다 다르므로 부르는 쪽이 준다(랜드마크 이름이 된다). */
  label: string;
  onChange: (page: number) => void;
}

/**
 * ⛔ **쪽이 하나뿐이면 세우지 않는다.** 누를 수 없는 단추 둘이 늘 서 있으면 화면만 좁아진다.
 */
export const PopPageNav = ({ boundary, label, onChange }: PopPageNavProps) => {
  if (boundary.totalPages <= 1) return null;

  return (
    <nav className="pop-page-nav" aria-label={label}>
      <Button
        variant="outlined"
        disabled={!boundary.canPageUp}
        onClick={() => {
          onChange(Math.max(1, boundary.page - 1));
        }}
      >
        {t.pageUp}
      </Button>
      <p className="field-note">{t.position(boundary.page, boundary.totalPages)}</p>
      <Button
        variant="outlined"
        disabled={!boundary.canPageDown}
        onClick={() => {
          onChange(boundary.page + 1);
        }}
      >
        {t.pageDown}
      </Button>
    </nav>
  );
};
