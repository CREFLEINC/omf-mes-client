import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import type { CreatedResult } from './types';

const t = messages.overReceiptSplit;

/**
 * 초과분 잇기 자리 — 「입하 예정 조회」가 연다(사용자 지시 2026-10-21 — 입하·입고 일을 그 화면으로 모은다).
 * `excess=1` 이 잇기 창을 열고, `excessReceipt` 가 방금 만든 전표의 초과분을 앞에 세운다.
 * 주소 키는 그 화면의 `excess-entry.ts` 가 정한다.
 */
export const excessLinkPath = (inboundReceiptNo: string): string =>
  `/logistics/inbound-schedule?${new URLSearchParams({ excess: '1', excessReceipt: inboundReceiptNo }).toString()}`;

/** 전표 상태 — 코드 사전(`LOGISTICS_DOCUMENT_STATUS`)의 네 값은 번역하고, 모르는 코드는 그대로. */
export const docStatusLabel = (code: string): string => t.values.docStatus[code] ?? code;

export interface CreatedReceiptsPaneProps {
  result: CreatedResult;
}

/**
 * 등록 결과. **전표 번호는 사용자 대면 업무 번호라 낸다.** 사라지는 알림으로 내지 않는다 —
 * 나중에 조회할 번호를 몇 초 뒤에 없애면 적어 둘 틈이 없다.
 *
 * 초과 몫을 실었으면 **그 몫이 아직 P/O 에 들어가지 않았다는 사실과 이을 자리**를 함께 낸다 —
 * 추가 P/O 는 ERP 가 만들고, 생기면 사람이 잇는다(서버 장부 P-100).
 */
export const CreatedReceiptsPane = ({ result }: CreatedReceiptsPaneProps) => {
  const first = result.receipts[0];

  return (
    /* 사용자가 부르지 않은 시점에 나타나는 내용이라 살아 있는 영역으로 알린다. */
    <div role="status" aria-label={t.panes.result} className="ors-result">
      <p className="ors-result-lead">{t.result.count(result.receipts.length)}</p>

      <ul className="ors-result-list">
        {result.receipts.map((created) => (
          <li className="ors-result-item" key={created.inboundReceiptNo}>
            <span className="ors-result-no">{created.inboundReceiptNo}</span>
            <Chip variant="status" size="sm">
              {docStatusLabel(created.statusCode)}
            </Chip>
          </li>
        ))}
      </ul>

      {result.excessLines.length > 0 && first !== undefined && (
        <div className="ors-result-excess">
          <p>
            {t.result.excessWaiting(
              result.excessLines
                .map((line) => t.result.excessLine(line.lineNo, line.excessQty.toLocaleString()))
                .join(' · '),
            )}
          </p>
          <Link to={excessLinkPath(first.inboundReceiptNo)}>{t.result.goLinkExcess}</Link>
        </div>
      )}
    </div>
  );
};
