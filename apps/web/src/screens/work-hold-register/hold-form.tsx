import { Card, Radio, RadioGroup, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { HOLD_REASONS } from './hold-reasons';
import type { HoldDraft } from './hold-draft';

const t = messages.workHoldRegister;

export interface HoldFormProps {
  draft: HoldDraft;
  disabled: boolean;
  onReasonChange: (code: string) => void;
  onRemarksChange: (value: string) => void;
}

/**
 * 《중단 등록》 구획의 입력(스펙 §3 · §4-A).
 *
 * ⭐ **사유는 라디오다** — 목록이 7값으로 고정이고 장갑 낀 손으로 한 번에 고른다. 접히는
 * 선택 상자로 두면 열고·훑고·고르는 세 동작이 된다(스펙 §7 DS 매핑).
 *
 * ⚠ **사유 목록은 임시다**(착수 이슈 §4). 그 사실을 목록 옆에 적는다 — 적지 않으면 현장에서
 * 「우리 사유가 없다」를 결함으로 신고한다.
 */
export const HoldForm = ({ draft, disabled, onReasonChange, onRemarksChange }: HoldFormProps) => {
  const legendId = useId();

  return (
    <Card>
      <section aria-label={t.form.sectionLabel}>
        <h2 className="pane-title">{t.form.sectionLabel}</h2>

        <p className="pop-hold-field-label" id={legendId}>
          {t.form.reasonLabel}
        </p>

        <RadioGroup
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
          ⚠ 「사유를 고르세요」는 등록을 누른 «뒤»에 뜬다 — 빈 화면을 붉은 글씨로 맞이하지
          않는다. 그 버튼이 아직 없어 이 자리도 아직 서지 않는다(판정은 `hold-draft.ts`).
          「임시 목록」은 상시 선다 — 사실의 성격이 다르다.
        */}
        <p className="pop-hold-note">{t.form.reasonProvisional}</p>

        <TextField
          label={t.form.remarksLabel}
          placeholder={t.form.remarksPlaceholder}
          size="xl"
          disabled={disabled}
          value={draft.remarks}
          onChange={(event) => {
            onRemarksChange(event.target.value);
          }}
        />
      </section>
    </Card>
  );
};
