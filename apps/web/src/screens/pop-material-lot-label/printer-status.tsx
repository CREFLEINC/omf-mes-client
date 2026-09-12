import { Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { isServerBaselineBuild } from '../../patterns/pop-server-baseline';
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

/**
 * 배포본에서 `OFFLINE` 을 **경고로 낮춘다**(#1095 · 대응표 P1 「프린터 상태」).
 *
 * 서버 구현 기준선에는 프린터 상태를 실제로 모으는 축이 없어 `statusCode` 가 **항상
 * `OFFLINE`** 이다. 그대로 붉게 칠하면 정상 인쇄 중에도 오류 색이 상시 떠 있고, 그것은
 * 사용자에게 「이 칩은 늘 빨갛다」를 가르친다 — 서버가 상태를 모으기 시작해 «진짜» 연결
 * 끊김이 왔을 때 아무도 그 색을 보지 않는다.
 *
 * ⛔ **색만 낮춘다 — 문구는 그대로 서버 것을 쓴다.** 「정상」이라고 바꿔 말하지 않는다.
 * 모르는 것을 통과로 처리하지 않는다(F-6).
 */
const chipStatusOf = (status: PrinterStatus): 'success' | 'warning' | 'error' =>
  status === 'OFFLINE' && isServerBaselineBuild() ? 'warning' : CHIP_STATUS[status];

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
      <Chip status={chipStatusOf(printer.status)}>
        {`${t.label} ${printer.displayName} · ${printer.statusMessage ?? t.noStatusMessage}`}
      </Chip>
    </div>
  );
};
