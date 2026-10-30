import { Button, Dialog } from '@crefle/web-ui';
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
  itemLabel: string;
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
  itemLabel,
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
        {/* 정보 — 세 칸 격자, 자재명은 한 줄 전체(사용자 시안 2026-10-30) */}
        <dl className="parts-iqc-kv parts-iqc-plan-facts">
          <div>
            <dt>{t.target.plan}</dt>
            <dd>{planCode}</dd>
          </div>
          <div>
            <dt>{t.target.planName}</dt>
            <dd>{planName}</dd>
          </div>
          <div>
            <dt>{t.plan.version}</dt>
            <dd>{t.plan.versionValue(version.planVersion, version.effectiveFrom)}</dd>
          </div>
          <div className="parts-iqc-kv-wide">
            <dt>{t.target.itemName}</dt>
            <dd>{itemLabel}</dd>
          </div>
          <div>
            <dt>{t.plan.sampling}</dt>
            <dd>{sampling}</dd>
          </div>
          <div>
            <dt>{t.plan.aqlAcceptance}</dt>
            <dd>
              {t.plan.aqlAcceptanceValue(
                version.aqlValue == null ? '-' : String(version.aqlValue),
                version.acceptanceNumber ?? null,
              )}
            </dd>
          </div>
        </dl>

        <section className="parts-iqc-plan-items" aria-labelledby="parts-iqc-plan-items">
          <h3 id="parts-iqc-plan-items">
            {t.plan.items} <span className="parts-iqc-muted">{t.plan.itemCount(specs.length)}</span>
          </h3>
          <div className="parts-iqc-grid-scroll">
            <table className="parts-iqc-plan-table">
              <thead>
                <tr>
                  <th scope="col">{t.visual.checkNo}</th>
                  <th scope="col">{t.visual.checkItem}</th>
                  <th scope="col">{t.plan.method}</th>
                  <th scope="col">{t.dimension.spec}</th>
                  <th scope="col" className="is-num">
                    {t.plan.count}
                  </th>
                  <th scope="col" className="is-num">
                    {t.plan.acceptance}
                  </th>
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
                        {t.plan.methodOf[spec.inspectionMethodCode ?? ''] ??
                          spec.inspectionMethodCode ??
                          '-'}
                      </td>
                      <td>
                        {spec.dataTypeCode === 'NUMERIC'
                          ? nominal === '' || range === nominal
                            ? nominal || range
                            : `${nominal} (${range})`
                          : t.plan.okNg}
                      </td>
                      <td className="is-num">{spec.measurementCount}</td>
                      <td className="is-num">{spec.acceptanceNumber ?? '—'}</td>
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
