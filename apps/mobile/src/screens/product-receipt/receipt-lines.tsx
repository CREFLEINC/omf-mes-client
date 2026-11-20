import { messages } from '@omf-mes/i18n';
import { useEffect, useRef } from 'react';

import { FitName } from '../../patterns/fit-name';
import { differsFromExpected, INSPECTION_PENDING, qtyProblemOf, type DraftLine } from './receipt';

const t = messages.productReceipt;
const required = messages.common.required;

/** 숫자판이 옮겨 갈 칸을 찾는 이름. 표와 숫자판이 이 함수 하나를 함께 쓴다. */
export const qtyFieldId = (key: string): string => `product-receipt-qty-${key}`;

export interface ReceiptLinesProps {
  lines: readonly DraftLine[];
  itemOf: (line: DraftLine) => { itemCode: string; itemName: string };
  lotNoOf: (line: DraftLine) => string;
  statusOf: (line: DraftLine) => string | undefined;
  /** 숫자판 머리 · 칸 이름에 쓰는 「품목 · LOT」. */
  nameOf: (line: DraftLine) => string;
  currentKey: string | null;
  duplicateKey: string | null;
  focusKey: number;
  onQty: (key: string, value: string) => void;
  onKeypad: (key: string) => void;
  onOpen: (key: string) => void;
}

/**
 * 인수 대상 표(사용자 지시 2026-11-20, 입하 등록 「이번 입하」 표와 같은 모양) — No · 품목코드 / 품목명 · LOT 번호 ·
 * 실물 수량 칸. 제조일 · 유효기간 · 양품 실적은 줄을 눌러 연 시트로 옮겼다(사용자 결정 2026-11-20). 다르다 · 검사 대기
 * 같은 알릴 것만 줄 아래 한 줄로 남긴다.
 */
export const ReceiptLines = ({
  lines,
  itemOf,
  lotNoOf,
  statusOf,
  nameOf,
  currentKey,
  duplicateKey,
  focusKey,
  onQty,
  onKeypad,
  onOpen,
}: ReceiptLinesProps) => {
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    tableRef.current
      ?.querySelector("tr[data-current='true'], tr[data-duplicate='true']")
      ?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [focusKey]);

  return (
    <div className="receipt-lines__box">
      <table ref={tableRef} className="receipt-lines__table">
        <colgroup>
          <col className="receipt-lines__col-no" />
          <col />
          <col className="receipt-lines__col-qty" />
        </colgroup>
        <tbody>
          {lines.map((line, index) => {
            const item = itemOf(line);
            const problem = qtyProblemOf(line);
            const lotNo = lotNoOf(line);

            return (
              <tr
                key={line.key}
                data-current={line.key === currentKey}
                data-duplicate={line.key === duplicateKey}
              >
                <td className="receipt-lines__no">{index + 1}</td>
                <td className="receipt-lines__item">
                  <button
                    type="button"
                    className="receipt-lines__open"
                    aria-label={t.tally.open(item.itemCode, lotNo)}
                    onClick={() => {
                      onOpen(line.key);
                    }}
                  >
                    <span className="receipt-lines__code">{item.itemCode}</span>
                    <FitName
                      className="receipt-lines__name"
                      text={item.itemName}
                      min={8}
                      lines={1}
                    />
                    <span className="receipt-lines__lot">{lotNo}</span>
                  </button>
                  {problem === null ? null : (
                    <p className="receipt-lines__note receipt-lines__note--error" role="alert">
                      {t.contents.problem[problem]}
                    </p>
                  )}
                  {/* 실물대로 받는다. 사유를 담을 자리가 계약에 없어 지어내지 않는다. */}
                  {differsFromExpected(line) ? (
                    <p className="receipt-lines__note">
                      {line.from === 'lot' ? t.contents.differsGood : t.contents.differs}
                    </p>
                  ) : null}
                  {/* 입고는 막지 않는다. 막히는 것은 하류의 피킹·출하다. */}
                  {statusOf(line) === INSPECTION_PENDING ? (
                    <p className="receipt-lines__note">{t.notReleased}</p>
                  ) : null}
                </td>
                <td className="receipt-lines__qty">
                  <label className="receipt-lines__field">
                    <input
                      id={qtyFieldId(line.key)}
                      aria-label={required(t.contents.qtyLabel(nameOf(line)))}
                      aria-invalid={problem === null ? undefined : true}
                      /*
                       * 장갑을 끼고 한 손으로 조작한다. 기기 키보드는 키가 촘촘하고, 올라오면
                       * 위치 스캔 칸과 완료 단추를 덮는다(설계 §7 · 공유계약 G-6).
                       */
                      inputMode="none"
                      autoComplete="off"
                      value={line.qty}
                      onFocus={() => {
                        onKeypad(line.key);
                      }}
                      onChange={(event) => {
                        onQty(line.key, event.target.value);
                      }}
                    />
                  </label>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
