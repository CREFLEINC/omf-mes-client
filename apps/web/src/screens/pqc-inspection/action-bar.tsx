import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

/**
 * 액션바 — 화면 스펙 §3 이 **화면 아래 고정 88** 로 둔 자리다.
 *
 * ⛔ **폼 중간에 흘리지 않는다.** 터치 단말은 손이 닿는 자리가 정해져 있어야 하고, 스크롤
 * 하다 버튼을 놓치면 검사자가 저장할 자리를 찾아 헤맨다. 스크롤 구획은 좌측 항목 하나뿐이며
 * (E-4) 이 바는 제자리에 남는다.
 *
 * ⛔ **잠긴 버튼만 두지 않는다**(G-3). 막혔으면 **무엇이** 막혔는지 왼쪽에 함께 세운다 —
 * 회색 버튼만 있으면 검사자는 단말이 고장 난 줄 안다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.pqcInspection.result;

export interface ActionBarProps {
  /** 확정이 막혔다면 **무엇이** 막혔는지. 풀렸으면 `null` */
  blockedReason: string | null;
  /** 저장이 막혔다면 그 사유. 막는 것은 수량이 아닌 값이 남아 있을 때뿐이다 */
  saveBlockedReason: string | null;
  /** 마지막 저장이 성공했는가. 눌렀는데 아무 일도 없어 보이지 않게 한 줄로 알린다 */
  isSaved: boolean;
  /**
   * **방금** 확정했는가. 확정된 회차라는 «상태»와 다르다 — 상태는 어제 확정된 회차에도
   * 참이라, 그것으로 결과를 알리면 화면에 들어올 때마다 방금 한 일처럼 말한다.
   */
  isJustConfirmed: boolean;

  onSave: () => void;
  onConfirm: () => void;
}

export const ActionBar = ({
  blockedReason,
  saveBlockedReason,
  isSaved,
  isJustConfirmed,
  onSave,
  onConfirm,
}: ActionBarProps) => (
  <div className="pop-action-bar">
    <div className="pop-action-note">
      {/*
       * ⛔ **확정은 되돌릴 수 없다** — 누르기 전에 그 사실을 알린다. 이 순간 LOT 상태가
       * 전이하고 되돌릴 경로가 없다.
       */}
      <p className="field-note">{t.confirmNote}</p>

      {/* 눌렀는데 아무 일도 없어 보이지 않게 결과를 한 줄로 알린다. */}
      {isSaved && <p className="field-note">{t.saved}</p>}
      {isJustConfirmed && <p className="field-note">{t.confirmSucceeded}</p>}

      {saveBlockedReason !== null && <p className="field-note">{saveBlockedReason}</p>}
      {/* 막혔으면 «무엇이» 막혔는지 밝힌다 — 잠긴 버튼만 두지 않는다. */}
      {blockedReason !== null && <p className="field-note">{blockedReason}</p>}
    </div>

    {/*
     * ⛔ **「저장 중」이 없다.** 담는 순간이 곧 성공이라(공유계약 C-1 #2) 기다리는 구간 자체가
     * 생기지 않는다 — 보내는 일은 outbox 가 뒤에서 하고, 닿았는지는 머리의 미동기 건수가
     * 말한다. 여기서 버튼을 잠그면 통신이 끊긴 단말에서 검사자가 두 번째 항목을 저장하지
     * 못한다.
     */}
    <Button type="button" variant="outlined" size="xl" onClick={onSave}>
      {t.save}
    </Button>
    <Button
      type="button"
      variant="filled"
      size="xl"
      disabled={blockedReason !== null}
      onClick={onConfirm}
    >
      {t.confirm}
    </Button>
  </div>
);
