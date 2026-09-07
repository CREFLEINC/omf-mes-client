import { Card, Radio, RadioGroup } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { HOLD_REASONS } from './hold-reasons';
import type { HoldDraft } from './hold-draft';

const t = messages.workHoldRegister;

export interface HoldFormProps {
  draft: HoldDraft;
  disabled: boolean;
  /** 고르지 않고 등록을 눌렀을 때 뜨는 말. 누르기 전에는 `null`이다. */
  error: string | null;
  onReasonChange: (code: string) => void;
}

/**
 * 《중단 등록》 구획의 입력(스펙 §3 · §4-A).
 *
 * ⭐ **사유는 라디오다** — 목록이 7값으로 고정이고 장갑 낀 손으로 한 번에 고른다. 접히는
 * 선택 상자로 두면 열고·훑고·고르는 세 동작이 된다(스펙 §7 DS 매핑).
 *
 * ⚠ **조작은 이 구획이 갖지 않는다** — 화면 바닥의 액션바가 갖는다. 7값이 한 줄씩 서면
 * 구획이 화면을 넘겨 버튼이 밖으로 밀렸다(실측 761~833). 액션은 늘 같은 자리에 있어야 한다.
 */
export const HoldForm = ({
  draft,
  disabled,
  error,
  onReasonChange,
}: HoldFormProps) => {
  const legendId = useId();

  return (
    <Card>
      <section aria-label={t.form.sectionLabel}>
        <h2 className="pane-title">{t.form.sectionLabel}</h2>

        <p className="pop-hold-field-label" id={legendId}>
          {t.form.reasonLabel}
        </p>

        {/*
         * ⚠ **7값이 한 줄씩 서면 구획이 화면을 넘긴다.** 큰 타겟(56)×7 + 비고 + 버튼이
         * 668px 칸에 753 을 요구해 **[ 중단 등록 ]이 화면 밖(761~833)으로 밀렸다**(실측) —
         * 중단을 등록할 수 없는 화면이었다. 두 열로 접어 4행에 담는다.
         */}
        <RadioGroup
          className="pop-hold-reasons"
          name="work-hold-reason"
          aria-labelledby={legendId}
          value={draft.reasonCode ?? undefined}
          disabled={disabled}
          onChange={onReasonChange}
        >
          {HOLD_REASONS.map((reason) => (
            <Radio key={reason.code} value={reason.code}>
              {reason.name}
            </Radio>
          ))}
        </RadioGroup>

        {/*
          ⚠ 「사유를 고르세요」는 등록을 누른 «뒤»에 뜬다 — 빈 화면을 붉은 글씨로 맞이하지 않는다.
          ⛔ 「중단 사유는 임시 목록입니다」를 걷었다 — 스펙 §5-4 가 `WORK_SESSION_EVENT_REASON`
             7값을 **확정**했다(2026-08-23). 확정된 것을 임시라 말하고 있었다.
        */}
        {error !== null && (
          <p className="pop-hold-error" role="alert">
            {error}
          </p>
        )}

        {/*
         * ⛔ **비고 칸을 두지 않는다.** 스펙 §3 도면은 그리지만 §4-A 의 필드 표에 그 컬럼이
         * 없고 계약의 세션 사건 등록 본문에도 자리가 없다 — **적어도 아무 데도 안 간다.**
         * 앞선 판은 칸을 두고 「비고는 아직 저장되지 않습니다」를 붙였는데, 버릴 것을 받는
         * 칸은 두지 않는 편이 정직하다. 설계가 담을 자리를 정하면 그때 세운다(#77 열림).
         */}

      </section>
    </Card>
  );
};
