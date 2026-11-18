import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { JudgmentConfirmDialog } from '../../patterns/judgment-confirm-dialog';
import { toJudgmentDirection } from './judgment-direction';
import type { TransitionPreview } from './transition-preview';

/**
 * 판정 확정 확인 창 — ⭐ **쓰기는 이 창의 버튼에서만 나간다.**
 *
 * 이 화면의 저장은 한 번이고 되돌릴 수 없다(LOT 상태가 전이하고 보류 해제가 기록된다). 그래서
 * 폼의 버튼은 창을 열 뿐이고, 실제 요청은 여기서 나간다.
 *
 * - 바깥을 눌러 닫히지 않고, **저장 중에는 닫히지 않는다** — 나가 있는 쓰기를 화면만 없던 일로 치면 안 된다
 * - 실패해도 **창을 닫지 않는다** — 같은 창에서 다시 누르면 같은 멱등 키가 나간다
 *
 * 모양은 PQC 와 같은 `JudgmentConfirmDialog`(사용자 시안 2026-11-17 · omf-all-around#286).
 */

const t = messages.oqcInspection.confirm;

export interface ConfirmDialogProps {
  inspectionRequestNo: string;
  /** 고른 판정 코드 — 색 · LOT 상태 글을 고른다 */
  judgmentCode: string;
  /** 고른 판정의 표시명. 목록에 없으면 코드 그대로다 */
  judgmentLabel: string;
  /** 수량 셋 · 방향. `null` 이면 검사 결과 줄을 빼고 판정 코드로만 방향을 말한다 */
  preview: TransitionPreview | null;
  /** 의뢰에 대상 LOT 이 있는가 — 없으면 집은 LOT 의 상태를 말한다. */
  hasLot?: boolean;
  /** 저장 실패 배너 — 창 안에 낸다. 밖에 내면 창에 가려 보이지 않는다 */
  banner: ReactNode;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ConfirmDialog = ({
  inspectionRequestNo,
  judgmentCode,
  judgmentLabel,
  preview,
  hasLot = true,
  banner,
  isSaving,
  onClose,
  onConfirm,
}: ConfirmDialogProps) => (
  <JudgmentConfirmDialog
    inspectionRequestNo={inspectionRequestNo}
    judgmentLabel={judgmentLabel}
    direction={preview?.direction ?? toJudgmentDirection(judgmentCode)}
    quantities={
      preview === null
        ? null
        : { accepted: preview.accepted, rejected: preview.rejected, held: preview.held }
    }
    picked={!hasLot}
    applyLines={[t.applyPicking, t.applyPickedNotReturned]}
    banner={banner}
    isSaving={isSaving}
    onClose={onClose}
    onConfirm={onConfirm}
  />
);
