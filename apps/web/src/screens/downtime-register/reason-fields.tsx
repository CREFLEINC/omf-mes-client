import { AlertBanner, Button, Card, Select, TextArea } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { PLACEHOLDER_REASONS, type DowntimeReason } from './downtime-reasons';
import { toClockLabel } from './formatting';
import type { BreakdownView } from './types';

const t = messages.downtimeRegister;

export interface ReasonFieldsProps {
  reasonCode: string | null;
  remarks: string;
  breakdownId: number | null;
  breakdowns: readonly BreakdownView[];
  breakdownsUnavailable: boolean;
  isOffline: boolean;
  reasonInvalid: boolean;
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
 * ⭐ **사유는 평면 1단이다**(스펙 §7 확정 2026-09-03) — 서버로 가는 것은 `reasonCode` 하나다.
 *
 * ⚠ **고장 연결은 선택이다.** 비가동의 다수는 고장이 아니다(자재 대기·금형 교체). 연결하면
 * 그 고장의 정지 시각을 시작 시각으로 **제안**만 한다 — 자동으로 넣으면 작업자가 확인하지 않은
 * 시각이 구간의 한쪽 끝이 된다.
 */
export const ReasonFields = ({
  reasonCode,
  remarks,
  breakdownId,
  breakdowns,
  breakdownsUnavailable,
  isOffline,
  reasonInvalid,
  onReasonChange,
  onRemarksChange,
  onBreakdownChange,
  onApplyStoppedAt,
}: ReasonFieldsProps) => {
  const reasonLabelId = useId();
  const breakdownLabelId = useId();
  const remarksLabelId = useId();

  const linked = breakdowns.find((one) => one.breakdownId === breakdownId) ?? null;
  const suggestion = linked?.stoppedAt ?? null;
  const suggestionLabel = suggestion === null ? null : toClockLabel(suggestion);

  return (
    <Card bordered className="pop-section pop-fixed downtime-pane">
      <section className="downtime-section" aria-label={t.reason.title}>
        <h2 className="pane-title">{t.reason.title}</h2>

        {/*
         * ⭐ **선택칸은 하나다**(스펙 §7 —「사유 선택 · Select · 1단(2026-09-03 확정)」).
         *    한때 대분류로 한 번 좁히고 소분류를 골랐는데, 서버로 가는 것은 `reasonCode`
         *    하나이고 대분류 값을 정한 문서가 없다 — 있지도 않은 축을 손이 한 번 더 거쳐야
         *    했다.
         */}
        <div className="downtime-field-row">
          <span className="downtime-field-label" id={reasonLabelId}>
            {t.reason.detail}
          </span>
          <Select
            size="xl"
            aria-labelledby={reasonLabelId}
            placeholder={t.reason.detailPlaceholder}
            value={reasonCode}
            invalid={reasonInvalid}
            options={PLACEHOLDER_REASONS.map(toOption)}
            onChange={onReasonChange}
          />

          {/*
           * 목록이 아직 서버에서 오지 않았다는 사실은 **고르는 칸 옆**에 선다 — 제 줄을 가지면
           * 36px 을 쓰고, 그만큼이 아래 「오늘 이 설비」에서 나온다(§3-1 예산 초과 · 요청서).
           */}
          <p className="downtime-placeholder-notice">{t.reason.placeholderNotice}</p>
        </div>

        {/*
          사유를 고르지 않은 채 저장을 누른 상태. 칸 테두리만 붉히면 무엇이 모자란지 말하지
          않는 것이라, 문장을 함께 세운다.
        */}
        {reasonInvalid && <p className="downtime-field-error">{t.errors.reasonRequired}</p>}

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
        {/*
         * ⭐ **메모는 한 줄이다**(스펙 §3 도면 —「메모 [ ]」). 두 줄로 두고 라벨까지 위에
         *    얹으면 ③ 이 몫 200px 을 52px 넘기고, 그만큼 아래 ④ 「오늘 이 설비」가 줄어든다.
         *    긴 사연은 칸 안에서 스크롤한다 — 적는 일이 드물고, 늘 자리를 차지할 일은 아니다.
         *
         * ⚠ 라벨을 줄 왼쪽으로 옮겨도 **읽어 주는 이름은 그대로 「메모」**다.
         */}
        <div className="downtime-field-row downtime-remarks-row">
          <span className="downtime-field-label" id={remarksLabelId}>
            {t.reason.remarks}
          </span>
          <TextArea
            aria-labelledby={remarksLabelId}
            size="xl"
            fullWidth
            rows={1}
            placeholder={t.reason.remarksPlaceholder}
            value={remarks}
            onChange={(event) => {
              onRemarksChange(event.target.value);
            }}
          />
        </div>
      </section>
    </Card>
  );
};
