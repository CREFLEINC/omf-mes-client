import { AlertBanner, Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { PopSelect as Select } from '../../patterns/pop-select';
import { popTouchClass } from '../../patterns/pop-touch';
import type { PrinterStatus, PrinterView } from './types';

const t = messages.shippingPackingLabel.printer;

/**
 * 상태 값을 **색으로만** 옮긴다. 문구는 서버가 준 `statusMessage` 를 그대로 쓴다 — 화면이
 * `status` 로 한국어를 지어내면 서버가 값을 늘렸을 때 화면만 모르는 문구가 생긴다.
 */
const CHIP_STATUS: Record<PrinterStatus, 'success' | 'warning' | 'error'> = {
  READY: 'success',
  BUSY: 'warning',
  OFFLINE: 'error',
  ERROR: 'error',
};

export interface PrinterSelectProps {
  printers: PrinterView[];
  value: string | null;
  onChange: (printerName: string) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  disabled: boolean;
  /** 아직 라벨 종류를 고르지 않았다 — 조회 자체를 하지 않은 상태다. */
  awaitingKind: boolean;
}

/**
 * ④ 프린터 — **고른 라벨 종류를 찍을 수 있는 것만 온다.**
 *
 * 목록을 서버가 `documentTypeCode` 로 걸러 준다(`queries.ts`). 그것이 라벨 종류를 유형 값으로
 * 가른 이유다 — 거르지 않으면 **고객에게 나가는 납품 라벨을 창고 포장 프린터로 보낸다**
 * (스펙 §5-2).
 *
 * 세 상태를 **다른 모양으로** 낸다(공유계약 G-9) — 목록을 못 받은 것 · 찍을 수 있는 프린터가
 * 없는 것 · 있는 것. 조회 실패를 「없음」으로 내면 사용자가 설치 문제로 오해한다.
 *
 * ⚠ **고르지 않아도 막지 않는다.** `printer_name` 이 nullable 이라 서버 기본값에 맡길 수
 * 있다(스펙 §6) — 대신 그렇게 된다는 사실을 밝힌다.
 */
export const PrinterSelect = ({
  printers,
  value,
  onChange,
  isLoading,
  isError,
  onRetry,
  disabled,
  awaitingKind,
}: PrinterSelectProps) => {
  /*
   * ⭐ **종류를 고르기 전에도 자리를 비우지 않는다** — 칸을 감췄다가 고르는 «순간» 나타나면
   *    아래 구획들이 밀려 화면이 한 번 출렁인다. 무엇을 더 해야 이 칸이 열리는지도 보이지
   *    않는다. 자리는 그대로 두고 **잠가 둔다**(사용자 지시 2026-09-07).
   *
   * ⛔ 여기서 「찍을 수 있는 프린터가 없다」로 그리지 않는다 — 아직 조회하지 않았을 뿐이라
   *    없다고 «단정할» 수 없다(공유계약 G-9).
   */
  if (awaitingKind) {
    return (
      <div className="pop-slabel-printer">
        <span className="field-label">{t.label}</span>
        <Select aria-label={t.label} size="xl" options={[]} disabled />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="pop-slabel-printer">
        <Chip status="error">{t.unknown}</Chip>
        <Button className={popTouchClass('normal')} variant="outlined" size="xl" onClick={onRetry}>
          {t.retry}
        </Button>
      </div>
    );
  }

  // 조회 중에는 아무것도 단정하지 않는다 — 「없음」으로 잠깐 보이면 그 사이 오해가 생긴다.
  if (isLoading) return null;

  if (printers.length === 0) {
    return (
      <div className="pop-slabel-printer">
        <AlertBanner variant="warning">{t.none}</AlertBanner>
      </div>
    );
  }

  const selected = printers.find((printer) => printer.printerName === value) ?? null;

  return (
    <div className="pop-slabel-printer">
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
        <Chip status={CHIP_STATUS[selected.status]}>
          {selected.statusMessage ?? t.noStatusMessage}
        </Chip>
      )}
    </div>
  );
};
