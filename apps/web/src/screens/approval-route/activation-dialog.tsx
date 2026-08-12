import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

const t = messages.approvalRoute;

/** 무엇을 하려는가. 두 조작이 말해야 하는 사실이 서로 달라 창 하나를 갈래로 쓴다. */
export type ActivationIntent = 'deactivate' | 'activate';

export interface ActivationDialogProps {
  intent: ActivationIntent;
  /** 무엇이 막히는지·열리는지를 말할 때 쓰는 이름. **내부 번호가 아니라 승인 유형 코드다.** */
  approvalTypeCode: string;
  /** 결재선 응답이 실어 온 파생값. **화면이 세지 않는다** — 셀 수 있는 조회가 없다. */
  inProgressCount: number;
  stepCount: number;
  isSaving: boolean;
  /** 저장 실패 배너 슬롯. 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다. */
  banner: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 사용 전환 확인 창.
 *
 * **이 화면에서 창을 두는 조작은 이것뿐이다**(그리고 초안 파기). 비움 경고를 창으로 두지 않은
 * 이유와 같은 잣대다 — 결재선 수정은 다시 저장하면 되돌릴 수 있지만, **끄기가 만드는 것은
 * 다른 사람의 업무 중단**이다. 그 유형의 상신이 전부 거부된다.
 *
 * **끄기를 막지 않는다.** 계약에 이 오퍼레이션의 400 응답이 아예 없어 진행 중인 요청이
 * 있어도 중지가 허용된다 — 화면의 경고가 유일한 방어이고, 그래서 경고는 막는 대신
 * **무엇이 일어나는지를 정확히** 말한다.
 *
 * **켜기는 막는다.** 계약이 단계 0과 활성 중복을 각각 400으로 막으므로 화면이 먼저 막고,
 * 이 창은 그 판정을 지난 뒤에만 열린다.
 *
 * **창 안에 선택칸을 두지 않는다.** 창 본문이 펼침 목록을 자르는 결함(#45 ·
 * DS `design-system-v2-webui#68`)이 아직 고쳐지지 않았다 — 고칠 수 없는 결함은
 * 걸릴 자리를 만들지 않는 것으로 피한다. 여기 필요한 것은 문장 셋과 버튼 둘뿐이다.
 *
 * **나가는 길을 바닥 버튼 둘로 좁힌다.** 되돌리기에 다른 사람의 업무가 걸린 확인 창이
 * 실수로 사라지면 사용자는 자기가 무엇을 취소했는지 모른다 — 그 이유는 스크림에만이 아니라
 * **창 머리의 X 손잡이에도 그대로** 적용된다. 디자인 시스템은 그것을 기본으로 그리고
 * **진행 상태를 받지 않아 전송 중에도 눌린다** — 한쪽 문만 잠그면 잠근 적이 없는 것과 같다.
 *
 * **Escape는 막지 못한다.** native `<dialog>`가 `cancel`을 내고 디자인 시스템이 그것을
 * 닫기 요청으로 무조건 잇는다. 그래서 이 창의 규율은 「닫히지 않게」가 아니라
 * **「닫혀도 나가는 요청이 무너지지 않게」**이고, 그 몫은 창을 여닫는 쪽(`screen.tsx`)에 있다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ActivationDialog = ({
  intent,
  approvalTypeCode,
  inProgressCount,
  stepCount,
  isSaving,
  banner,
  onClose,
  onConfirm,
}: ActivationDialogProps) => {
  const isDeactivate = intent === 'deactivate';

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
          <p>{t.dialog.deactivateBlocks(approvalTypeCode)}</p>
          {/*
           * **진행 중 건수를 여기서 되풀이한다.** 폼에도 상시로 서 있지만, 끄기를 결정하는
           * 순간에 「이미 돌고 있는 것들은 어떻게 되나」가 가장 궁금해지는 자리다.
           */}
          <p>
            {inProgressCount === 0
              ? t.dialog.deactivateInProgressNone
              : t.dialog.deactivateInProgress(inProgressCount)}
          </p>
          {/* 되돌릴 수 있다는 사실이 이 결정의 무게를 정한다 — 물리 삭제와 갈리는 자리다. */}
          <p>{t.dialog.deactivateReversible}</p>
        </>
      ) : (
        <>
          <p>{t.dialog.activateOpens(approvalTypeCode)}</p>
          <p>{t.dialog.activateStepCount(stepCount)}</p>
        </>
      )}
    </Dialog>
  );
};
