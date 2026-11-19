import { messages } from '@omf-mes/i18n';
import { useState, type ReactNode } from 'react';

import { useInspectionGuide } from '../../patterns/inspection-guide';
import {
  PuBand,
  PuButton,
  PuChip,
  PuDialog,
  PuIcon,
  PuKv,
  type PuBandItem,
  type PuIconName,
} from '../../patterns/pop-uniform';
import { labelOfCode, type CodeOption } from '../oqc-inspection/code-options';
import {
  formatDateTime,
  orderedRounds,
  type InspectionRequestDetail,
  type InspectionResultRound,
} from '../oqc-inspection/types';
import { judgmentTone } from './judgment';

const t = messages.popOqcInspection.detail;
const r = messages.popOqcInspection.result;
const hub = messages.common.inspectionHub;
const emptyValue = messages.oqcInspection.queue.emptyValue;

export interface PopRequestBandProps {
  detail: InspectionRequestDetail;
  /** 앞 회차 이력 — 재검사 중에만 넘긴다(판정 결과 화면은 아래에 회차별 결과를 따로 보인다). */
  history?: InspectionResultRound[];
  judgmentOptions: readonly CodeOption[];
  /** 작업 구획이 넓은가(2단계 · 판정 결과) — 한 줄에 넷씩. */
  wide: boolean;
}

const label = (icon: PuIconName, text: string): ReactNode => (
  <>
    <PuIcon name={icon} />
    {text}
  </>
);

/**
 * 고른 의뢰의 정보 띠(#295) — [상세보기] 대신 작업 구획 위쪽에 늘 보인다.
 *
 * 보이는 값은 W-04-03 의 대상 정보와 같다. 대상 유형만 표시명으로 바꾸고(모르는 코드는 그대로),
 * 이름을 받지 못하는 식별자(품목·대상·LOT·기준)는 번호임을 `#` 으로 드러낸다.
 * [기준 조회]는 적용 기준 창 — 검사 안내 문구(omf-all-around#252)를 그 안에 보인다.
 */
export const PopRequestBand = ({ detail, history, judgmentOptions, wide }: PopRequestBandProps) => {
  const [planOpen, setPlanOpen] = useState(false);
  const guides = useInspectionGuide(detail.inspectionRequestId).data ?? [];
  const typeLabel = t.targetTypes[detail.targetTypeCode] ?? detail.targetTypeCode;
  const planId = detail.inspectionPlanVersionId;
  const canViewPlan = planId !== null || guides.length > 0;

  const items: PuBandItem[] = [
    {
      label: label('file', t.fields.requestNo),
      value: <span className="pu-mono">{detail.inspectionRequestNo}</span>,
    },
    { label: label('clock', t.fields.requestedAt), value: formatDateTime(detail.requestedAt) },
    { label: label('box', t.fields.item), value: t.idValue(detail.itemId) },
    { label: label('shield', t.fields.inspectionType), value: detail.inspectionTypeCode },
    { label: label('check', t.fields.targetQty), value: String(detail.targetQty) },
    {
      label: label('swap', t.fields.target),
      value: t.target(typeLabel, detail.targetId),
    },
    {
      label: label('list', t.fields.lot),
      value: detail.lotId === null ? emptyValue : t.idValue(detail.lotId),
    },
    {
      label: label('file', t.fields.plan),
      value: (
        <span className="oqc-vrow">
          <span>{planId === null ? t.noPlanVersion : t.idValue(planId)}</span>
          {canViewPlan && (
            <PuButton
              size="sm"
              onClick={() => {
                setPlanOpen(true);
              }}
            >
              {t.viewPlan}
            </PuButton>
          )}
        </span>
      ),
    },
  ];

  if (history !== undefined && history.length > 0) {
    items.push({
      wide: true,
      label: label('clock', t.fields.history),
      value: (
        <span className="oqc-hist">
          {orderedRounds(history).map((round) => (
            <span key={round.inspectionResultId} className="oqc-hist-item">
              <PuChip tone={judgmentTone(round.overallJudgmentCode)}>
                {r.round(round.inspectionRound)} ·{' '}
                {labelOfCode(judgmentOptions, round.overallJudgmentCode)}
              </PuChip>
              <small>
                {r.summary.accepted} {String(round.acceptedQty)} · {r.summary.rejected}{' '}
                {String(round.rejectedQty)} · {r.summary.held} {String(round.heldQty)}
                {round.confirmedAt !== null &&
                  ` · ${r.confirmedAt(formatDateTime(round.confirmedAt))}`}
              </small>
            </span>
          ))}
        </span>
      ),
    });
  }

  return (
    <div className={wide ? 'oqc-band is-wide' : 'oqc-band'}>
      <PuBand grid={wide ? 4 : 3} items={items} label={t.bandLabel} />
      {planOpen && (
        <PuDialog
          title={planId === null ? t.planTitle : `${t.planTitle} · ${t.idValue(planId)}`}
          wide
          onClose={() => {
            setPlanOpen(false);
          }}
        >
          <PuKv
            items={[
              { label: t.fields.inspectionType, value: detail.inspectionTypeCode },
              {
                label: t.planNo,
                value: planId === null ? t.noPlanVersion : t.planValue(planId),
              },
              {
                label: t.guide,
                value:
                  guides.length === 0 ? (
                    t.noGuide
                  ) : (
                    <span className="oqc-guide">
                      {guides.map((guide) => (
                        <span key={guide.scopeCode}>
                          {guides.length > 1 && (
                            <b>{guide.scopeCode === 'COMMON' ? hub.guideCommon : hub.guideItem}</b>
                          )}
                          {guide.text}
                        </span>
                      ))}
                    </span>
                  ),
              },
            ]}
          />
        </PuDialog>
      )}
    </div>
  );
};
