import { Button, Dialog } from '@crefle/web-ui';
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
 * 「수정」은 검사 기준 화면을 새 탭으로 그 기준 · 버전에 연다 — 고치는 규칙(작성중 버전 · 확정 · 이력)은 그 화면 하나가 맡고,
 * 검사 중이던 입력은 이 탭에 그대로 남는다. 검사 기준 화면 권한이 없으면 단추를 두지 않는다.
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
      onClose={onClose}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {messages.common.close}
          </Button>
          {canEdit && (
            <Button
              variant="filled"
              onClick={() =>
                window.open(
                  `${STANDARD_PATH}?plan=${String(version.inspectionPlanId)}&ver=${String(version.inspectionPlanVersionId)}`,
                  '_blank',
                  'noopener',
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
        <dl className="parts-iqc-kv">
          <div>
            <dt>{t.target.plan}</dt>
            <dd>{planCode}</dd>
          </div>
          <div>
            <dt>{t.target.planName}</dt>
            <dd>{planName}</dd>
          </div>
          <div>
            <dt>{t.target.itemName}</dt>
            <dd>{itemLabel}</dd>
          </div>
          <div>
            <dt>{t.plan.version}</dt>
            <dd>{t.plan.versionValue(version.planVersion, version.effectiveFrom)}</dd>
          </div>
          <div>
            <dt>{t.plan.sampling}</dt>
            <dd>{sampling}</dd>
          </div>
          <div>
            <dt>{t.plan.aqlAcceptance}</dt>
            <dd>
              {`AQL ${version.aqlValue == null ? '-' : String(version.aqlValue)} · C=${
                version.acceptanceNumber == null ? '-' : String(version.acceptanceNumber)
              }`}
            </dd>
          </div>
        </dl>

        <div className="parts-iqc-grid-scroll">
          <table className="parts-iqc-history">
            <thead>
              <tr>
                <th scope="col">{t.visual.checkNo}</th>
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
                    <td className="parts-iqc-plan-name">{spec.inspectionItemName}</td>
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
                    <td>{spec.measurementCount}</td>
                    <td>{spec.acceptanceNumber ?? '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {drawings}
      </div>
    </Dialog>
  );
};
