import { Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
import type { Printer, PrinterStatus } from './types';

const t = messages.popLotLabelPrint.printer;

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

export interface PrinterStatusProps {
  printer: Printer | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

/**
 * 프린터 상태 — **머리에 상시 보인다**(스펙 §3 · K-3).
 *
 * 인쇄가 안 될 때 사용자가 가장 먼저 보는 곳이고, 그것이 없으면 「등록이 안 됐다」고 오해한다.
 *
 * ⛔ **단말 이름은 그리지 않는다.** 스펙은 머리에 함께 그리지만 계약에 단말 이름을 받을 경로가
 * 없다 — 없는 값을 지어내지 않는다(전례 `P-01-01` 과 같은 판단).
 *
 * ⚠ **프린터 오프라인은 출력을 막지 않는다**(스펙 §6 · K-4). 기록은 남고 인쇄만 실패하므로
 * 여기서는 **빨강으로 알리기만** 한다 — 액션 비활성은 이 부품의 일이 아니다.
 *
 * 세 상태를 다른 모양으로 낸다(공유계약 G-9) — 없는 것 · 확인하지 못한 것 · 아는 것.
 */
export const PrinterStatusIndicator = ({
  printer,
  isLoading,
  isError,
  onRetry,
}: PrinterStatusProps) => {
  if (isError) {
    return (
      <div className="pop-lot-status">
        <Chip status="error">{t.unknown}</Chip>
        <Button className={popTouchClass('normal')} variant="outlined" size="xl" onClick={onRetry}>
          {t.retry}
        </Button>
      </div>
    );
  }

  // 조회 중에는 아무것도 단정하지 않는다 — 「없음」으로 잠깐 보이면 그 사이 오해가 생긴다.
  if (isLoading) return null;

  if (printer === null) {
    return (
      <div className="pop-lot-status">
        <Chip status="warning">{t.none}</Chip>
      </div>
    );
  }

  return (
    <div className="pop-lot-status">
      <p className="pop-printer-name">
        <span className="pop-printer-label">{t.label}</span>
        <span>{printer.displayName}</span>
      </p>
      <Chip status={CHIP_STATUS[printer.status]}>{printer.statusMessage ?? t.noStatusMessage}</Chip>
    </div>
  );
};
