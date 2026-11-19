import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { PopSelect as Select } from '../../patterns/pop-select';
import { PuButton, PuNote, PuSection, PuTextArea } from '../../patterns/pop-uniform';
import type { ReasonOption } from './queries';
import { toClockLabel } from './formatting';
import type { BreakdownView } from './types';

const t = messages.downtimeRegister;

export interface ReasonFieldsProps {
  reasonCode: string | null;
  /** ③ 선택지 — 고객의 코드 마스터에서 온다(스펙 §4-A). */
  reasons: readonly ReasonOption[];
  /** 고를 것이 하나도 없다 — 칸을 감추지 않고 «잠근다»(스펙 §6-1 · G-2). */
  reasonsUnavailable: boolean;
  /** 조회가 실패했는가 — 거짓이면 「받았는데 0건」이다(#1094). */
  reasonsFailed: boolean;
  remarks: string;
  breakdownId: number | null;
  breakdowns: readonly BreakdownView[];
  breakdownsUnavailable: boolean;
  isOffline: boolean;
  onReasonChange: (code: string) => void;
  onRemarksChange: (value: string) => void;
  onBreakdownChange: (breakdownId: number | null) => void;
  onApplyStoppedAt: (stoppedAt: string) => void;
}

const toOption = (reason: ReasonOption) => ({ value: reason.code, label: reason.name });

/**
 * 오른쪽 「사유」 구획 — 비가동 사유 · 연결된 고장 · 메모(#295 시안: 칸 이름은 칸 위).
 *
 * ⛔ **고를 것이 없어도 칸을 감추지 않는다**(스펙 §6-1 · `G-2`). 숨기면 왜 저장이 안 되는지
 * 알 수 없다 — 칸은 그대로 두고 **잠그고 사유를 적는다.**
 *
 * ⭐ **사유는 평면 1단이다**(스펙 §7 확정 2026-09-03) — 서버로 가는 것은 `reasonCode` 하나다.
 *
 * ⚠ **고장 연결은 선택이다.** 비가동의 다수는 고장이 아니다(자재 대기·금형 교체). 연결하면
 * 그 고장의 정지 시각을 시작 시각으로 **제안**만 한다 — 자동으로 넣으면 작업자가 확인하지 않은
 * 시각이 구간의 한쪽 끝이 된다.
 */
export const ReasonFields = ({
  reasonCode,
  reasons,
  reasonsUnavailable,
  reasonsFailed,
  remarks,
  breakdownId,
  breakdowns,
  breakdownsUnavailable,
  isOffline,
  onReasonChange,
  onRemarksChange,
  onBreakdownChange,
  onApplyStoppedAt,
}: ReasonFieldsProps) => {
  const titleId = useId();
  const reasonLabelId = useId();
  const breakdownLabelId = useId();
  const remarksLabelId = useId();

  const linked = breakdowns.find((one) => one.breakdownId === breakdownId) ?? null;
  const suggestion = linked?.stoppedAt ?? null;
  const suggestionLabel = suggestion === null ? null : toClockLabel(suggestion);

  return (
    <PuSection title={t.reason.title} labelId={titleId}>
      {/*
       * ⭐ **선택칸은 하나다**(스펙 §7 —「사유 선택 · Select · 1단(2026-09-03 확정)」).
       *    서버로 가는 것은 `reasonCode` 하나다.
       */}
      <div className="pu-field">
        <span className="pu-label">
          <span id={reasonLabelId}>{t.reason.detail}</span>
          <span className="req" aria-hidden>
            *
          </span>
        </span>
        <Select
          aria-labelledby={reasonLabelId}
          placeholder={t.reason.detailPlaceholder}
          value={reasonCode}
          invalid={reasonCode === null || reasonCode === ''}
          /*
           * ⛔ **고를 것이 없으면 칸을 감추지 않고 잠근다**(스펙 §6-1 · `G-2`). 감추면
           * 저장이 왜 막히는지 화면에 남는 것이 없다 — 사유는 `NOT NULL` 이다.
           */
          disabled={reasonsUnavailable}
          options={reasons.map(toOption)}
          onChange={onReasonChange}
        />
        {/* 고를 것이 없는 «이유»는 칸 바로 아래 — 잠긴 칸만으로는 무엇이 잘못인지 모른다. */}
        {reasonsUnavailable && (
          <span className="dt-err">
            {reasonsFailed ? t.errors.reasonsLoadFailed : t.errors.reasonsEmpty}
          </span>
        )}
      </div>

      <div className="pu-field">
        <span className="pu-label">
          <span id={breakdownLabelId}>{t.breakdown.title}</span>
          <span className="opt">{t.reason.optional}</span>
        </span>
        {breakdowns.length === 0 ? (
          <p className="dt-plain">
            {breakdownsUnavailable || isOffline ? t.breakdown.offlineNotice : t.breakdown.empty}
          </p>
        ) : (
          <div className="pu-row">
            <Select
              aria-labelledby={breakdownLabelId}
              placeholder={t.breakdown.select}
              value={breakdownId === null ? null : String(breakdownId)}
              options={breakdowns.map((one) => ({
                value: String(one.breakdownId),
                label: `${one.breakdownNo ?? String(one.breakdownId)} · ${one.symptom}`,
              }))}
              onChange={(value) => {
                onBreakdownChange(Number(value));
              }}
            />
            {linked !== null && (
              <PuButton
                onClick={() => {
                  onBreakdownChange(null);
                }}
              >
                {t.breakdown.detach}
              </PuButton>
            )}
          </div>
        )}
      </div>

      {/*
       * 정지 시각 **제안**. 넣을지는 작업자가 정한다 — 고장을 접수한 사람과 비가동을 적는
       * 사람이 다를 수 있고, 그 시각이 이 구간의 시작인지는 현장이 안다.
       */}
      {suggestion !== null && suggestionLabel !== null && (
        <PuNote
          action={
            <PuButton
              size="sm"
              onClick={() => {
                onApplyStoppedAt(suggestion);
              }}
            >
              {t.breakdown.applySuggestion}
            </PuButton>
          }
        >
          {t.breakdown.suggestStart(suggestionLabel)}
        </PuNote>
      )}

      {/* ⭐ **메모는 한 줄이다**(스펙 §3 도면). 긴 사연은 칸 안에서 스크롤한다. */}
      <div className="pu-field">
        <span className="pu-label">
          <span id={remarksLabelId}>{t.reason.remarks}</span>
          <span className="opt">{t.reason.optional}</span>
        </span>
        <PuTextArea
          aria-labelledby={remarksLabelId}
          className="dt-memo"
          rows={1}
          placeholder={t.reason.remarksPlaceholder}
          value={remarks}
          onChange={(event) => {
            onRemarksChange(event.target.value);
          }}
        />
      </div>
    </PuSection>
  );
};
