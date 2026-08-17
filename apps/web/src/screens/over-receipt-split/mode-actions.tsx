import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { SplitMode } from './types';

const t = messages.overReceiptSplit;

export interface ModeActionsProps {
  /** 갈래별 잠금 사유. `null`이면 그 갈래로 보낼 수 있다 */
  blockReasons: Record<SplitMode, string | null>;
  isSaving: boolean;
  /** 지금 보내는 중인 갈래. 그 버튼만 진행을 밝힌다 */
  savingMode: SplitMode | null;
  onSubmit: (mode: SplitMode) => void;
  onCancel: () => void;
}

interface ModeButton {
  mode: SplitMode;
  label: string;
}

/**
 * 갈래는 셋이고 **차례가 업무 순서다** — 나눠 담는 것이 이 화면의 본래 목적이고,
 * 한쪽만 저장하는 둘은 그것이 성립하지 않을 때의 갈림길이다.
 */
const MODE_BUTTONS: ModeButton[] = [
  { mode: 'BOTH', label: t.actions.registerBoth },
  { mode: 'NORMAL_ONLY', label: t.actions.registerNormalOnly },
  { mode: 'EXCESS_ONLY', label: t.actions.registerExcessOnly },
];

/**
 * 세 갈래 등록 버튼과 취소.
 *
 * **셋을 함께 낸다.** 「분리 등록」만 두면 초과분을 받지 않기로 한 사용자가 「정량분만 저장」을
 * 찾지 못해 분리 등록으로 처리한다 — 되돌릴 수 없는 잘못된 전표가 남는다.
 *
 * **한 버튼도 주 액션으로 강조하지 않는다.** 계약이 `mode`에 기본값을 두지 않았고
 * (이슈 §6) 셋은 서로 대신할 수 없는 갈래다 — 하나만 채워 그리면 그것이 기본값처럼 읽혀
 * 사용자가 나머지 둘을 보지 않는다. 규범 4-4가 요구하는 「사유가 붙는 비활성 버튼의
 * 테두리」도 이 표현이 함께 만족한다.
 *
 * **전송 중에는 취소까지 잠근다**(계획 결정 13). 공통 쓰기 훅이 호출마다 새 멱등 키를 만들어
 * 연타가 그대로 전표 두 벌이 되고, 되돌리려면 승인을 거쳐야 해서 화면이 고칠 수 없다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ModeActions = ({
  blockReasons,
  isSaving,
  savingMode,
  onSubmit,
  onCancel,
}: ModeActionsProps) => {
  const reasonId = useId();
  const createPoReasonId = `${reasonId}-create-po`;

  return (
    <div className="form-actions">
      {/*
       * **여기서 시작하지 않는 보조 액션이다.** 줄 왼쪽 끝에 두어 등록 갈래와 섞이지 않게 한다
       * (배치 규범 4 — `.form-actions-secondary`).
       *
       * 갈 화면은 이제 있지만 **이 자리에서는 열지 않는다.** 정산할 초과분 전표가 정해지기 전에
       * 열면 「무엇을 정산하는지 모르는 발주 등록」이 되고 그것이 곧 일반 구매 발주 등록이다
       * (착수 이슈 §6 ①). 길은 **등록 결과 구획**에 전표마다 선다(`created-receipts-pane.tsx`).
       *
       * **버튼으로 둔다** — 링크로 두면 맥락 없는 진입 경로가 생기고, 감추면 발주를 못 찾은
       * 사용자가 다음에 할 것을 모른다. 잠금은 유지하고 사유가 그 사정을 말한다.
       */}
      <div className="field-cell form-actions-secondary">
        <Button variant="outlined" disabled aria-describedby={createPoReasonId}>
          {t.actions.createPurchaseOrder}
        </Button>
        <span id={createPoReasonId} className="field-note">
          {t.actionReasons.createPurchaseOrderUnavailable}
        </span>
      </div>

      {/* 취소가 등록 갈래보다 앞에 선다 — 되돌릴 수 없는 것이 손 가까이 있으면 안 된다. */}
      <Button variant="text" disabled={isSaving} onClick={onCancel}>
        {messages.common.cancel}
      </Button>

      {MODE_BUTTONS.map(({ mode, label }) => {
        const reason = blockReasons[mode];
        const modeReasonId = `${reasonId}-${mode}`;

        return (
          <div className="field-cell" key={mode}>
            <Button
              variant="outlined"
              disabled={reason !== null || isSaving}
              loading={savingMode === mode}
              aria-describedby={reason === null ? undefined : modeReasonId}
              onClick={() => {
                onSubmit(mode);
              }}
            >
              {label}
            </Button>
            {reason !== null && (
              <span id={modeReasonId} className="field-note">
                {reason}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
