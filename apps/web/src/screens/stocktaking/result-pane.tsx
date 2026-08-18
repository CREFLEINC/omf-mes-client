import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import type { CountSummaryView, ResultView } from './types';

const t = messages.stocktaking;

/**
 * 재고조정(W-01-12)으로 가는 주소.
 *
 * **질의 열쇠 `count`는 받는 쪽이 읽는 이름이다** — 그 화면은 진입 맥락을 주소에서만 읽으므로
 * (상태로 넘기면 새로고침·뒤로가기·공유에서 사라진다) 이 열쇠가 두 화면 사이의 계약이다.
 * 주소가 라우트 표에 실제로 있는지는 `routes/index.test.tsx`가 잇는다 — 한쪽만 고치면
 * 죽은 링크가 남는데, 이 슬라이스의 시험도 그쪽 화면의 시험도 그 어긋남을 보지 못한다.
 *
 * **내부 번호를 주소에 싣는 것은 표시가 아니다**(#44). 계약이 실사 차이를 내부 번호로 받으므로
 * 업무 번호(`inventoryCountNo`)로는 조회 경로를 만들 수 없다 — 사람이 읽는 자리에는 넣지 않는다.
 */
export const stockAdjustEntryPath = (inventoryCountId: number): string =>
  `/logistics/stock-adjust?count=${String(inventoryCountId)}`;

export interface ResultPaneProps {
  result: ResultView;
}

interface ResultRow {
  key: string;
  label: string;
  value: string;
}

/** 조정 등록으로 이어지는 자리 — **어느 실사를 몇 건 넘기는가**. */
interface AdjustmentEntry {
  /** 주소 전용이다(#44). 렌더 글자에는 쓰지 않는다 */
  inventoryCountId: number;
  varianceCount: number;
}

/** 갈래 하나가 내는 것 전부 — 라벨·짝 목록·안내·「조정 등록」 자리. */
interface ResultLayout {
  label: string;
  rows: ResultRow[];
  note: string;
  /**
   * **조정 등록으로 잇는가**, 이으면 무엇을 넘기는가. `null`이면 그 자리를 두지 않는다.
   *
   * 갈래 판정을 `toLayout` 한 곳에 묶어 두려고 `kind`가 아니라 이 값으로 받는다 —
   * 렌더에서 `kind`를 한 번 더 가르면 「어느 갈래에 무엇이 붙는가」가 두 자리로 흩어진다.
   * **`boolean`이 아니라 값을 담는 것**이 그 규율의 연장이다: 참·거짓만 넘기면 렌더가 주소를
   * 만들려고 `result`를 다시 갈라 봐야 한다.
   */
  adjustmentEntry: AdjustmentEntry | null;
}

/**
 * 마감 시점의 요약 4칸을 짝 목록으로 옮긴다.
 *
 * **차례가 요약 구획과 같다** — 계획 · 카운트 · 미실사 · 차이. 갈리면 사용자가 위 구획에서
 * 보던 것과 결과에 박힌 것을 눈으로 맞춰 볼 수 없다.
 */
const toSummaryRows = (summary: CountSummaryView): ResultRow[] => [
  {
    key: 'plannedCount',
    label: t.detail.planned,
    value: t.detail.countValue(summary.plannedCount),
  },
  {
    key: 'countedCount',
    label: t.detail.counted,
    value: t.detail.countValue(summary.countedCount),
  },
  {
    key: 'uncountedCount',
    label: t.detail.uncounted,
    value: t.detail.countValue(summary.uncountedCount),
  },
  {
    key: 'varianceCount',
    label: t.detail.variance,
    value: t.detail.countValue(summary.varianceCount),
  },
];

/**
 * 갈래를 화면에 낼 것으로 옮긴다. **`kind`로 가르는 유일한 자리**다 —
 * 여기저기서 가르면 한 갈래에만 붙은 문구가 다른 갈래에 새는 상태가 생긴다.
 */
const toLayout = (result: ResultView): ResultLayout => {
  switch (result.kind) {
    case 'opened':
      return {
        label: t.result.label,
        rows: [{ key: 'countNo', label: t.result.openedNo, value: result.countNo }],
        note: t.result.openedNote,
        adjustmentEntry: null,
      };
    case 'saved':
      return {
        label: t.result.savedLabel,
        rows: [
          { key: 'location', label: t.result.savedLocation, value: result.locationLabel },
          {
            key: 'lineCount',
            label: t.result.savedLineCount,
            /*
             * **서버가 되돌려 준 배열의 길이다** — 화면이 보낸 줄 수가 아니다.
             * 둘이 갈리면 그 자리가 「보낸 것과 저장된 것이 다르다」는 사실을 드러낸다.
             */
            value: t.result.savedCount(result.replacedLineCount),
          },
        ],
        note: t.result.savedNote,
        adjustmentEntry: null,
      };
    case 'closed':
      return {
        label: t.result.closedLabel,
        rows: [
          { key: 'countNo', label: t.result.closedNo, value: result.countNo },
          {
            key: 'statusCode',
            label: t.result.closedStatus,
            /*
             * **응답이 준 코드를 그대로 낸다**(공유계약 G-2 · 감지기 M59). 목 서버의 `:close`
             * 200 응답이 `IN_PROGRESS`를 되돌려 주는 것을 실측했다 — 값으로 「마감됨」을
             * 판정했다면 그 자리에서 거짓말을 한다.
             */
            value: result.statusCode,
          },
          ...toSummaryRows(result.summary),
        ],
        note: t.result.closedNote,
        /*
         * **차이가 남은 마감에만 잇는다**(D-18 · C47·C48). 차이가 0이면 조정할 것이 없어
         * 자리를 두지 않는다 — 길을 두면 사용자는 무엇을 조정하러 가는지 모른 채 화면을 연다.
         *
         * **판정 근거가 서버 값이다**(응답의 요약) — 화면이 「조정이 필요하다」를 추측하는 것이
         * 아니다. 이 화면의 마감 게이트는 차이 0을 요구하지만(`close-guard.ts`) 그것은
         * **상세 응답**으로 한 사전 판정이고, 여기 담기는 것은 **마감 응답이 준 요약**이라
         * 서버가 차이를 그대로 담아 주면 이 갈래가 선다(같은 응답의 상태 코드가 상세와 갈리는
         * 것을 이미 실측했다 — 감지기 M59).
         */
        adjustmentEntry:
          result.summary.varianceCount > 0
            ? {
                inventoryCountId: result.inventoryCountId,
                varianceCount: result.summary.varianceCount,
              }
            : null,
      };
  }
};

/**
 * 쓰기 결과 — **슬롯 하나에 갈래 하나만 보인다**(계획 결정 14).
 *
 * 이 화면에는 쓰기가 셋이고(개시 · 위치 저장 · 마감) 결과도 셋인데, 구획을 셋 두면 **셋이
 * 동시에 보이는 상태**가 생긴다. 「방금 개시했다」와 「방금 저장했다」가 나란히 서 있으면
 * 사용자는 무엇이 지금 일어난 일인지 가릴 수 없다 — 갈래를 타입이 정하고 새 결과가 앞
 * 결과를 덮는다. **라벨까지 갈리는 것**이 그 규칙의 실물이다.
 *
 * **내부 번호를 글자로 내지 않는다**(#44). `inventoryCountNo`는 사용자가 나중에 이 실사를 찾을
 * 때 쓰는 **업무 번호**라 내는 것이 맞고, 위치는 화면이 **이름으로 풀어** 넘긴다. 마감 갈래는
 * 이제 내부 번호를 받지만 **링크 주소에만** 싣는다 — 사람이 읽는 자리에는 넣지 않는다.
 *
 * **성공을 단정하는 말을 쓰지 않는다.** 화면이 증거로 갖는 것은 응답이 준 값뿐이고,
 * 진행 요약은 위 구획이 상세 조회로 따로 받는다 — 그 사실을 안내가 밝힌다.
 *
 * **이동은 마감 갈래의 「조정 등록」 하나뿐이다**(D-18). 만들어진 실사도 저장한 위치도 같은
 * 화면에서 이어 다루므로 앞 두 갈래에는 갈 곳이 없다. 그 하나도 **차이가 남은 마감에만** 서고
 * (차이 0이면 조정할 것이 없다) **버튼이 아니라 링크**다 — 주소를 갖는 이동이라 새 탭·주소
 * 복사가 그대로 되고, 히스토리가 한 칸만 늘어 뒤로가기 한 번으로 이 결과에 돌아온다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ResultPane = ({ result }: ResultPaneProps): ReactNode => {
  const layout = toLayout(result);

  return (
    /* 사용자가 부르지 않은 시점에 나타나는 내용이라 살아 있는 영역으로 알린다. */
    <div role="status" aria-label={layout.label}>
      <dl className="filter-bar">
        {layout.rows.map((row) => (
          <div className="field-cell" key={row.key}>
            <dt className="field-label">{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      <p className="field-note">{layout.note}</p>

      {/*
       * **이름-값 목록 밖에 둔다.** 이어서 하는 일은 이 마감이 **가진 값**이 아니라 그 결과로
       * 하는 일이라, `<dd>`로 넣으면 보조기술이 「차이: …」의 값으로 읽는다. 그래서 목록을 닫고
       * 자기 줄에 세운다(`.field-cell` — 위 `<dl>`의 칸과 같은 모양).
       *
       * **안내를 링크에 잇지 않는다.** 자리표시 시절에는 잠긴 버튼이 포커스를 받지 못해
       * `aria-describedby`로 사유를 이어야 했는데(배치 규범 4), 링크는 포커스를 받고 그
       * 이름(「조정 등록」)이 갈 곳을 그대로 말한다 — 건수 안내는 옆에 선 사실 문장이다.
       */}
      {layout.adjustmentEntry !== null && (
        <div className="field-cell">
          <Link to={stockAdjustEntryPath(layout.adjustmentEntry.inventoryCountId)}>
            {t.actions.adjustment}
          </Link>
          <span className="field-note">
            {t.result.adjustmentNote(layout.adjustmentEntry.varianceCount)}
          </span>
        </div>
      )}
    </div>
  );
};
