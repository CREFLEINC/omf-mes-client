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

  isSaving: boolean;
  isConfirming: boolean;
  /** 확정된 회차 — 이때 할 수 있는 일은 재검사뿐이다 */
  isLocked: boolean;
  isReinspecting: boolean;

  onSave: () => void;
  onConfirm: () => void;
  onStartReinspection: () => void;
  onCancelReinspection: () => void;
}

export const ActionBar = ({
  blockedReason,
  saveBlockedReason,
  isSaved,
  isJustConfirmed,
  isSaving,
  isConfirming,
  isLocked,
  isReinspecting,
  onSave,
  onConfirm,
  onStartReinspection,
  onCancelReinspection,
}: ActionBarProps) => (
  <div className="pop-action-bar">
    <div className="pop-action-note">
      {/*
       * ⛔ **확정은 되돌릴 수 없다** — 누르기 전에 그 사실을 알린다. 이 순간 LOT 상태가
       * 전이하고 되돌릴 경로가 없다.
       */}
      {!isLocked && <p className="field-note">{t.confirmNote}</p>}

      {/* 눌렀는데 아무 일도 없어 보이지 않게 결과를 한 줄로 알린다. */}
      {isSaved && <p className="field-note">{t.saved}</p>}
      {isJustConfirmed && <p className="field-note">{t.confirmSucceeded}</p>}

      {saveBlockedReason !== null && <p className="field-note">{saveBlockedReason}</p>}
      {/* 막혔으면 «무엇이» 막혔는지 밝힌다 — 잠긴 버튼만 두지 않는다. */}
      {blockedReason !== null && <p className="field-note">{blockedReason}</p>}
    </div>

    {/*
     * ⛔ **확정된 회차에서 유일하게 할 수 있는 일이 재검사다.** 잠긴 사유만 내고 길을 내지
     * 않으면, 문면이 「재검사 회차를 추가합니다」라고 말하는데 추가할 자리가 화면에 없다.
     */}
    {isLocked ? (
      <Button type="button" variant="outlined" size="xl" onClick={onStartReinspection}>
        {t.reinspect}
      </Button>
    ) : (
      <>
        {/* 그만두는 길을 함께 둔다 — 열고 나서 되돌아갈 데가 없으면 갇힌다. */}
        {isReinspecting && (
          <Button
            type="button"
            variant="text"
            size="xl"
            disabled={isSaving || isConfirming}
            onClick={onCancelReinspection}
          >
            {t.reinspectCancel}
          </Button>
        )}
        <Button
          type="button"
          variant="outlined"
          size="xl"
          disabled={isSaving || isConfirming}
          onClick={onSave}
        >
          {isSaving ? t.saving : t.save}
        </Button>
        <Button
          type="button"
          variant="filled"
          size="xl"
          disabled={blockedReason !== null || isSaving || isConfirming}
          onClick={onConfirm}
        >
          {isConfirming ? t.confirming : t.confirm}
        </Button>
      </>
    )}
  </div>
);
