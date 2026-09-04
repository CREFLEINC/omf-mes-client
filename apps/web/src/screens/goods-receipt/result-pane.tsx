import { Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { describeErpQueue, erpQueueText } from './erp-status';
import type { GoodsReceiptResultView } from './types';

const t = messages.goodsReceipt;

/**
 * 다시 읽은 자재 LOT 상태의 세 갈래.
 *
 * **받은 값으로 분기하지 않는다.** 여기서 가르는 것은 「아직 안 왔다 · 못 받았다 · 받았다」이지
 * 그 값이 무엇이냐가 아니다 — 상태 코드의 값 집합이 확정되지 않아(공유계약 G-2) 값으로
 * 판정하면 값이 정해질 때 조용히 틀린다.
 */
export type LotStatusState =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'known'; statusCode: string };

export interface ResultPaneProps {
  result: GoodsReceiptResultView;
  /**
   * 원천 입하 전표의 **입하번호**. 응답이 주는 원천 식별자는 내부 번호라 낼 수 없다(#44) —
   * 성공해도 고른 전표를 유지하므로 그 번호가 화면에 그대로 있다.
   */
  sourceInboundReceiptNo: string;
  lotStatus: LotStatusState;
}

/**
 * 수불 원장이 만들어졌는가 — **유무만 낸다.**
 *
 * 원장 라인 번호는 내부 번호라 낼 것이 아니다(#44). 「몇 줄 중 몇 줄」도 내지 않는다 —
 * 이번 화면은 한 줄만 확정하므로 숫자가 뜻을 더하지 않고, 라인이 늘면 문구가 갈린다.
 */
const ledgerText = (result: GoodsReceiptResultView): string => {
  /*
   * **「하나도 없다」가 먼저다.** 라인이 0줄인 경우도 여기서 함께 걸린다 —
   * `ledgerLineCount`는 `lineCount`를 넘을 수 없으므로(만드는 자리가 라인을 세어 만든다)
   * 라인이 0이면 원장도 0이다. 두 조건을 따로 두면 하나가 늘 같은 답을 내는 죽은 가지가 된다.
   */
  if (result.ledgerLineCount === 0) return t.result.ledgerNone;
  if (result.ledgerLineCount === result.lineCount) return t.result.ledgerAll;

  return t.result.ledgerSome;
};

const lotStatusValue = (state: LotStatusState): ReactNode => {
  switch (state.kind) {
    case 'loading':
      return t.result.lotStatusLoading;
    case 'failed':
      return t.result.lotStatusFailed;
    case 'known':
      /* 값으로 분기하지 않고 그대로 낸다(공유계약 G-2). */
      return (
        <Chip variant="status" size="sm">
          {state.statusCode}
        </Chip>
      );
  }
};

/**
 * 입고 처리 결과 — **확인한 것과 확인하지 않은 것을 가려 밝힌다.**
 *
 * 확정 한 번에 다섯 가지가 함께 움직이는데(입고 전표 생성·전기 · 자재 LOT 상태 전이 ·
 * 수불 원장 · 잔액 · ERP 송신 적재) **화면이 증거를 갖는 것은 그중 일부뿐이다.**
 * 나머지를 말하지 않으면 사용자가 「다 됐다」로 읽는다.
 *
 * | 무엇 | 이 구획이 하는 것 |
 * | --- | --- |
 * | ① 입고 전표 생성·전기 | 입고번호와 상태 코드를 **그대로** 낸다 |
 * | ② 자재 LOT 상태 전이 | 응답에 없어 **다시 조회한 값**을 그대로 낸다. 화면 이름의 「Release」를 값으로 확인하는 유일한 자리다 |
 * | ③ 수불 원장 | **유무만** 낸다. 번호는 내부 번호라 내지 않는다 |
 * | ④ 잔액 | **확인하지 않는다는 사실**을 밝힌다 |
 * | ⑤ ERP 송신 적재 | **세 갈래**로 가른다. 어느 갈래에도 「전송 완료」를 쓰지 않는다 |
 *
 * ①~④는 한 트랜잭션이라 부분 실패가 없다 — 그래서 **건별 결과 UI를 그리지 않는다.**
 * 실패하면 이 구획이 아예 없고 배너 하나만 뜬다.
 *
 * **내부 번호를 내지 않는다**(#44). 받는 타입(`GoodsReceiptResultView`)에 자리 자체가 없어
 * 이 부품에는 낼 값이 없다. `goodsReceiptNo`는 사용자가 나중에 이 전표를 찾을 때 쓰는
 * 업무 번호라 내는 것이 맞다.
 *
 * **성공 뒤 다른 화면으로 이동하지 않는다** — 이 저장소에 입고 전표를 볼 화면이 없다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ResultPane = ({ result, sourceInboundReceiptNo, lotStatus }: ResultPaneProps) => {
  const reasonId = `${useId()}-source-document`;

  return (
    /* 사용자가 부르지 않은 시점에 나타나는 내용이라 살아 있는 영역으로 알린다. */
    <div role="status" aria-label={t.result.label}>
      <dl className="filter-bar">
        <div className="field-cell">
          <dt className="field-label">{t.result.receiptNo}</dt>
          <dd>{result.goodsReceiptNo}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.result.status}</dt>
          <dd>
            {/* 상태 코드는 값으로 분기하지 않고 그대로 보인다(공유계약 G-2). */}
            <Chip variant="status" size="sm">
              {result.statusCode}
            </Chip>
          </dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.result.lotStatus}</dt>
          <dd>{lotStatusValue(lotStatus)}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.result.sourceDocument}</dt>
          <dd>
            {/* 원천 유형이 비어 오면 지어내지 않고 입하번호만 보인다 — 이 화면은 늘 채워 보내므로 실제로는 오지 않는 갈래다. */}
            {result.sourceDocumentTypeCode === null
              ? sourceInboundReceiptNo
              : t.result.sourceDocumentPair(result.sourceDocumentTypeCode, sourceInboundReceiptNo)}
          </dd>
        </div>
      </dl>

      <p className="field-note">{t.result.lotStatusNote}</p>

      <p>{ledgerText(result)}</p>

      {/* ERP는 **적재**이지 전송이 아니다. 세 갈래가 서로 다른 문구를 갖는다(이슈 §6의 ⭐). */}
      <p>{erpQueueText(describeErpQueue(result.erpMessageQueued))}</p>

      {/* 확인하지 않은 것을 밝힌다 — 말하지 않으면 「다 확인됐다」로 읽힌다. */}
      <p className="field-note">{t.result.balanceNote}</p>

      {/*
       * 원천 문서로 넘어갈 수단이 아직 없다 — 유형 코드와 대상의 대응 규약이 정해지지 않았다.
       * **감추지 않고 비활성으로 두고 사유를 잇는다**(배치 규범 4-1). 감추면 왜 못 가는지
       * 화면 어디에서도 읽을 수 없고, 링크로 두면 없는 화면으로 가는 경로가 생긴다.
       */}
      <div className="field-cell">
        <Button variant="outlined" size="sm" disabled aria-describedby={reasonId}>
          {t.actions.viewSourceDocument}
        </Button>
        <span id={reasonId} className="field-note">
          {t.actionReasons.sourceDocumentUnavailable}
        </span>
      </div>
    </div>
  );
};
