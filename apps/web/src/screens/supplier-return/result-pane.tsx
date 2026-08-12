import { messages } from '@omf-mes/i18n';

import type { ReturnResultView } from './types';

const t = messages.supplierReturn;

/**
 * 결과가 보이는 줄 하나. **서버가 되돌려 준 줄을 화면이 이름으로 푼 것**이다.
 *
 * 이름 풀이를 이 부품이 하지 않는다 — 참조 여섯을 들고 있는 것은 화면이고, 여기서 다시 풀면
 * 같은 번호가 두 규칙으로 읽힐 수 있다. 줄을 가르는 것은 **표시 순번**이다(#44).
 */
export interface ResultLineSummary {
  ordinal: number;
  item: string;
  lot: string;
  /** 「30 SAMPLE-EA」 — 단위를 붙인 표기 그대로 */
  qty: string;
}

/**
 * ERP 송신 **적재** 여부의 세 갈래.
 *
 * **「적재」는 「전송」이 아니다**(계약이 못 박았다). 확정 직후 상대 시스템에서 조회하면 아직
 * 없을 수 있다 — 그래서 이 구획의 문구에 「전송 완료」라는 낱말이 없다.
 *
 * **셋인 이유는 계약이 이 필드를 선택으로 두었기 때문이다**(실측). 값이 오지 않는 경우가
 * 실재하므로 `?? true`로 접으면 **아무 근거 없이 「적재됐다」로 읽힌다.**
 */
type ErpQueueState = { kind: 'queued' } | { kind: 'notQueued' } | { kind: 'unknown' };

const describeErpQueue = (queued: boolean | null): ErpQueueState => {
  if (queued === null) return { kind: 'unknown' };

  return queued ? { kind: 'queued' } : { kind: 'notQueued' };
};

const erpQueueText = (state: ErpQueueState): string => {
  switch (state.kind) {
    case 'queued':
      return t.result.erpQueued;
    case 'notQueued':
      return t.result.erpNotQueued;
    case 'unknown':
      return t.result.erpUnknown;
  }
};

export interface ResultPaneProps {
  result: ReturnResultView;
  /** **`result.lines`를 이름으로 푼 것.** 화면이 센 줄이 아니라 서버가 준 배열에서 나온다 */
  lines: readonly ResultLineSummary[];
}

/**
 * 반품 처리 결과 — **화면이 확인한 것과 확인하지 않은 것을 가려 밝힌다**(계획 결정 13).
 *
 * 이 한 요청에 등록·전기·재고 차감·수불 원장·ERP 적재가 함께 걸려 있는데, **화면이 증거를
 * 갖는 것은 그중 일부뿐이다.** 나머지를 말하지 않으면 사용자가 「다 됐다」로 읽는다.
 *
 * | 무엇 | 이 구획이 하는 것 |
 * | --- | --- |
 * | ① 출고 전표 생성 | 반품 전표 번호를 낸다 — 나중에 이 전표를 찾을 때 쓰는 업무 번호다 |
 * | ② 전기 | **「요청을 함께 보냈다」까지만** 말한다. 목이 `postImmediately: true`에도 `DRAFT`를 되돌려 주는 것이 실측됐다 — 상태 코드로 「전기 완료」를 판정했다면 그 자리에서 거짓말을 한다 |
 * | ③ 재고 차감 | **확인하지 않는다는 사실**을 밝힌다. 응답에 수불·잔액 정보가 없다 |
 * | ④ 반품한 줄 | **서버가 되돌려 준 배열**을 그린다. 화면이 센 줄 수를 쓰지 않는다 |
 * | ⑤ ERP 송신 적재 | **세 갈래**로 가른다. 어느 갈래에도 「전송 완료」를 쓰지 않는다 |
 *
 * 한 트랜잭션이라 부분 실패가 없다(계약 문면) — 그래서 **건별 결과 UI를 그리지 않는다.**
 * 실패하면 이 구획이 아예 없고 배너 하나만 뜬다.
 *
 * **상태 코드를 값으로 분기하지 않는다**(공유계약 G-2) — 그대로 낸다. **상태 칩을 쓰지
 * 않는다**: 비활성 표현이 필요해지면 디자인 시스템의 갭에 걸린다(§5.2).
 *
 * **내부 번호를 내지 않는다**(#44). 받는 타입에 자리 자체가 없어 이 부품에는 낼 값이 없다.
 * `goodsIssueNo`는 사용자가 나중에 이 전표를 찾을 때 쓰는 업무 번호라 내는 것이 맞다.
 *
 * **성공 뒤 다른 화면으로 이동하지 않는다** — 이 저장소에 출고 전표를 볼 화면이 없다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ResultPane = ({ result, lines }: ResultPaneProps) => (
  /* 사용자가 부르지 않은 시점에 나타나는 내용이라 살아 있는 영역으로 알린다. */
  <div role="status" aria-label={t.result.label}>
    <p>{t.result.created}</p>

    <dl className="filter-bar">
      <div className="field-cell">
        <dt className="field-label">{t.result.goodsIssueNo}</dt>
        <dd>{result.goodsIssueNo}</dd>
      </div>
      <div className="field-cell">
        <dt className="field-label">{t.result.status}</dt>
        {/* 값으로 분기하지 않고 그대로 낸다 — 무슨 뜻인지는 화면이 판정하지 않는다. */}
        <dd>{result.statusCode}</dd>
      </div>
    </dl>

    <p className="field-note">{t.result.statusNote}</p>

    <p>{t.result.lines}</p>
    <p className="field-note">{t.result.linesNote}</p>
    <ul>
      {/*
       * `key`가 사실상 배열 인덱스다. **여기서는 그 규칙을 지나간다** — 줄이 순수 텍스트이고
       * 지역 상태가 없으며, 이 목록은 **서버 응답이 통째로 갈릴 때만** 바뀐다(제자리 재정렬이
       * 없다). 내부 번호를 키로 쓰지 않기 위한 것이며(#44) 받는 타입에 그 자리조차 없다.
       */}
      {lines.map((line) => (
        <li key={line.ordinal}>{t.result.linePair(line.item, line.lot, line.qty)}</li>
      ))}
    </ul>

    {/* ERP는 **적재**이지 전송이 아니다. 세 갈래가 서로 다른 문구를 갖는다. */}
    <p>{erpQueueText(describeErpQueue(result.erpMessageQueued))}</p>

    {/* 확인하지 않은 것을 밝힌다 — 말하지 않으면 「다 확인됐다」로 읽힌다. */}
    <p className="field-note">{t.result.notConfirmed}</p>
  </div>
);
