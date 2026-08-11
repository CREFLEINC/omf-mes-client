import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { ResultView } from './types';

const t = messages.stocktaking;

export interface ResultPaneProps {
  result: ResultView;
}

interface ResultRow {
  key: string;
  label: string;
  value: string;
}

/** 갈래 하나가 내는 것 전부 — 라벨·짝 목록·안내. */
interface ResultLayout {
  label: string;
  rows: ResultRow[];
  note: string;
}

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
    </div>
  );
};
