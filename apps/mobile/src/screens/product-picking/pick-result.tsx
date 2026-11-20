import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { Button } from '../../patterns/button';
import { FitName } from '../../patterns/fit-name';
import {
  lineTiles,
  type PickRejection,
  type ShipmentLotPickResult,
  type ShipmentLotReplaceResult,
  type ShipmentRequestLine,
} from './picking';
import '../../patterns/scan-result.css';

const t = messages.productPicking;

/** 방금 찍은 결과 칸에 서는 것 — 한 자리에 하나만. */
export type PickNotice =
  | { kind: 'picked'; result: ShipmentLotPickResult }
  /** 이 지시서에 이미 피킹한 LOT — 서버에 보내지 않고 몇 번 라인인지 알린다. */
  | { kind: 'duplicate'; lotNo: string; lineNo: number }
  | {
      kind: 'rejected';
      lotNo: string;
      line: ShipmentRequestLine | null;
      rejection: PickRejection | { kind: 'notFound' | 'noLine' };
    }
  | { kind: 'replaced'; lotNo: string; result: ShipmentLotReplaceResult }
  | { kind: 'replaceRefused'; lotNo: string; notRejected: boolean };

interface PickResultProps {
  notice: PickNotice;
  itemOf: (itemId: number) => { itemCode: string; itemName: string } | undefined;
  uomOf: (uomId: number) => string;
  /** 전송 실패 칸의 [다시 시도] — 그 LOT 을 같은 멱등 키로 다시 보낸다. */
  onRetry: (lotNo: string) => void;
}

const rejectionTitle = (rejection: Extract<PickNotice, { kind: 'rejected' }>['rejection']) =>
  rejection.kind === 'code'
    ? t.rejected[rejection.code]
    : rejection.kind === 'server'
      ? rejection.message
      : rejection.kind === 'failed'
        ? t.rejected.failed
        : rejection.kind === 'notFound'
          ? t.rejected.notFound
          : t.rejected.NO_LINE_FOR_ITEM;

/** 라인이 채워진 정도 한 줄 — 「라인 1 남음 60」 · 「라인 1 목표 100 을 채웠습니다」. */
const progressOf = (line: ShipmentRequestLine): string => {
  const tiles = lineTiles(line);

  if (tiles.kind === 'remaining') {
    return t.picked.remaining(line.lineNo, String(tiles.value));
  }

  return tiles.value > 0
    ? t.picked.reachedOver(line.lineNo, String(tiles.target), String(tiles.value))
    : t.picked.reached(line.lineNo, String(tiles.target));
};

/**
 * 방금 찍은 결과 칸(사용자 지시 2026-11-20, 입하 등록 시안 A 와 같은 모양) — 피킹됨 초록 · 이미 피킹함 회색 ·
 * 피킹 안 됨 빨강. LOT 번호는 줄이지 않고 전체를 보인다(라벨과 대조).
 */
export const PickResult = ({ notice, itemOf, uomOf, onRetry }: PickResultProps) => {
  if (notice.kind === 'picked') {
    const { pickedLot, line } = notice.result;
    const item = itemOf(line.itemId);
    const reached = lineTiles(line).kind === 'over';

    return (
      <section className="last-scan" data-kind="ok" aria-label={t.result.picked}>
        <p className="last-scan__bar">
          <Icon name="check_circle" size={22} />
          <span>{t.result.picked}</span>
          {reached ? <span className="last-scan__tag">{t.result.reached}</span> : null}
        </p>
        <div className="last-scan__body">
          <p className="last-scan__code">{item?.itemCode ?? line.itemCode}</p>
          <p className="last-scan__name">
            <FitName text={item?.itemName ?? line.itemName} min={13} />
          </p>
          <p className="last-scan__qty">
            {String(pickedLot.pickedQty)}
            <small>{uomOf(pickedLot.uomId)}</small>
          </p>
          <p className="last-scan__lot">{pickedLot.lotNo}</p>
          <p className="last-scan__note">{progressOf(line)}</p>
        </div>
      </section>
    );
  }

  if (notice.kind === 'duplicate') {
    return (
      <section className="last-scan" data-kind="duplicate" aria-label={t.result.duplicate}>
        <p className="last-scan__bar">
          <Icon name="info" size={22} />
          <span>{t.result.duplicate}</span>
        </p>
        <div className="last-scan__body">
          <p className="last-scan__why">{t.result.duplicateRow(notice.lineNo)}</p>
          <p className="last-scan__lot">{notice.lotNo}</p>
        </div>
      </section>
    );
  }

  if (notice.kind === 'replaced') {
    const { line, nonconformanceNo, replacedLot } = notice.result;
    const tiles = lineTiles(line);

    return (
      <section className="last-scan" data-kind="ok" aria-label={t.result.replaced}>
        <p className="last-scan__bar">
          <Icon name="check_circle" size={22} />
          <span>{t.result.replaced}</span>
        </p>
        <div className="last-scan__body">
          <p className="last-scan__why">{t.replace.done(notice.lotNo)}</p>
          {nonconformanceNo === null ? null : (
            <p className="last-scan__note">{t.replace.nonconformance(nonconformanceNo)}</p>
          )}
          {tiles.kind === 'remaining' ? (
            <p className="last-scan__note">
              {t.replace.receiveMore(line.lineNo, String(tiles.value), uomOf(replacedLot.uomId))}
            </p>
          ) : null}
        </div>
      </section>
    );
  }

  if (notice.kind === 'replaceRefused') {
    const title = notice.notRejected ? t.replace.notRejected : t.replace.failed;

    return (
      <section className="last-scan" data-kind="reject" aria-label={t.result.replaceRefused}>
        <p className="last-scan__bar">
          <Icon name="block" size={22} />
          <span>{t.result.replaceRefused}</span>
        </p>
        <div className="last-scan__body" role="alert">
          <p className="last-scan__why">{title}</p>
          <p className="last-scan__lot">{notice.lotNo}</p>
          {notice.notRejected ? (
            <p className="last-scan__sub">{t.replace.notRejectedDetail}</p>
          ) : null}
        </div>
      </section>
    );
  }

  const { rejection } = notice;
  const title = rejectionTitle(rejection);

  return (
    <section className="last-scan" data-kind="reject" aria-label={t.result.rejected}>
      <p className="last-scan__bar">
        <Icon name="block" size={22} />
        <span>{t.result.rejected}</span>
      </p>
      <div className="last-scan__body" role="alert" aria-label={title}>
        <p className="last-scan__why">{title}</p>
        <p className="last-scan__lot">{notice.lotNo}</p>
        {rejection.kind === 'code' &&
        rejection.code === 'LOT_TARGET_REACHED' &&
        notice.line !== null ? (
          <p className="last-scan__sub">
            {t.rejected.targetReachedDetail(
              notice.line.lineNo,
              String(notice.line.allocatedQty),
              String(notice.line.pickedQty),
            )}
          </p>
        ) : null}
        {rejection.kind === 'code' && rejection.code === 'LOT_ALREADY_RESERVED' ? (
          <p className="last-scan__sub">{t.rejected.reservedDetail}</p>
        ) : null}
        {rejection.kind === 'notFound' ? (
          <p className="last-scan__sub">{t.rejected.notFoundDetail}</p>
        ) : null}
        {rejection.kind === 'failed' ? (
          <>
            <p className="last-scan__sub">{t.rejected.failedDetail}</p>
            <Button variant="outlined" onClick={() => onRetry(notice.lotNo)}>
              {t.rejected.retry}
            </Button>
          </>
        ) : (
          <p className="last-scan__sub">{t.rejected.notPicked}</p>
        )}
      </div>
    </section>
  );
};
