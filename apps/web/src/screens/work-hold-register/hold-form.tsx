import { Button, Card, Radio, RadioGroup, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { HOLD_REASONS } from './hold-reasons';
import type { HoldDraft } from './hold-draft';

const t = messages.workHoldRegister;

export interface HoldFormProps {
  draft: HoldDraft;
  disabled: boolean;
  /** 중단을 걸 수 있는가 — 세션이 «진행 중»일 때만이다(스펙 §6). */
  canStop: boolean;
  /** 재개할 수 있는가 — 세션이 «중단» 상태일 때만이다(스펙 §6). */
  canResume: boolean;
  /** 고르지 않고 등록을 눌렀을 때 뜨는 말. 누르기 전에는 `null`이다. */
  error: string | null;
  /**
   * 사번을 모르는가. **모르면 두 버튼을 다 막는다** — 헤더가 비면 서버가 거부하는데(D-5),
   * 큐에 담긴 뒤의 거부는 작업자가 화면을 떠난 뒤에 온다. 막고 그 이유를 여기서 말한다.
   */
  workerUnknown: boolean;
  onReasonChange: (code: string) => void;
  onRemarksChange: (value: string) => void;
  onStop: () => void;
  onResume: () => void;
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
export const HoldForm = ({
  draft,
  disabled,
  canStop,
  canResume,
  error,
  workerUnknown,
  onReasonChange,
  onRemarksChange,
  onStop,
  onResume,
}: HoldFormProps) => {
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
          않는다(판정은 `hold-draft.ts`). 「임시 목록」은 상시 선다 — 사실의 성격이 다르다.
        */}
        {error !== null && (
          <p className="pop-hold-error" role="alert">
            {error}
          </p>
        )}
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

        {/*
          ⛔ **적은 것이 어디로 가는지 숨기지 않는다.** 담을 칸이 계약에 없어 이번에는 서버로
          나가지 않는다 — 말하지 않으면 작업자는 남았다고 믿고, 뒤에 그것을 찾는 사람이 없다.
        */}
        <p className="pop-hold-note">{t.form.remarksNotSaved}</p>

        {/*
          ⭐ **두 버튼을 함께 세우고 상태로 가른다.** 하나를 숨기면 지금 세션이 어느 쪽인지
          화면에서 사라져, 눌러 본 뒤에야 안다(스펙 §6 — 「이미 중단 상태면 재개만 활성」).
        */}
        {workerUnknown && <p className="pop-hold-note">{t.form.workerRequired}</p>}

        <div className="pop-hold-actions">
          <Button size="lg" disabled={disabled || workerUnknown || !canStop} onClick={onStop}>
            {t.form.stopAction}
          </Button>
          <Button
            variant="outlined"
            size="lg"
            disabled={disabled || workerUnknown || !canResume}
            onClick={onResume}
          >
            {t.form.resumeAction}
          </Button>
        </div>
      </section>
    </Card>
  );
};
