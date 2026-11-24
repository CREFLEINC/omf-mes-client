import { Button, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

const t = messages.iqcInspection.result.followUp;

const SUPPLIER_RETURN_PATH = '/logistics/supplier-return';

export interface RejectedLotGuideProps {
  nonconformanceId: number | null;
}

/**
 * 불량 LOT 의 다음 처리 안내(omf-all-around#106 후속 (나)) — 「재검사」 단추 자리에 선다.
 * 불량 LOT 의 재검 회차는 확정할 수 없다(문의 088 · 직행 전이를 열지 않았다). 불합격 확정이 세운 부적합(P-41)은
 * 바로 아래 부적합 처분 상자에서 판정하고(omf-all-around#354), 그 밖은 공급사 반품으로 잇는다.
 */
export const RejectedLotGuide = ({ nonconformanceId }: RejectedLotGuideProps) => {
  const navigate = useNavigate();

  return (
    /* 안내 · 단추 차례는 사용자 시안(2026-11-09). */
    <section className="iqc-inspection-rejected-guide" aria-label={t.title}>
      <h4>
        <Icon name="info" size={20} aria-hidden />
        {t.title}
      </h4>
      <p>{t.body}</p>
      {nonconformanceId === null && <p className="field-note">{t.noNonconformance}</p>}
      <div className="iqc-inspection-rejected-guide-actions">
        <Button
          type="button"
          variant="outlined"
          className="app-button-neutral"
          size="md"
          onClick={() => void navigate(SUPPLIER_RETURN_PATH)}
        >
          {t.toSupplierReturn}
        </Button>
      </div>
    </section>
  );
};
