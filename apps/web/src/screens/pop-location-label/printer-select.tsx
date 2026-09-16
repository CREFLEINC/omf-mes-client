import { AlertBanner, Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { PopSelect as Select } from '../../patterns/pop-select';
import { popTouchClass } from '../../patterns/pop-touch';
import type { Printer } from './types';

const t = messages.popLocationLabel.printer;

/**
 * 상태 값을 **색으로만** 옮긴다. 문구는 서버가 준 `statusMessage` 를 그대로 쓴다 — 화면이
 * `status` 로 한국어를 지어내면 서버가 값을 늘렸을 때 화면만 모르는 문구가 생긴다.
 */
const CHIP_STATUS: Record<string, 'success' | 'warning' | 'error'> = {
  READY: 'success',
  BUSY: 'warning',
  OFFLINE: 'error',
  ERROR: 'error',
};

export interface PrinterSelectProps {
  printers: Printer[];
  value: string | null;
  onChange: (printerName: string) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  disabled: boolean;
}

/**
 * 프린터 — **이 종류를 찍을 수 있는 것만 온다**(서버가 `documentTypeCode` 로 거른다).
 *
 * 세 상태를 **다른 모양으로** 낸다(공유계약 G-9) — 목록을 못 받은 것 · 찍을 수 있는 프린터가
 * 없는 것 · 있는 것. 조회 실패를 「없음」으로 내면 사용자가 설치 문제로 오해한다.
 *
 * ⚠ **고르지 않아도 막지 않는다.** `printerName` 이 nullable 이라 서버 기본값에 맡길 수 있다 —
 * 대신 그렇게 된다는 사실을 밝힌다.
 *
 * ⚠ **프린터가 0건이어도 발행을 막지 않는다.** 발행 기록과 물리 인쇄는 다른 걸음이고, 기록은
 * 프린터가 없어도 남는다 — 대신 라벨이 안 나온다는 사실을 적는다.
 */
export const PrinterSelect = ({
  printers,
  value,
  onChange,
  isLoading,
  isError,
  onRetry,
  disabled,
}: PrinterSelectProps) => {
  if (isError) {
    return (
      <div className="pop-loclabel-printer">
        <Chip status="error">{t.unknown}</Chip>
        <Button className={popTouchClass('normal')} variant="outlined" size="xl" onClick={onRetry}>
          {t.retry}
        </Button>
      </div>
    );
  }

  /* 조회 중에는 아무것도 단정하지 않는다 — 「없음」으로 잠깐 보이면 그 사이 오해가 생긴다. */
  if (isLoading) return null;

  if (printers.length === 0) {
    return (
      <div className="pop-loclabel-printer">
        <AlertBanner variant="warning">{t.none}</AlertBanner>
      </div>
    );
  }

  const selected = printers.find((printer) => printer.printerName === value) ?? null;

  return (
    <div className="pop-loclabel-printer">
      <span className="field-label">{t.label}</span>
      <Select
        aria-label={t.label}
        size="xl"
        value={value}
        disabled={disabled}
        options={printers.map((printer) => ({
          value: printer.printerName,
          label: printer.displayName,
        }))}
        onChange={onChange}
      />
      {selected === null ? (
        <span className="field-note">{t.unselected}</span>
      ) : (
        <Chip status={CHIP_STATUS[selected.status] ?? 'warning'}>
          {selected.statusMessage ?? t.noStatusMessage}
        </Chip>
      )}
    </div>
  );
};
