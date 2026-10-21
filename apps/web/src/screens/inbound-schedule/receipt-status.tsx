import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ReceiptStatusCode } from './types';

const t = messages.inboundSchedule;

/** 진행 표식의 색 — 저장소 관례(진행 중 info · 완료 success · 취소 error · 아직 idle)를 따른다. */
type Tone = 'idle' | 'info' | 'success' | 'error' | 'warning';

const RECEIPT_TONE: Record<ReceiptStatusCode, Tone> = {
  NOT_STARTED: 'idle',
  PARTIAL: 'info',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

/** 모르는 코드는 번역하지 않고 그대로, 중립 색으로 낸다 — 뜻을 지어내지 않는다. */
const receiptLabel = (code: string): string =>
  code in t.receiptStatus ? t.receiptStatus[code as ReceiptStatusCode] : code;

const receiptTone = (code: string): Tone =>
  code in RECEIPT_TONE ? RECEIPT_TONE[code as ReceiptStatusCode] : 'idle';

/** 상태 칸 — 진행 칩과, 늦었으면 「지연」 칩을 한 줄로 나란히. 두 표가 같은 모양을 쓴다. */
export const ReceiptStatusCell = ({
  code,
  overdue,
}: {
  /** #762 앞선 서버는 묶음 진행 값을 주지 않는다 — 없으면 칩 대신 「—」. */
  code: string | undefined;
  overdue: boolean;
}) =>
  code === undefined || code === '' ? (
    t.values.empty
  ) : (
    <span className="po-board-status">
      <Chip variant="status" status={receiptTone(code)} size="sm">
        {receiptLabel(code)}
      </Chip>
      {overdue && (
        <Chip variant="status" status="warning" size="sm">
          {t.values.overdue}
        </Chip>
      )}
    </span>
  );

/**
 * 발주 줄 상태 — **지연 · 정상 둘만** 말한다(사용자 지시 2026-10-21).
 * 끝난 발주(입하 완료·취소)는 「—」다 — 「정상」으로 쓰면 아직 들어올 것으로 읽힌다. 끝났는지는
 * 미입고 품목(「0 / 3」)이 말한다.
 */
export const OrderStateCell = ({
  code,
  overdue,
}: {
  code: string | undefined;
  overdue: boolean;
}) => {
  if (code === undefined || code === '' || code === 'COMPLETED' || code === 'CANCELLED') {
    return t.values.empty;
  }

  return overdue ? (
    <Chip variant="status" status="warning" size="sm">
      {t.values.overdue}
    </Chip>
  ) : (
    <Chip variant="status" status="success" size="sm">
      {t.values.onTrack}
    </Chip>
  );
};

/**
 * 수량 표기. **값이 없으면 「—」다** — #762 가 더한 칸(합계 등)은 그 서버보다 앞선 서버에서는 아예 오지 않는다.
 * 그때 화면이 죽지 않고 빈 칸으로 남아야 한다.
 */
export const formatQty = (value: number | null | undefined): string =>
  typeof value === 'number' ? value.toLocaleString() : t.values.empty;

/** 글자 칸 — 값이 없거나 비면 「—」. */
export const orEmpty = (value: string | null | undefined): string =>
  value === null || value === undefined || value === '' ? t.values.empty : value;

export { OneLine } from '../../patterns/po-board';
