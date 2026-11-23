import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef } from 'react';

import { Button } from '../../patterns/button';

import { qtyNumber } from './lot-format';
import { isReceiving, type TallyGroup } from './receipt';
import { FitName } from '../../patterns/fit-name';

const t = messages.inboundReceipt.tally;
const c = messages.inboundReceipt.close;

export interface ReceiptTallyProps {
  /** 공장 날짜(YYYY-MM-DD) — 새 스캔이 들어가는 입하의 날짜. 제목에 YY.MM.DD 로 적는다. */
  date: string;
  groups: readonly TallyGroup[];
  total: number;
  /** 방금 찍은 라벨이 들어간 입하 LOT — 그 줄을 초록으로. */
  currentId: number | null;
  /** 이미 찍은 라벨을 또 찍었을 때 그 라벨이 있는 행 번호 — 그 줄을 회색으로. */
  duplicateNo: number | null;
  /** 찍을 때마다 바뀌는 값 — 바뀌면 강조한 줄로 스크롤한다. */
  focusKey: string | null;
  onOpen: (inboundLotId: number) => void;
  /** 입하 중인 품목 수 · LOT 수 — 0 이면 [마감]이 없다. */
  receiving: { items: number; lots: number };
  /** [마감]이 막힌 까닭 — 없으면 null. */
  closeLock: string | null;
  closing: boolean;
  onCloseAll: () => void;
}

/** 표 제목의 날짜 — `2026-11-23` → `26.11.23`(사용자 지시 2026-11-23). */
export const tallyDateText = (date: string): string => date.slice(2).replaceAll('-', '.');

/**
 * 입하 표(사용자 지시 2026-11-20 「지금까지 얼마나 스캔했는지」) — 공급사 머리 줄 아래 품목 줄. 공급사가 하나여도
 * 머리 줄을 둔다(사용자 지시 2026-11-23 — 표 맨 위에서 어느 공급사 것인지 보인다).
 * 머리 오른쪽 작은 [마감]이 입하 중인 품목을 모두 마감한다 — 드문 일이라 크게 두지 않는다. 표 머리 줄은 낭독기에만. 줄은 처음 찍은
 * 차례로 서고 행 번호(No)를 단다. 품목 칸은 품목코드 위 · 품목명 아래로, 길면 낱말 사이에서 꺾여 잘리지 않는다.
 * 줄을 누르면 그 품목의 자재 관리 LOT 목록(하나씩 빼기 · 공급사 LOT · 이 품목만 마감)으로 간다.
 */
export const ReceiptTally = ({
  date,
  groups,
  total,
  currentId,
  duplicateNo,
  focusKey,
  onOpen,
  receiving,
  closeLock,
  closing,
  onCloseAll,
}: ReceiptTallyProps) => {
  const lockId = useId();
  const title = t.title(tallyDateText(date));
  const tableRef = useRef<HTMLTableElement>(null);

  /* 찍은 줄이 화면 밖이면 그 줄로 옮긴다 — 중복이면 「No n」 줄을 바로 눈앞에(사용자 지시 2026-11-20). */
  useEffect(() => {
    if (focusKey === null) return;
    tableRef.current
      ?.querySelector("tr[data-current='true'], tr[data-duplicate='true']")
      ?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [focusKey]);

  return (
    <section className="receive-tally" aria-label={title}>
      <div className="receive-tally__head">
        <h2 className="receive-tally__title">
          {title} <span className="receive-tally__total">{t.total(total)}</span>
        </h2>
        {receiving.items === 0 ? null : (
          <Button
            variant="outlined"
            size="sm"
            className="receive-tally__close"
            aria-label={c.all(receiving.items, receiving.lots)}
            aria-describedby={closeLock === null ? undefined : lockId}
            disabled={closeLock !== null || closing}
            loading={closing}
            onClick={onCloseAll}
          >
            {c.allShort}
          </Button>
        )}
      </div>
      {receiving.items === 0 || closeLock === null ? null : (
        <p id={lockId} className="receive-tally__lock">
          {closeLock}
        </p>
      )}
      {groups.length === 0 ? (
        <p className="receive-tally__empty">{t.empty}</p>
      ) : (
        <div className="receive-tally__scroll">
          <table ref={tableRef} className="receive-tally__table">
            <colgroup>
              <col className="receive-tally__col-no" />
              <col />
              <col className="receive-tally__col-count" />
              <col className="receive-tally__col-qty" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="receive-tally__no">
                  {t.columns.no}
                </th>
                <th scope="col">{t.columns.item}</th>
                <th scope="col" className="receive-tally__num">
                  {t.columns.count}
                </th>
                <th scope="col" className="receive-tally__num">
                  {t.columns.qty}
                </th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.supplierId}>
                <tr className="receive-tally__group">
                  <th scope="colgroup" colSpan={4}>
                    {group.supplierName}
                  </th>
                </tr>
                {group.rows.map(({ no, detail }) => {
                  const closed = !isReceiving(detail);

                  return (
                    <tr
                      key={detail.inboundLotId}
                      data-current={detail.inboundLotId === currentId}
                      data-duplicate={no === duplicateNo}
                      data-closed={closed}
                    >
                      <td className="receive-tally__no">{no}</td>
                      <td className="receive-tally__item">
                        <button
                          type="button"
                          className="receive-tally__open"
                          aria-label={t.open(detail.itemCode, detail.itemName)}
                          onClick={() => {
                            onOpen(detail.inboundLotId);
                          }}
                        >
                          <span className="receive-tally__code">
                            {detail.itemCode}
                            {closed ? (
                              <span className="receive-tally__closed">{t.closed}</span>
                            ) : null}
                          </span>
                          <FitName
                            className="receive-tally__name"
                            text={detail.itemName}
                            min={7}
                            lines={1}
                            whole
                          />
                        </button>
                      </td>
                      <td className="receive-tally__num receive-tally__count">{detail.lotCount}</td>
                      <td className="receive-tally__num">
                        {qtyNumber(detail.receivedQty)}
                        <small>{detail.uomCode}</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  );
};
