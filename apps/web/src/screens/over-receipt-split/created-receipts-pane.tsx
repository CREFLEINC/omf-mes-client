import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { CreatedReceiptView } from './types';

const t = messages.overReceiptSplit;

export interface CreatedReceiptsPaneProps {
  /** 만들어진 전표. 갈래에 따라 1건 또는 2건이다 */
  receipts: readonly CreatedReceiptView[];
}

/**
 * 등록 결과 — **만들어진 전표 번호**를 낸다.
 *
 * **건수를 함께 밝힌다.** 두 건이 만들어졌다는 것이 이 화면의 요점인데 번호만 나열하면
 * 두 줄이 한 전표의 두 표기처럼 읽힐 수 있다.
 *
 * **어느 건이 정량분이고 어느 건이 초과분인지 응답이 알려 주지 않는다.** 배열 순서로
 * 추측해 라벨을 붙이면 틀린 라벨이 되돌릴 수 없는 전표에 붙는다 — 모른다는 사실을 밝힌다.
 *
 * **내부 번호를 내지 않는다**(#44). 받는 타입(`CreatedReceiptView`)에 자리 자체가 없어
 * 이 부품에는 낼 값이 없다. `inboundReceiptNo`는 사용자가 나중에 이 전표를 찾을 때 쓰는
 * 업무 번호라 내는 것이 맞다 — 이 구분이 이 화면에서 처음 갈리는 자리다.
 *
 * **사라지는 알림으로 내지 않는다.** 이 번호는 적어 두거나 옮겨 적을 값이라
 * 몇 초 뒤에 없어지면 안 된다 — 저장 성공을 토스트로 내는 다른 화면과 갈리는 자리다.
 */
export const CreatedReceiptsPane = ({ receipts }: CreatedReceiptsPaneProps) => (
  /* 사용자가 부르지 않은 시점에 나타나는 내용이라 살아 있는 영역으로 알린다. */
  <div role="status" aria-label={t.panes.result}>
    <p>{t.result.count(receipts.length)}</p>

    {/*
     * **이름 하나에 값 하나로 짝을 맞춘다.** `<dt>` 하나 뒤의 `<dd>`는 전부 그 이름의 값이라,
     * 상태 칩을 전표번호 아래에 그대로 두면 보조기술이 「전표번호: IR-…, SAMPLE_…」로 읽는다 —
     * 이름 없는 값이 아니라 **틀린 이름이 붙은 값**이 된다.
     */}
    <dl className="filter-bar">
      {receipts.map((created) => (
        <div className="field-cell" key={created.inboundReceiptNo}>
          <dt className="field-label">{t.result.receiptNo}</dt>
          <dd>{created.inboundReceiptNo}</dd>
          <dt className="field-label">{t.result.status}</dt>
          <dd>
            {/* 상태 코드는 값으로 분기하지 않고 그대로 보인다(공유계약 G-2). */}
            <Chip variant="status" size="sm">
              {created.statusCode}
            </Chip>
          </dd>
        </div>
      ))}
    </dl>

    <p className="field-note">{t.result.unlabeled}</p>
  </div>
);
