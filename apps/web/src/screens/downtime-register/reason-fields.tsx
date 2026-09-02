import { AlertBanner, Button, Card, Select, TextArea } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import {
  PLACEHOLDER_REASON_CATEGORIES,
  reasonsOfCategory,
  type DowntimeReason,
} from './downtime-reasons';
import { toClockLabel } from './formatting';
import type { BreakdownView } from './types';

const t = messages.downtimeRegister;

export interface ReasonFieldsProps {
  categoryCode: string | null;
  reasonCode: string | null;
  remarks: string;
  breakdownId: number | null;
  breakdowns: readonly BreakdownView[];
  breakdownsUnavailable: boolean;
  isOffline: boolean;
  reasonInvalid: boolean;
  onCategoryChange: (code: string) => void;
  onReasonChange: (code: string) => void;
  onRemarksChange: (value: string) => void;
  onBreakdownChange: (breakdownId: number | null) => void;
  onApplyStoppedAt: (stoppedAt: string) => void;
}

const toOption = (reason: DowntimeReason) => ({ value: reason.code, label: reason.name });

/**
 * ③ 사유 · 연결 고장 · 메모.
 *
 * ⛔ **사유 목록이 임시라는 사실을 감추지 않는다.** 필드를 숨기면 왜 저장이 안 되는지 알 수
 * 없고, 아무 말 없이 목록만 보이면 확정된 체계로 읽힌다. 칸은 그대로 두고 **임시임을 적는다.**
 *
 * ⭐ **대분류는 소분류를 좁히는 화면의 장치다** — 서버로 가는 것은 소분류 코드 하나다.
 *
 * ⚠ **고장 연결은 선택이다.** 비가동의 다수는 고장이 아니다(자재 대기·금형 교체). 연결하면
 * 그 고장의 정지 시각을 시작 시각으로 **제안**만 한다 — 자동으로 넣으면 작업자가 확인하지 않은
 * 시각이 구간의 한쪽 끝이 된다.
 */
export const ReasonFields = ({
  categoryCode,
  reasonCode,
  remarks,
  breakdownId,
  breakdowns,
  breakdownsUnavailable,
  isOffline,
  reasonInvalid,
  onCategoryChange,
  onReasonChange,
  onRemarksChange,
  onBreakdownChange,
  onApplyStoppedAt,
}: ReasonFieldsProps) => {
  const categoryLabelId = useId();
  const reasonLabelId = useId();
  const breakdownLabelId = useId();

  const linked = breakdowns.find((one) => one.breakdownId === breakdownId) ?? null;
  const suggestion = linked?.stoppedAt ?? null;
  const suggestionLabel = suggestion === null ? null : toClockLabel(suggestion);

  return (
    <Card>
      <section className="downtime-section" aria-label={t.reason.title}>
        <h2 className="pane-title">{t.reason.title}</h2>

        <div className="downtime-field-row">
          <span className="downtime-field-label" id={categoryLabelId}>
            {t.reason.category}
          </span>
          <Select
            size="xl"
            aria-labelledby={categoryLabelId}
            placeholder={t.reason.categoryPlaceholder}
            value={categoryCode}
            options={PLACEHOLDER_REASON_CATEGORIES.map((category) => ({
              value: category.code,
              label: category.name,
            }))}
            onChange={onCategoryChange}
          />

          <span className="downtime-field-label" id={reasonLabelId}>
            {t.reason.detail}
          </span>
          <Select
            size="xl"
            aria-labelledby={reasonLabelId}
            placeholder={t.reason.detailPlaceholder}
            value={reasonCode}
            invalid={reasonInvalid}
            /* 대분류를 고르기 전에는 고를 것이 없다 — 빈 목록을 열어 보이지 않는다. */
            disabled={categoryCode === null}
            options={reasonsOfCategory(categoryCode).map(toOption)}
            onChange={onReasonChange}
          />
        </div>

        {/*
          사유를 고르지 않은 채 저장을 누른 상태. 칸 테두리만 붉히면 무엇이 모자란지 말하지
          않는 것이라, 문장을 함께 세운다.
        */}
        {reasonInvalid && <p className="downtime-field-error">{t.errors.reasonRequired}</p>}

        {/* 값 목록이 확정되기 전이라는 사실. 저장이 막히는 이유가 여기 있다. */}
        <p className="downtime-placeholder-notice">{t.reason.placeholderNotice}</p>

        <div className="downtime-field-row">
          <span className="downtime-field-label" id={breakdownLabelId}>
            {t.breakdown.title}
          </span>
          {breakdowns.length === 0 ? (
            <p className="downtime-field-value">
              {breakdownsUnavailable || isOffline ? t.breakdown.offlineNotice : t.breakdown.empty}
            </p>
          ) : (
            <>
              <Select
                size="xl"
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
                <Button
                  variant="outlined"
                  size="lg"
                  onClick={() => {
                    onBreakdownChange(null);
                  }}
                >
                  {t.breakdown.detach}
                </Button>
              )}
            </>
          )}
        </div>

        {/*
         * 정지 시각 **제안**. 넣을지는 작업자가 정한다 — 고장을 접수한 사람과 비가동을 적는
         * 사람이 다를 수 있고, 그 시각이 이 구간의 시작인지는 현장이 안다.
         */}
        {suggestion !== null && suggestionLabel !== null && (
          <AlertBanner
            variant="info"
            action={
              <Button
                variant="outlined"
                size="sm"
                onClick={() => {
                  onApplyStoppedAt(suggestion);
                }}
              >
                {t.breakdown.applySuggestion}
              </Button>
            }
          >
            {t.breakdown.suggestStart(suggestionLabel)}
          </AlertBanner>
        )}

        {/* 여러 줄 입력은 `TextArea`다 — `TextField`에 그런 변형이 있었던 적이 없다. */}
        <TextArea
          label={t.reason.remarks}
          size="xl"
          fullWidth
          rows={2}
          placeholder={t.reason.remarksPlaceholder}
          value={remarks}
          onChange={(event) => {
            onRemarksChange(event.target.value);
          }}
        />
      </section>
    </Card>
  );
};
