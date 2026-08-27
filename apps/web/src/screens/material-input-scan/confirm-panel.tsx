import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

const t = messages.materialInputScan;

export interface ConfirmPanelProps {
  hasMaterials: boolean;
}

/**
 * 투입 확정 구획.
 *
 * ⛔ **이번 회차에는 누를 수 없다. 그리고 그것이 결함이 아니다.**
 *
 * 계약이 요구하는 쓰기 본문의 필수 아홉 중 셋을 화면이 채울 근거가 없다 — 투입 유형의 값이
 * 정해지지 않았고, 작업자·단말을 아는 자리가 이 저장소에 아직 없다. 값을 지어 넣으면 **되돌릴
 * 수 없는 기록**에 설계가 승인한 적 없는 값이 남는다(정정이 아니라 새 기록으로만 고칠 수 있다).
 *
 * 그래서 **「비활성 + 사유 표시」**를 택했다 — 버튼을 감추지 않는 이유는, 없으면 작업자가
 * 「이 화면은 투입을 못 하는 화면」으로 읽고 다른 길을 찾기 때문이다. 자리는 서 있고 왜 잠겼는지
 * 말한다.
 *
 * ⚠ **사유가 둘이고 순서가 뜻을 정한다.** 아직 열리지 않았다는 사정이 앞이다 — 뒤에 두면
 * 자재를 담은 작업자가 「담으면 누를 수 있습니다」를 읽고도 잠긴 버튼을 본다.
 */
export const ConfirmPanel = ({ hasMaterials }: ConfirmPanelProps) => {
  const reasonId = useId();

  const reason = hasMaterials ? t.confirm.reasons.notReady : t.confirm.reasons.nothingScanned;

  return (
    <div className="confirm-row">
      {/*
       * 잠긴 버튼은 포커스를 받지 못해 툴팁만으로는 키보드·스크린리더 사용자가 사유에 닿을 수
       * 없다. 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로 잇는다.
       */}
      <Button
        variant="filled"
        size="xl"
        className="pop-touch-target"
        disabled
        aria-describedby={reasonId}
      >
        {t.confirm.action}
      </Button>
      <span id={reasonId} className="field-note">
        {reason}
      </span>
    </div>
  );
};
