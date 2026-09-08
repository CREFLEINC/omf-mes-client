import { Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { popTouchClass } from '../../patterns/pop-touch';
import type { PrinterStatus, PrinterView } from './types';

const t = messages.popMaterialLotLabel.printer;

/**
 * 상태 값을 **색으로만** 옮긴다. 문구는 서버가 준 `statusMessage`를 그대로 쓴다 —
 * 화면이 `status`로 한국어를 지어내면 서버가 값을 늘렸을 때 화면만 모르는 문구가 생긴다.
 */
const CHIP_STATUS: Record<PrinterStatus, 'success' | 'warning' | 'error'> = {
  READY: 'success',
  BUSY: 'warning',
  OFFLINE: 'error',
  ERROR: 'error',
};

export interface PrinterStatusProps {
  printer: PrinterView | null;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

/**
 * 프린터 상태 — **머리에 상시 보인다.**
 *
 * 인쇄가 안 될 때 사용자가 가장 먼저 보는 곳이고, 그것이 없으면 「등록이 안 됐다」고 오해한다
 * (스펙 §3).
 *
 * ⚠ **단말은 이 부품이 그리지 않는다 — 화면이 옆에 칩으로 세운다.** 이름을 받을 경로는 아직
 * 없지만 **단말 번호는 사번 귀속 문맥이 갖고 있고**, 다른 POP 화면이 이미 그것으로 세운다.
 *
 * 세 상태를 **다른 모양으로** 낸다(공유계약 G-9) — 프린터가 없는 것 · 상태를 확인하지 못한 것 ·
 * 상태를 아는 것. 조회 실패를 「없음」으로 내면 사용자가 설치 문제로 오해한다.
 *
 * ⛔ **고르는 자리를 두지 않는다.** 인쇄는 **기본 프린터**로 나간다(사용자 지시 2026-09-08).
 *    스펙 §5-1 이 「프린터 2대 이상이면 선택」을 적었지만 §8-4 가 이미 단일 프린터를 전제로
 *    돌려놓았고, 누를 수 없는 버튼이 자리만 차지해 「왜 못 고르나」를 되묻게 했다.
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
    return <Chip status="warning">{t.none}</Chip>;
  }

  return (
    <div className="pop-lot-status">
      <Chip status={CHIP_STATUS[printer.status]}>
      {`${t.label} ${printer.displayName} · ${printer.statusMessage ?? t.noStatusMessage}`}
    </Chip>
    </div>
  );
};
