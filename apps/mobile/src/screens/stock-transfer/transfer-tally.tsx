import { messages } from '@omf-mes/i18n';
import { useEffect, useRef } from 'react';

import { FitName } from '../../patterns/fit-name';
import { qtyProblemOf, type DraftLine } from './transfer';

const t = messages.stockTransfer;

/** 숫자판이 옮겨 갈 칸을 찾는 이름. 표와 숫자판이 이 함수 하나를 함께 쓴다. */
export const qtyFieldId = (key: number): string => `stock-transfer-qty-${String(key)}`;

/** LOT 번호 끝 조각 — 표 줄에서 같은 품목 LOT 을 가른다(전체 번호는 결과 칸 · 시트에). */
export const lotTailOf = (lotNo: string): string => lotNo.split(/[|-]/u).at(-1) ?? lotNo;

export interface TransferTallyProps {
  lines: readonly DraftLine[];
  itemOf: (line: DraftLine) => { itemCode: string; itemName: string };
  uomOf: (uomId: number) => string;
  nameOf: (line: DraftLine) => string;
  /** 방금 담은 LOT — 초록. */
  currentLotId: number | null;
  /** 이미 담은 LOT 을 또 찍었을 때 그 LOT — 회색. */
  duplicateLotId: number | null;
  /** 찍을 때마다 바뀌는 값 — 바뀌면 강조한 줄로 옮긴다. */
  focusKey: number;
  onQty: (lotId: number, value: string) => void;
  onKeypad: (lotId: number) => void;
  onOpen: (lotId: number) => void;
}

/**
 * 반출 LOT 표(사용자 지시 2026-11-20, 입하 등록 「이번 입하」 표와 같은 모양) — No · 품목코드 · LOT 끝 / 품목명 ·
 * 수량 칸. 수량은 재고 전량으로 채워 두고 덜 옮길 때만 고친다(사용자 결정 2026-11-20). 칸을 누르면 화면 숫자판.
 * 품목 칸을 누르면 그 LOT 시트(전체 번호 · 재고 · [목록에서 빼기]).
 */
export const TransferTally = ({
  lines,
  itemOf,
  uomOf,
  nameOf,
  currentLotId,
  duplicateLotId,
  focusKey,
  onQty,
  onKeypad,
  onOpen,
}: TransferTallyProps) => {
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    tableRef.current
      ?.querySelector("tr[data-current='true'], tr[data-duplicate='true']")
      ?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [focusKey]);

  return (
    <section className="transfer-tally" aria-label={t.tally.title}>
      <h2 className="transfer-tally__title">
        {t.tally.title} <span className="transfer-tally__total">{t.tally.total(lines.length)}</span>
      </h2>
      <div className="transfer-tally__box">
        <table ref={tableRef} className="transfer-tally__table">
          <colgroup>
            <col className="transfer-tally__col-no" />
            <col />
            <col className="transfer-tally__col-qty" />
          </colgroup>
          <tbody>
            {lines.map((line, index) => {
              const item = itemOf(line);
              const problem = qtyProblemOf(line);

              return (
                <tr
                  key={line.lotId}
                  data-current={line.lotId === currentLotId}
                  data-duplicate={line.lotId === duplicateLotId}
                >
                  <td className="transfer-tally__no">{index + 1}</td>
                  <td className="transfer-tally__item">
                    <button
                      type="button"
                      className="transfer-tally__open"
                      aria-label={t.tally.open(item.itemCode, line.lotNo)}
                      onClick={() => {
                        onOpen(line.lotId);
                      }}
                    >
                      <span className="transfer-tally__code">
                        {item.itemCode}
                        <span className="transfer-tally__lot">{lotTailOf(line.lotNo)}</span>
                      </span>
                      <FitName
                        className="transfer-tally__name"
                        text={item.itemName}
                        min={7}
                        lines={1}
                        whole
                      />
                    </button>
                    {problem === null ? null : (
                      <p className="transfer-tally__problem" role="alert">
                        {problem === 'overStock'
                          ? t.from.problem.overStock(String(line.onHandQty))
                          : t.from.problem[problem]}
                      </p>
                    )}
                  </td>
                  <td className="transfer-tally__qty">
                    <label className="transfer-tally__field">
                      <input
                        id={qtyFieldId(line.lotId)}
                        aria-label={t.from.qtyLabel(nameOf(line))}
                        aria-invalid={problem === null ? undefined : true}
                        /*
                         * 장갑을 끼고 한 손으로 조작한다. 단말 키보드는 키가 촘촘하고, 올라오면
                         * 표와 기록 단추를 덮는다 - 화면 숫자판으로 적는다.
                         */
                        inputMode="none"
                        autoComplete="off"
                        value={line.qty}
                        onFocus={() => {
                          onKeypad(line.lotId);
                        }}
                        onClick={() => {
                          onKeypad(line.lotId);
                        }}
                        onChange={(event) => {
                          onQty(line.lotId, event.target.value);
                        }}
                      />
                      <small>{uomOf(line.uomId)}</small>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
