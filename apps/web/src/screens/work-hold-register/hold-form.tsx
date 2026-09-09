import { Button, Card, Radio, RadioGroup, Skeleton, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import type { HoldDraft } from './hold-draft';
import type { HoldReasonsResult } from './reason-options';

const t = messages.workHoldRegister;

export interface HoldFormProps {
  draft: HoldDraft;
  disabled: boolean;
  reasons: HoldReasonsResult;
  /** 고르지 않고 등록을 눌렀을 때 뜨는 말. 누르기 전에는 `null`이다. */
  error: string | null;
  onReasonChange: (code: string) => void;
  onRemarksChange: (remarks: string) => void;
}

/**
 * 《중단 등록》 구획의 입력(스펙 §3 · §4-A).
 *
 * ⭐ **사유는 라디오다** — 장갑 낀 손으로 한 번에 고른다. 접히는 선택 상자로 두면 열고·훑고·
 * 고르는 세 동작이 된다(스펙 §7 DS 매핑 — 개정판도 이 화면을 `RadioGroup` 으로 남겼다).
 * G-34 의 선택 팝업은 드롭다운·콤보박스형 목록에 걸리는 규칙이라 여기에는 걸리지 않는다.
 *
 * ⚠ **목록은 서버가 준다**(2026-09-06 개정) — 고객이 사유를 늘리므로 값 개수가 고정이 아니다.
 * 늘어나 칸을 넘기면 이 구획 «안에서» 스크롤한다(공유계약 E-4) — 화면 전체가 스크롤하면
 * 액션바가 밀린다.
 *
 * ⚠ **조작은 이 구획이 갖지 않는다** — 화면 바닥의 액션바가 갖는다. 값이 한 줄씩 서면 구획이
 * 화면을 넘겨 버튼이 밖으로 밀렸다(실측 761~833). 액션은 늘 같은 자리에 있어야 한다.
 */
export const HoldForm = ({
  draft,
  disabled,
  reasons,
  error,
  onReasonChange,
  onRemarksChange,
}: HoldFormProps) => {
  const legendId = useId();
  const remarksId = useId();

  return (
    <Card bordered className="pop-section pop-hold-form-card" aria-label={t.form.sectionLabel}>
      <h2 className="pane-title">{t.form.sectionLabel}</h2>

      <p className="pop-hold-field-label" id={legendId}>
        {t.form.reasonLabel}
      </p>

      {reasons.isLoading && <Skeleton height="120px" aria-label={t.form.reasonLoading} />}

      {/*
       * ⛔ **못 받은 것을 빈 목록으로 그리지 않는다.** 「고를 것이 없다」와 「받지 못했다」는
       * 작업자가 할 일이 다르다 — 앞은 마스터를 채워야 하고 뒤는 다시 받아 보면 된다.
       */}
      {!reasons.isLoading && reasons.isError && (
        <p className="pop-hold-error" role="alert">
          {t.form.reasonLoadFailed}{' '}
          <Button variant="outlined" size="sm" onClick={reasons.refetch}>
            {t.errors.retry}
          </Button>
        </p>
      )}

      {!reasons.isLoading && !reasons.isError && reasons.reasons.length === 0 && (
        <p className="field-note">{t.form.reasonEmpty}</p>
      )}

      {/*
       * ⚠ **다 받지 못한 것을 「없다」로 읽히게 두지 않는다.** 이 그룹은 고객이 늘리는
       * 목록이라 쪽을 넘길 수 있는데, 찾는 사유가 안 보이면 현장은 「기타」로 몰아 적는다 —
       * 그 기록은 정정 경로가 없다.
       */}
      {reasons.truncated && <p className="field-note">{t.form.reasonTruncated}</p>}

      {/*
       * ⚠ **값이 한 줄씩 서면 구획이 화면을 넘긴다.** 큰 타겟×7 + 비고 + 버튼이 668px 칸에
       * 753 을 요구해 **[ 중단 등록 ]이 화면 밖(761~833)으로 밀렸다**(실측) — 중단을 등록할
       * 수 없는 화면이었다. 두 열로 접어 담는다.
       */}
      {/*
       * ⛔ **고른 값에 `undefined` 를 주지 않는다.** 그 값은 부품을 «비제어»로 돌려, 등록 뒤
       * 초안을 비워도 **화면에는 고른 표시가 남는다** — 골랐다고 믿고 누른 사람에게 「사유를
       * 고르세요」가 뜬다(실측 2026-09-09). 빈 문자열이라야 「고른 것이 없다」로 제어된다.
       */}
      {!reasons.isLoading && reasons.reasons.length > 0 && (
        <RadioGroup
          className="pop-hold-reasons"
          name="work-hold-reason"
          aria-labelledby={legendId}
          value={draft.reasonCode ?? ''}
          disabled={disabled}
          onChange={onReasonChange}
        >
          {reasons.reasons.map((reason) => (
            <Radio key={reason.code} value={reason.code}>
              {reason.name}
            </Radio>
          ))}
        </RadioGroup>
      )}

      {/*
          ⚠ 「사유를 고르세요」는 등록을 누른 «뒤»에 뜬다 — 빈 화면을 붉은 글씨로 맞이하지 않는다.
        */}
      {error !== null && (
        <p className="pop-hold-error" role="alert">
          {error}
        </p>
      )}

      {/*
       * ⭐ **비고 칸이 섰다**(2026-09-06 게이트 승인). 앞선 판은 담을 자리가 없어 칸 자체를
       * 두지 않았다 — 버릴 것을 받는 칸은 두지 않는 편이 정직했기 때문이다. 이제 **W/O 중단
       * 본문**(`WorkOrderHold.note`)이 받는다.
       *
       * ⛔ **재개에는 이 값을 싣지 않는다** — 스펙 §3 도면이 《중단 등록》 구획에만 그린다.
       */}
      <TextField
        id={remarksId}
        label={t.form.remarksLabel}
        fullWidth
        value={draft.remarks}
        disabled={disabled}
        onChange={(event) => {
          onRemarksChange(event.target.value);
        }}
      />
    </Card>
  );
};
