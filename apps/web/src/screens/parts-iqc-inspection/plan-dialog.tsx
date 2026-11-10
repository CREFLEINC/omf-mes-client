import { Button, Chip, Dialog } from '@crefle/web-ui';
import { useNavigate } from 'react-router';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { specLines } from './measurement-table';

type ItemSpec = components['schemas']['InspectionItemSpec'];
type PlanVersion = components['schemas']['InspectionPlanVersion'];

const t = messages.partsIqcInspection;
/** 검사 기준 화면 — 「수정」이 이 주소로 그 기준 · 버전을 연다(`plan` · `ver` 는 그 화면의 주소 칸이다). */
const STANDARD_PATH = '/master-data/inspection-standard';

export interface PlanDialogProps {
  planCode: string;
  planName: string;
  itemParts: { code: string; name: string } | null;
  version: PlanVersion;
  specs: ItemSpec[];
  /** 기준서 도면 — 검사 화면과 같은 그림을 그대로 보인다. */
  drawings: React.ReactNode;
  onClose: () => void;
}

/**
 * 검사 기준 조회(사용자 지시 2026-10-30) — IQC 검사 중에 이 의뢰에 걸린 검사기준 버전을 팝업으로 본다. 읽기 전용이다.
 * 「수정」은 검사 기준 화면으로 바로 옮겨 그 기준 · 버전을 연다(새 창 없이 · 사용자 지시 2026-10-30) — 고치는 규칙(작성중 버전 ·
 * 확정 · 이력)은 그 화면 하나가 맡는다. 검사 기준 화면 권한이 없으면 단추를 두지 않는다.
 */
export const PlanDialog = ({
  planCode,
  planName,
  itemParts,
  version,
  specs,
  drawings,
  onClose,
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
  const facts: { label: string; value: string; sub?: string }[] = [
    { label: t.plan.facts.planCode, value: planCode },
    { label: t.plan.facts.planName, value: planName },
    { label: t.plan.version, value: t.plan.versionNo(version.planVersion) },
    {
      label: t.target.itemName,
      value: itemParts?.name ?? '-',
      ...(itemParts === null ? {} : { sub: itemParts.code }),
    },
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
              onClick={() =>
                navigate(
                  `${STANDARD_PATH}?plan=${String(version.inspectionPlanId)}&ver=${String(version.inspectionPlanVersionId)}`,
                )
              }
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
            <div key={fact.label} className="parts-iqc-fact">
              <dt className="field-label">{fact.label}</dt>
              <dd className={fact.sub === undefined ? undefined : 'parts-iqc-fact-key'}>
                {fact.value}
                {fact.sub !== undefined && <span className="parts-iqc-fact-sub">{fact.sub}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <section className="parts-iqc-card" aria-labelledby="parts-iqc-plan-items">
          <div className="parts-iqc-block-head">
            <h3 id="parts-iqc-plan-items">
              {t.plan.items}{' '}
              <span className="parts-iqc-muted">{t.plan.itemCount(specs.length)}</span>
            </h3>
          </div>
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
                            ? nominal || range
                            : `${nominal} (${range})`
                          : t.plan.okNg}
                      </td>
                      <td>{spec.measurementCount}</td>
                      <td>{spec.acceptanceNumber ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {drawings}
      </div>
    </Dialog>
  );
};
