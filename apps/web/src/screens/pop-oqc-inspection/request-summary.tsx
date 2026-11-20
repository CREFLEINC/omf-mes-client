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
import { usePlanVersion } from '../parts-iqc-inspection/queries';
import { withUom } from '../oqc-inspection/uom-lookup';

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
  /** 수량 옆 단위 코드 — 모르면 숫자만. */
  uom: string | null;
}

const label = (icon: PuIconName, text: string): ReactNode => (
  <>
    <PuIcon name={icon} />
    {text}
  </>
);

/** 정보 띠 칸 이름(아이콘 + 글) — 출하 OQC 새 흐름의 머리 띠도 같은 모양으로 쓴다. */
export { label as bandLabel };

/**
 * 고른 의뢰의 정보 띠(#295) — [상세보기] 대신 작업 구획 위쪽에 늘 보인다.
 *
 * 보이는 값은 W-04-03 의 대상 정보와 같다. 대상 유형만 표시명으로 바꾸고(모르는 코드는 그대로),
 * 이름을 받지 못하는 식별자(품목·대상·LOT·기준)는 번호임을 `#` 으로 드러낸다.
 * [기준 조회]는 적용 기준 창 — 검사 안내 문구(omf-all-around#252)를 그 안에 보인다.
 */
export const PopRequestBand = ({
  detail,
  history,
  judgmentOptions,
  wide,
  uom,
}: PopRequestBandProps) => {
  const [planOpen, setPlanOpen] = useState(false);
  const guides = useInspectionGuide(detail.inspectionRequestId).data ?? [];
  const typeLabel = t.targetTypes[detail.targetTypeCode] ?? detail.targetTypeCode;
  const planId = detail.inspectionPlanVersionId;
  const planVersion = usePlanVersion(planId).data;
  /* 버전을 아직 못 읽었으면 번호(#id)로 둔다 — 지어내지 않는다. */
  const planLabel =
    planId === null
      ? t.noPlanVersion
      : planVersion === undefined
        ? t.idValue(planId)
        : t.planVersion(planVersion.planVersion);
  const canViewPlan = planId !== null || guides.length > 0;

  const items: PuBandItem[] = [
    {
      label: label('file', t.fields.requestNo),
      value: <span className="pu-mono">{detail.inspectionRequestNo}</span>,
    },
    { label: label('clock', t.fields.requestedAt), value: formatDateTime(detail.requestedAt) },
    { label: label('box', t.fields.item), value: t.idValue(detail.itemId) },
    { label: label('shield', t.fields.inspectionType), value: detail.inspectionTypeCode },
    { label: label('check', t.fields.targetQty), value: withUom(String(detail.targetQty), uom) },
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
          <span>{planLabel}</span>
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
                {r.summary.accepted} {withUom(String(round.acceptedQty), uom)} ·{' '}
                {r.summary.rejected} {withUom(String(round.rejectedQty), uom)} · {r.summary.held}{' '}
                {withUom(String(round.heldQty), uom)}
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
    <div className={wide ? 'oqc-band pu-band-stack is-wide' : 'oqc-band pu-band-stack'}>
      <PuBand grid={wide ? 4 : 3} items={items} label={t.bandLabel} />
      {planOpen && (
        <PopPlanDialog
          inspectionTypeCode={detail.inspectionTypeCode}
          planId={planId}
          planLabel={planLabel}
          guides={guides}
          onClose={() => {
            setPlanOpen(false);
          }}
        />
      )}
    </div>
  );
};

/**
 * 적용 기준 창 — 검사 유형 · 기준 번호 · 검사 안내(omf-all-around#252). 옛 흐름의 [기준 조회]와 출하 OQC 새 흐름이 함께 쓴다.
 * 새 흐름은 그 기준의 검사 항목(`items`)을 아래에 더 보인다(사용자 지시 2026-11-20).
 */
export const PopPlanDialog = ({
  inspectionTypeCode,
  planId,
  planLabel,
  guides,
  items,
  title,
  onClose,
}: {
  inspectionTypeCode: string;
  planId: number | null;
  planLabel: string;
  guides: ReturnType<typeof useInspectionGuide>['data'] & object;
  items?: ReactNode;
  /** 창 제목 — 없으면 옛 흐름 그대로 「적용 기준 · 버전」. */
  title?: string;
  onClose: () => void;
}) => (
  <PuDialog
    title={title ?? (planId === null ? t.planTitle : `${t.planTitle} · ${planLabel}`)}
    wide
    onClose={onClose}
  >
    <PuKv
      items={[
        { label: t.fields.inspectionType, value: inspectionTypeCode },
        {
          label: t.planNo,
          value: planId === null ? t.noPlanVersion : t.planValue(planLabel),
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
    {items}
  </PuDialog>
);
