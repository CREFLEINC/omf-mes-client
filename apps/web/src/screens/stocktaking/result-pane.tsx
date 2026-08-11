import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { CountSummaryView, ResultView } from './types';

const t = messages.stocktaking;

export interface ResultPaneProps {
  result: ResultView;
}

interface ResultRow {
  key: string;
  label: string;
  value: string;
}

/** 갈래 하나가 내는 것 전부 — 라벨·짝 목록·안내·「조정 등록」 자리. */
interface ResultLayout {
  label: string;
  rows: ResultRow[];
  note: string;
  /**
   * **「조정 등록」 자리를 두는가.** 마감 갈래에만 참이다.
   *
   * 갈래 판정을 `toLayout` 한 곳에 묶어 두려고 `kind`가 아니라 이 값으로 받는다 —
   * 렌더에서 `kind`를 한 번 더 가르면 「어느 갈래에 무엇이 붙는가」가 두 자리로 흩어진다.
   */
  hasAdjustmentAction: boolean;
}

/**
 * 마감 시점의 요약 4칸을 짝 목록으로 옮긴다.
 *
 * **차례가 요약 구획과 같다** — 계획 · 카운트 · 미실사 · 차이. 갈리면 사용자가 위 구획에서
 * 보던 것과 결과에 박힌 것을 눈으로 맞춰 볼 수 없다.
 */
const toSummaryRows = (summary: CountSummaryView): ResultRow[] => [
  { key: 'plannedCount', label: t.detail.planned, value: t.detail.countValue(summary.plannedCount) },
  { key: 'countedCount', label: t.detail.counted, value: t.detail.countValue(summary.countedCount) },
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
        hasAdjustmentAction: false,
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
        hasAdjustmentAction: false,
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
        hasAdjustmentAction: true,
      };
  }
};

/**
 * 쓰기 결과 — **슬롯 하나에 갈래 하나만 보인다**(계획 결정 14).
 *
 * 이 화면에는 쓰기가 셋이고(개시 · 위치 저장 · 마감) 결과도 셋인데, 구획을 셋 두면 **셋이
 * 동시에 보이는 상태**가 생긴다. 「방금 개시했다」와 「방금 저장했다」가 나란히 서 있으면
 * 사용자는 무엇이 지금 일어난 일인지 가릴 수 없다 — 갈래를 타입이 정하고 새 결과가 앞
 * 결과를 덮는다. **라벨까지 갈리는 것**이 그 규칙의 실물이다. PR ④가 마감 갈래를 더한다.
 *
 * **내부 번호를 내지 않는다**(#44). 받는 타입에 자리 자체가 없어 이 부품에는 낼 값이 없다 —
 * `inventoryCountNo`는 사용자가 나중에 이 실사를 찾을 때 쓰는 **업무 번호**라 내는 것이 맞고,
 * 위치는 화면이 **이름으로 풀어** 넘긴다. 만들어진 실사의 내부 번호는 화면이 주소로만 쓴다.
 *
 * **성공을 단정하는 말을 쓰지 않는다.** 화면이 증거로 갖는 것은 응답이 준 값뿐이고,
 * 진행 요약은 위 구획이 상세 조회로 따로 받는다 — 그 사실을 안내가 밝힌다.
 *
 * **다른 화면으로 이동하지 않는다.** 만들어진 실사도 저장한 위치도 같은 화면에서 이어 다룬다.
 * 마감 갈래의 **「조정 등록」도 자리만 둔다**(착수 이슈 §5 ⚠ · 완료 조건 C58) — 재고 조정
 * 화면(W-01-12)이 이번에 나가지 않았고 승인 계약도 없다. 링크·`navigate`를 만들지 않으므로
 * **이동하는 경로가 코드에 없다**(감지기 M58).
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ResultPane = ({ result }: ResultPaneProps): ReactNode => {
  const layout = toLayout(result);
  /* 잠긴 컨트롤은 포커스를 받지 못한다 — 사유를 이어 두어야 읽힌다(배치 규범 4). */
  const reasonIdRoot = useId();
  const adjustmentReasonId = `${reasonIdRoot}-adjustment-reason`;

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
       * **비활성 표현에 `Chip`을 쓰지 않는다**(계획 §5.2). 설치본의 `StatusChipProps`에
       * `disabled`가 없어(실측) 비활성이 표현되지 않는다 — 걸릴 자리를 만들지 않는 것으로
       * 피한다. 이력 구획이 같은 형태를 먼저 썼다.
       */}
      {layout.hasAdjustmentAction && (
        <div className="field-cell">
          <Button variant="outlined" size="sm" disabled aria-describedby={adjustmentReasonId}>
            {t.actions.adjustment}
          </Button>
          <span id={adjustmentReasonId} className="field-note">
            {t.actionReasons.adjustmentPending}
          </span>
        </div>
      )}
    </div>
  );
};
