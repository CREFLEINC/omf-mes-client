import { Button, Chip, Dialog } from '@crefle/web-ui';
import { useNavigate } from 'react-router';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { InspectionDrawingImages } from '../../patterns/inspection-drawings';
import { useSession } from '../../patterns/session';
import { withUom } from '../iqc-inspection/uom-lookup';
import { toWebAccess } from '../../patterns/web-access';
import { specLines } from './measurement-table';

type ItemSpec = components['schemas']['InspectionItemSpec'];
type PlanVersion = components['schemas']['InspectionPlanVersion'];

const t = messages.partsIqcInspection;
/** 검사 기준 화면 — 「수정」이 이 주소로 그 기준 · 버전을 연다(`plan` · `ver` 는 그 화면의 주소 칸이다). */
const STANDARD_PATH = '/master-data/inspection-standard';

export interface PlanDialogProps {
  planCode: string;
  itemParts: { code: string; name: string } | null;
  version: PlanVersion;
  specs: ItemSpec[];
  /** 항목 단위 코드 — 규격 값 뒤에 붙인다(사용자 지시 2026-11-19 · omf-all-around#296). 없으면 단위 없이. */
  uomCodeOf?: (uomId: number) => string | null;
  /**
   * 검사 회차 — 입하 LOT 결과 창에서 열면 그 회차, 상세에서 열면 마지막으로 기록한 회차(`null` 이면 「-」 ·
   * 사용자 지시 2026-11-18 · 11-19 · omf-all-around#296). 넘기지 않으면(옛 흐름) 칸을 두지 않는다.
   */
  seqNo?: number | null;
  /** 기준서 도면 — 검사 화면과 같은 그림을 그대로 보인다. */
  drawings: React.ReactNode;
  onClose: () => void;
  /**
   * 「수정」 — 넘기지 않으면 검사 기준 화면으로 바로 옮긴다. PQC · OQC 는 저장 안 한 입력을 먼저 묻는 길(`useLeaveFor`)로 넘긴다(#353).
   */
  onEdit?: (href: string) => void;
  /** 품목 두 칸 이름 — IQC 는 「자재 코드 No.」·「자재명」(기본), PQC · OQC 는 「품목코드」·「품목명」(#353). */
  itemLabels?: { code: string; name: string };
}

/**
 * 검사 기준 조회(사용자 지시 2026-10-30) — IQC 검사 중에 이 의뢰에 걸린 검사기준 버전을 팝업으로 본다. 읽기 전용이다.
 * 「수정」은 검사 기준 화면으로 바로 옮겨 그 기준 · 버전을 연다(새 창 없이 · 사용자 지시 2026-10-30) — 고치는 규칙(작성중 버전 ·
 * 확정 · 이력)은 그 화면 하나가 맡는다. 검사 기준 화면 권한이 없으면 단추를 두지 않는다.
 */
export const PlanDialog = ({
  planCode,
  itemParts,
  version,
  specs,
  uomCodeOf,
  seqNo,
  drawings,
  onClose,
  onEdit,
  itemLabels = { code: t.target.itemCode, name: t.target.itemName },
}: PlanDialogProps) => {
  const { session } = useSession();
  const navigate = useNavigate();
  const canEdit = toWebAccess(session?.permissions).allows(STANDARD_PATH);
  const sampling =
    version.samplingMethodCode === 'FULL_INSPECTION'
      ? t.plan.full
      : version.samplingRatio != null
        ? t.plan.ratio(version.samplingRatio)
        : version.samplingQty != null
          ? t.plan.qty(version.samplingQty)
          : '-';

  /* 검사 화면 위쪽 기본 정보와 같은 칸 — 이름표 위 · 값 아래, 칸 사이 세로선(#247 · 사용자 지시 2026-11-10). */
  /* 긴 자재명은 첫 줄을 통째로, 짧은 값은 둘째 줄에 나란히 — 한 칸만 외따로 내려가지 않게(사용자 지시 2026-11-23 · #353). */
  /* 품목은 이름 · 코드 두 칸(품목 표기 분리) — 긴 이름이 첫 줄을 통째로, 코드는 둘째 줄 첫 칸. */
  const facts: { label: string; value: string; emphasized?: boolean; wide?: boolean }[] = [
    { label: itemLabels.name, value: itemParts?.name ?? '-', emphasized: true, wide: true },
    { label: itemLabels.code, value: itemParts?.code ?? '-' },
    { label: t.plan.facts.planCode, value: planCode },
    { label: t.plan.version, value: t.plan.versionNo(version.planVersion) },
    ...(seqNo === undefined
      ? []
      : [{ label: t.plan.seq, value: seqNo === null ? '-' : t.plan.seqNo(seqNo) }]),
    { label: t.plan.sampling, value: sampling },
    { label: t.plan.facts.effectiveFrom, value: version.effectiveFrom },
  ];

  return (
    <Dialog
      open
      size="lg"
      title={t.plan.title}
      showCloseButton={false}
      onClose={onClose}
      footer={
        <>
          <Button variant="outlined" onClick={onClose}>
            {messages.common.close}
          </Button>
          {canEdit && (
            <Button
              variant="filled"
              onClick={() => {
                const href = `${STANDARD_PATH}?plan=${String(version.inspectionPlanId)}&ver=${String(version.inspectionPlanVersionId)}`;
                if (onEdit === undefined) void navigate(href);
                else onEdit(href);
              }}
            >
              {t.plan.edit}
            </Button>
          )}
        </>
      }
    >
      <div className="parts-iqc-plan">
        {/* 정보 · 검사 항목 · 기준서 도면을 각각 테두리 상자로, 아이콘 없이(#247 · 사용자 지시 2026-11-10). */}
        <dl className="parts-iqc-facts">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className={
                fact.wide === true ? 'parts-iqc-fact parts-iqc-fact-wide' : 'parts-iqc-fact'
              }
            >
              <dt className="field-label">{fact.label}</dt>
              <dd className={fact.emphasized === true ? 'parts-iqc-fact-key' : undefined}>
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>

        <section className="parts-iqc-card" aria-labelledby="parts-iqc-plan-items">
          <div className="parts-iqc-block-head">
            <h3 id="parts-iqc-plan-items">
              {t.plan.items}
              {specs.length > 0 && (
                <>
                  {' '}
                  <span className="parts-iqc-muted">{t.plan.itemCount(specs.length)}</span>
                </>
              )}
            </h3>
            {/* 항목이 없으면 빈 표 대신 「검사 항목 미등록」 — 아래 「도면 미등록」과 같은 모양(사용자 지시 2026-11-26). */}
            {specs.length === 0 && <span className="parts-iqc-muted">{t.plan.itemsNone}</span>}
          </div>
          {specs.length > 0 && (
            <div className="parts-iqc-grid-scroll">
              {/* 검사 화면 표와 같은 칸 선 · 가운데 정렬. 방법 칸은 항목 유형 라벨(선택형 · 수치형 · 텍스트형). */}
              <table className="parts-iqc-grid parts-iqc-plan-table">
                <thead>
                  <tr>
                    <th scope="col" className="parts-iqc-item">
                      {t.plan.no}
                    </th>
                    <th scope="col">{t.visual.checkItem}</th>
                    <th scope="col">{t.plan.method}</th>
                    <th scope="col">{t.dimension.spec}</th>
                    <th scope="col">{t.plan.count}</th>
                    <th scope="col">{t.plan.acceptance}</th>
                  </tr>
                </thead>
                <tbody>
                  {specs.map((spec, index) => {
                    const [nominal, range] = specLines(spec);
                    /* 단위는 항목 이름이 아니라 규격 값 뒤에(사용자 지시 2026-11-19 · omf-all-around#296). */
                    const unit =
                      spec.uomId == null || uomCodeOf === undefined ? null : uomCodeOf(spec.uomId);
                    const withUnit = (value: string): string =>
                      value === '-' ? value : withUom(value, unit);
                    return (
                      <tr key={spec.inspectionItemSpecId}>
                        <td>{index + 1}</td>
                        <td>{spec.inspectionItemName}</td>
                        <td>
                          <Chip
                            variant="status"
                            size="sm"
                            status={spec.dataTypeCode === 'BOOLEAN' ? 'info' : 'idle'}
                          >
                            {t.plan.dataTypeOf[spec.dataTypeCode] ?? spec.dataTypeCode}
                          </Chip>
                        </td>
                        <td className="parts-iqc-plan-spec">
                          {spec.dataTypeCode === 'NUMERIC'
                            ? nominal === '' || range === nominal
                              ? withUnit(nominal || range)
                              : `${withUnit(nominal)} (${withUnit(range)})`
                            : t.plan.okNg}
                        </td>
                        {/* 「차수」 — 항목마다 정한 측정 횟수를 숫자만(사용자 지시 2026-11-19 · omf-all-around#296). */}
                        <td>{spec.measurementCount}</td>
                        <td>{spec.acceptanceNumber ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {drawings}
      </div>
    </Dialog>
  );
};

/** 기준서 도면 — 검사 화면 · 기준 상세 창이 같은 그림을 보인다. */
export const DrawingImages = ({
  drawings,
}: {
  drawings: { attachmentId: number; blob: Blob }[];
}) => (
  <section className="parts-iqc-card" aria-label={t.drawing.heading}>
    <div className="parts-iqc-block-head">
      <h3>{t.drawing.heading}</h3>
      {drawings.length === 0 && <span className="parts-iqc-muted">{t.drawing.none}</span>}
    </div>
    {drawings.length === 0 ? null : (
      <InspectionDrawingImages
        drawings={drawings}
        altOf={t.drawing.alt}
        labels={{ prev: t.drawing.prev, next: t.drawing.next }}
      />
    )}
  </section>
);
