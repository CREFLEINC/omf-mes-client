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
  /** 프린터가 둘 이상인가. 스펙 §5-1 의 「프린터 선택」 활성 조건이다. */
  hasChoice: boolean;
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
 */
export const PrinterStatusIndicator = ({
  printer,
  hasChoice,
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
      {/*
       * 프린터가 둘 이상일 때만 자리를 둔다(스펙 §5-1 활성 조건). ⛔ **고르는 동작을 만들지
       * 않는다** — 설치 구성이 고객 정리 대기라 §8-4 가 「선택 UI 는 자리만」으로 정했다.
       * 감추지 않고 왜 못 고르는지 밝힌다(F-1).
       */}
      {hasChoice ? (
        <Button
          className={popTouchClass('normal')}
          variant="outlined"
          size="xl"
          disabled
          title={t.selectPending}
        >
          {t.select}
        </Button>
      ) : null}
    </div>
  );
};
