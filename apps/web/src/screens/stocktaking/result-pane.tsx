import { messages } from '@omf-mes/i18n';

import type { ResultView } from './types';

const t = messages.stocktaking;

export interface ResultPaneProps {
  result: ResultView;
}

/**
 * 쓰기 결과 — **슬롯 하나에 갈래 하나만 보인다**(계획 결정 14).
 *
 * 이 화면에는 쓰기가 셋이고(개시 · 위치 저장 · 마감) 결과도 셋인데, 구획을 셋 두면 **셋이
 * 동시에 보이는 상태**가 생긴다. 「방금 개시했다」와 「방금 마감했다」가 나란히 서 있으면
 * 사용자는 무엇이 지금 일어난 일인지 가릴 수 없다 — 갈래를 타입이 정하고 새 결과가 앞
 * 결과를 덮는다. **이 PR에는 개시 갈래뿐**이고 PR ③·④가 저장·마감 갈래를 더한다.
 *
 * **내부 번호를 내지 않는다**(#44). 받는 타입에 자리 자체가 없어 이 부품에는 낼 값이 없다 —
 * `inventoryCountNo`는 사용자가 나중에 이 실사를 찾을 때 쓰는 **업무 번호**라 내는 것이 맞다.
 * 만들어진 실사의 내부 번호는 화면이 주소(`ct`)로만 쓴다.
 *
 * **성공을 단정하는 말을 쓰지 않는다.** 화면이 증거로 갖는 것은 응답이 준 실사번호뿐이고,
 * 진행 요약은 아래 구획이 상세 조회로 따로 받는다 — 그 사실을 안내가 밝힌다.
 *
 * **다른 화면으로 이동하지 않는다.** 만들어진 실사는 같은 화면의 아래 구획에서 이어 다룬다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ResultPane = ({ result }: ResultPaneProps) => (
  /* 사용자가 부르지 않은 시점에 나타나는 내용이라 살아 있는 영역으로 알린다. */
  <div role="status" aria-label={t.result.label}>
    <dl className="filter-bar">
      <div className="field-cell">
        <dt className="field-label">{t.result.openedNo}</dt>
        <dd>{result.countNo}</dd>
      </div>
    </dl>

    <p className="field-note">{t.result.openedNote}</p>
  </div>
);
