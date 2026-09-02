import { messages } from '@omf-mes/i18n';

export interface PageMeta {
  page: number;
  size: number;
  total: number;
}

export interface PageView {
  page: number;
  canPrev: boolean;
  canNext: boolean;
  /** 마지막 쪽을 지나쳐 있는가 — 조건이 좁아졌는데 쪽 번호가 주소에 남은 경우다. */
  isBeyondLast: boolean;
  rangeLabel: string;
}

const t = messages.workOrderProgress.page;

/**
 * 쪽 이동의 경계 동작을 한 곳에 모은다.
 *
 * DS 에 쪽 이동 전용 부품이 없어 조합으로 만든다(design-system-v2-webui#72). 경계 판정을
 * 여기 모아 두지 않으면 **버튼과 안내가 서로 다른 계산을 하게 된다** — 「다음」이 눌리는데
 * 「128건 중 101–150」처럼 없는 자리를 가리키는 식이다.
 *
 * ⛔ **서버가 준 수만 쓴다.** 전체 건수는 응답의 것이고, 지금 보이는 줄 수는 화면이 받은
 * 배열의 길이다 — 둘을 섞어 추정하지 않는다.
 */
export const toPageView = (meta: PageMeta, shown: number): PageView => {
  /* 0이나 음수가 오면 나눗셈이 무너진다 — 계약이 보장하는 값이지만 화면이 방어한다. */
  const size = meta.size > 0 ? meta.size : 1;
  const page = meta.page > 0 ? meta.page : 1;
  const totalPages = Math.ceil(meta.total / size);
  const start = (page - 1) * size + 1;

  return {
    page,
    canPrev: page > 1,
    canNext: page < totalPages,
    isBeyondLast: meta.total > 0 && page > totalPages,
    rangeLabel: shown === 0 ? t.total(meta.total) : t.range(start, start + shown - 1, meta.total),
  };
};
