import { type ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { CountChip } from '../../patterns/count-chip';
import { InfoTip } from '../../patterns/info-tip';
import { ERP_CHIP_VALUES, type ErpChipValue } from './types';

const t = messages.shipmentSchedule.bu012;

const TONE: Record<ErpChipValue, ChipStatus> = {
  NOT_QUEUED: 'idle',
  PENDING: 'info',
  SENT: 'success',
  SEND_ERROR: 'error',
  NOT_SENT_NO_SALES_ORDER: 'warning',
  CANCELLED: 'idle',
};

export interface ErpChipsProps {
  /** 서버가 센 ERP 송신 상태별 지시서 수(`erpSendStatusCounts`). 0 건 상태는 키가 없다. */
  counts: Readonly<Record<string, number>>;
  selected: ErpChipValue | '';
  onSelect: (next: ErpChipValue | '') => void;
}

/**
 * ERP 송신 칩(피처 012 FR-018 · 시안 W0402-After ③) — 「전체」 · 확정 전 · 대기 · 보냄 · 송신 오류 · 송신 안 함 · 취소됨.
 *
 * ⭐ **0 건 칩은 세우지 않는다 — 고른 칩은 0 이 돼도 남긴다**(#1712 규칙). 남겨야 눌러 풀 수 있다.
 * ⭐ 「전체」 건수는 상태별 건수의 합(완료 출하 없는 지시서 `NO_SHIPMENT` 포함)이다 — 서버가 ERP 조건만 빼고 같은
 *    조건으로 센다(계약 `erpSendStatusCounts`).
 */
export const ErpChips = ({ counts, selected, onSelect }: ErpChipsProps) => {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="shipment-schedule-erp-chips" role="group" aria-label={t.erpChipsLabel}>
      <span className="field-label">{t.erpSend}</span>
      <CountChip
        tone="idle"
        label={t.erpChip(t.erpAll, total)}
        selected={selected === ''}
        onSelect={() => {
          onSelect('');
        }}
      />
      {ERP_CHIP_VALUES.filter((value) => (counts[value] ?? 0) > 0 || value === selected).map(
        (value) => (
          <CountChip
            key={value}
            tone={TONE[value]}
            label={t.erpChip(t.erpStatus[value], counts[value] ?? 0)}
            selected={selected === value}
            onSelect={() => {
              onSelect(selected === value ? '' : value);
            }}
          />
        ),
      )}
      {/* 세는 규칙은 칩 줄 끝 ⓘ 로(관리웹 정리 시안 A · #1733). */}
      <InfoTip text={t.erpNote} />
    </div>
  );
};
