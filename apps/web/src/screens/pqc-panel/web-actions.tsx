import { Button, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import {
  JudgmentConfirmDialog,
  type JudgmentConfirmDirection,
} from '../../patterns/judgment-confirm-dialog';

const t = messages.pqcInspectionRegister.web.actions;

/** 판정 → 색 · LOT 상태 글을 고르는 방향. 모르는 코드는 방향을 말하지 않는다. */
const DIRECTION_OF: Record<string, JudgmentConfirmDirection> = {
  ACCEPTED: 'release',
  REJECTED: 'hold',
  HELD: 'pending',
};

export interface WebActionsProps {
  isConfirmed: boolean;
  /** 확인 창에 보일 값 — 의뢰 번호 · 최종 판정 · 수량 셋(omf-all-around#286). */
  confirmInfo: {
    inspectionRequestNo: string;
    judgmentCode: string;
    judgmentLabel: string;
    quantities: { accepted: string; rejected: string; held: string };
  };
  lockedReason: string | null;
  /** 잠근 이유를 이 줄에 적을 것인가 — 회차를 못 읽은 갈래는 위 오류 띠가 이유와 [다시 시도]를 이미 낸다. */
  showLockedNote: boolean;
  confirmBlockedReason: string | null;
  isSending: boolean;
  onConfirm: () => void;
}

/**
 * W-03-11 관리웹 확정 줄(omf-all-around#135) — IQC 판정 화면(#133)과 같은 모양이다.
 * 오른쪽 끝에 [판정 확정](채움), 바로 왼쪽에 지금 상황 한 줄 — 막힌 까닭은 정보색 바탕,
 * 확정 가능하면 「판정 확정 후 수정이 불가합니다」 경고색 바탕(표식·글 폭만큼).
 * 결과 입력 · 저장은 결과 창이 한다(omf-all-around#356) — 이 줄에는 [임시 저장]이 없다.
 */
export const WebActions = ({
  isConfirmed,
  confirmInfo,
  lockedReason,
  showLockedNote,
  confirmBlockedReason,
  isSending,
  onConfirm,
}: WebActionsProps) => {
  /* [판정 확정]은 한 번 묻고 보낸다 — IQC · OQC 와 같다(omf-all-around#286). 보내는 값 · 막는 조건은 그대로다. */
  const [asking, setAsking] = useState(false);

  const blocked =
    lockedReason !== null ? (showLockedNote ? lockedReason : null) : confirmBlockedReason;

  return (
    <div className="pqc-web-actions">
      <div className="pqc-web-action-notes">
        {isConfirmed ? (
          <p className="pqc-web-action-note" data-tone="info">
            <Icon name="info" size={18} aria-hidden />
            {t.confirmed}
          </p>
        ) : (
          <>
            {lockedReason !== null && !showLockedNote ? null : blocked !== null ? (
              <p className="pqc-web-action-note" data-tone="info">
                <Icon name="info" size={18} aria-hidden />
                {blocked}
              </p>
            ) : (
              <p className="pqc-web-action-note" data-tone="warning">
                <Icon name="warning" size={18} aria-hidden />
                {t.confirmNote}
              </p>
            )}
          </>
        )}
      </div>

      <div className="pqc-web-action-buttons">
        <Button
          type="button"
          variant="filled"
          size="md"
          disabled={lockedReason !== null || confirmBlockedReason !== null || isSending}
          onClick={() => setAsking(true)}
        >
          {t.confirm}
        </Button>
      </div>

      {asking && (
        <JudgmentConfirmDialog
          inspectionRequestNo={confirmInfo.inspectionRequestNo}
          judgmentLabel={confirmInfo.judgmentLabel}
          direction={DIRECTION_OF[confirmInfo.judgmentCode] ?? 'unknown'}
          quantities={confirmInfo.quantities}
          /* PQC 는 작업지시 단위라 LOT 전이가 OQC 와 다르다(서버 inspection-confirm.service — 합격만 정상, 불합격은 기준 초과 때만 검사 대기, 보류는 그대로). */
          lotStates={messages.judgmentConfirm.pqcLotState}
          /* 누르는 즉시 창을 닫고 아래 [판정 확정] 단추가 보내는 동안 잠긴다 — 창에는 보내는 중 상태가 없다. */
          isSaving={false}
          onClose={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            onConfirm();
          }}
        />
      )}
    </div>
  );
};
