import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import type { CreatedReceiptView, SplitMode } from './types';

const t = messages.overReceiptSplit;

/** 다음 화면(W-01-11). 그 화면이 전표를 주소로 받는다. */
export const poRegisterEntryPath = (inboundReceiptId: number): string =>
  `/logistics/po-register?receipt=${String(inboundReceiptId)}`;

export type ReceiptPart = 'normal' | 'excess';

/**
 * 어느 전표가 초과분인가. **응답의 예외 유형으로 가른다** — 초과분 전표에만 실린다. 유형이 없으면
 * 갈래로 본다: 초과분만 저장했으면 전부 초과분, 아니면 정량분이다.
 */
export const partOf = (receipt: CreatedReceiptView, mode: SplitMode): ReceiptPart => {
  if (receipt.exceptionTypeCode !== null) return 'excess';

  return mode === 'EXCESS_ONLY' ? 'excess' : 'normal';
};

/** 전표 상태 — 코드 사전(`LOGISTICS_DOCUMENT_STATUS`)의 네 값은 번역하고, 모르는 코드는 그대로. */
export const docStatusLabel = (code: string): string => t.values.docStatus[code] ?? code;

export interface CreatedReceiptsPaneProps {
  receipts: readonly CreatedReceiptView[];
  mode: SplitMode;
}

/**
 * 등록 결과. **전표 번호는 사용자 대면 업무 번호라 낸다.** 사라지는 알림으로 내지 않는다 —
 * 나중에 조회할 번호를 몇 초 뒤에 없애면 적어 둘 틈이 없다.
 *
 * 「신규 자재 P/O 등록」은 **초과분 전표에만** 선다 — 정산할 것이 초과분이다.
 */
export const CreatedReceiptsPane = ({ receipts, mode }: CreatedReceiptsPaneProps) => (
  /* 사용자가 부르지 않은 시점에 나타나는 내용이라 살아 있는 영역으로 알린다. */
  <div role="status" aria-label={t.panes.result} className="ors-result">
    <p className="ors-result-lead">{t.result.count(receipts.length)}</p>

    <ul className="ors-result-list">
      {receipts.map((created) => {
        const part = partOf(created, mode);

        return (
          <li className="ors-result-item" key={created.inboundReceiptNo}>
            <Chip variant="status" status={part === 'excess' ? 'warning' : 'success'} size="sm">
              {part === 'excess' ? t.values.partExcess : t.values.partNormal}
            </Chip>
            <span className="ors-result-no">{created.inboundReceiptNo}</span>
            <Chip variant="status" size="sm">
              {docStatusLabel(created.statusCode)}
            </Chip>
            {part === 'excess' && (
              <Link to={poRegisterEntryPath(created.inboundReceiptId)}>
                {t.result.registerPo(created.inboundReceiptNo)}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  </div>
);
