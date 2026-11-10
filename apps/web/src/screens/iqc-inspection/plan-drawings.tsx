import { messages } from '@omf-mes/i18n';

import { InspectionDrawingImages, useInspectionDrawings } from '../../patterns/inspection-drawings';

const t = messages.iqcInspection.drawing;

/** 기준서 도면 — 부품 IQC 입력 화면의 「기준서 도면」과 같은 보기(#247 · 사용자 지시 2026-11-10). 없으면 「등록된 도면 없음」. */
export const PlanDrawings = ({ versionId }: { versionId: number | null }) => {
  const drawings = useInspectionDrawings(versionId).data ?? [];
  return (
    <section className="parts-iqc-block" aria-label={t.heading}>
      <div className="parts-iqc-block-head">
        <h3>{t.heading}</h3>
        {drawings.length === 0 && <span className="parts-iqc-muted">{t.none}</span>}
      </div>
      {drawings.length === 0 ? null : (
        <InspectionDrawingImages
          drawings={drawings}
          altOf={t.alt}
          labels={{ prev: t.prev, next: t.next }}
        />
      )}
    </section>
  );
};
