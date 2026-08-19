import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { ActivationIntent, RemainingCoverage } from './activation-guard';

const t = messages.putawayRule;

export interface ActivationDialogProps {
  intent: ActivationIntent;
  /** 무엇을 끄는지·켜는지. **내부 번호가 아니라 풀린 이름이다**(`omf-mes#44`). */
  itemLabel: string;
  /** `null`인 위치는 「창고 전체」로 풀려 온다 — 그 판정은 화면이 하고 창은 결과만 받는다. */
  locationLabel: string;
  /**
   * 끄고 나면 이 창고·품목에 남는 사용 중인 규칙. **끄기 갈래에서만 읽는다.**
   * 화면이 조준 조회로 판정해 넘긴다(`activation-guard.ts`) — 창이 세지 않는다.
   */
  remaining: RemainingCoverage;
  isSaving: boolean;
  /** 저장 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다. */
  banner: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 사용 전환 확인 창 — **한 창을 갈래로 쓴다.**
 *
 * ## 왜 끄기에 창을 두는가
 *
 * **계약에 `:deactivate`의 400이 아예 없다** — 업무 규칙으로 막히지 않는다. 그러니 화면의
 * 경고가 유일한 방어이고, 그래서 이 창은 막는 대신 **무엇이 일어나는지를 정확히** 말한다.
 * 규칙을 끄면 그 품목의 적치가 「확인 후 통과」로 떨어질 수 있다(공유계약 G-12 규칙 2).
 *
 * ## ⚠ 파급을 **갈래 없이** 말하지 않는다
 *
 * 「끄면 현장에서 위치 검증 없이 통과합니다」는 **이것이 그 품목의 마지막 활성 규칙일 때만**
 * 참이다. 같은 품목에 다른 활성 규칙이 남으면 그 규칙들이 그대로 적용된다 — 늘 세우면 화면이
 * 확인하지 않은 사실을 단언하게 되고, 그 경고를 몇 번 겪은 사용자는 다음 경고도 흘려 읽는다.
 * 세 갈래(`none` · `some` · `unknown`)를 각각 다른 문장으로 낸다.
 *
 * ## 창의 경계
 *
 * - **창 안에 선택칸을 두지 않는다** — 창 본문이 펼침 목록을 자르는 결함이 아직 있다
 *   (`design-system-v2-webui#68`). 여기 필요한 것은 문장 셋과 버튼 둘뿐이다.
 * - **나가는 길을 바닥 버튼 둘로 좁힌다** — 스크림뿐 아니라 **창 머리의 X 손잡이**도 막는다.
 *   그 손잡이는 진행 상태를 받지 않아 전송 중에도 눌리며, 한쪽 문만 잠그면 잠근 적이 없는
 *   것과 같다.
 * - **Escape는 막지 못한다.** native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을
 *   닫기 요청으로 무조건 잇는다. 그래서 이 창의 규율은 「닫히지 않게」가 아니라
 *   **「닫혀도 나가는 요청이 무너지지 않게」**이고, 그 몫은 창을 여닫는 쪽(`screen.tsx`)에 있다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ActivationDialog = ({
  intent,
  itemLabel,
  locationLabel,
  remaining,
  isSaving,
  banner,
  onClose,
  onConfirm,
}: ActivationDialogProps) => {
  const isDeactivate = intent === 'deactivate';

  /**
   * 끄기의 파급 한 줄. **세 갈래가 서로 다른 사실을 말한다** —
   * 「마지막이다」 · 「남는 것이 있다」 · 「확인하지 못했다」.
   */
  const coverageText = (): string => {
    if (remaining.kind === 'none') return t.dialog.deactivateLastRule;
    if (remaining.kind === 'some') return t.dialog.deactivateRemaining(remaining.count);

    return t.dialog.deactivateCoverageUnknown;
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      closeOnBackdropClick={false}
      showCloseButton={false}
      title={isDeactivate ? t.dialog.deactivateTitle : t.dialog.activateTitle}
      footer={
        <>
          <Button variant="outlined" disabled={isSaving} onClick={onClose}>
            {messages.common.cancel}
          </Button>
          {/* 문구가 「확인」이 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */}
          <Button loading={isSaving} disabled={isSaving} onClick={onConfirm}>
            {isDeactivate ? messages.common.deactivate : t.actions.activate}
          </Button>
        </>
      }
    >
      {banner}

      {isDeactivate ? (
        <>
          <p>{t.dialog.deactivateTarget(itemLabel, locationLabel)}</p>
          <p>{coverageText()}</p>
          <p>{t.dialog.deactivateReversible}</p>
        </>
      ) : (
        <>
          <p>{t.dialog.activateTarget(itemLabel, locationLabel)}</p>
          {/* 켜기는 덮개를 묻지 않는다 — 켜면 덮개가 **느는** 것이라 물음 자체가 성립하지 않는다. */}
          <p>{t.dialog.activateApplies}</p>
        </>
      )}
    </Dialog>
  );
};
