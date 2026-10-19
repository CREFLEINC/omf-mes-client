import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

const t = messages.iqcInspection.result.followUp;

/** 처분 판정(W-03-10) 진입 — 그 화면이 이 질의로 부적합을 고른다. 다른 슬라이스를 참조하지 않고 경로만 안다. */
const dispositionPath = (nonconformanceId: number | null): string =>
  nonconformanceId === null
    ? '/quality/dispositions'
    : `/quality/dispositions?nonconformanceId=${String(nonconformanceId)}`;
const SUPPLIER_RETURN_PATH = '/logistics/supplier-return';

export interface RejectedLotGuideProps {
  nonconformanceId: number | null;
}

/**
 * 불량 LOT 의 다음 처리 안내(omf-all-around#106 후속 (나)) — 「재검사」 단추 자리에 선다.
 * 불량 LOT 의 재검 회차는 확정할 수 없다(문의 088 · 직행 전이를 열지 않았다). 불합격 확정이 세운 부적합(P-41)의
 * 처분 판정이나 공급사 반품으로 잇는다.
 */
export const RejectedLotGuide = ({ nonconformanceId }: RejectedLotGuideProps) => {
  const navigate = useNavigate();

  return (
    <AlertBanner className="iqc-inspection-submit-banner" variant="info" title={t.title}>
      <p>{t.body}</p>
      {nonconformanceId === null && <p className="field-note">{t.noNonconformance}</p>}
      <div className="form-actions">
        <Button
          type="button"
          size="md"
          onClick={() => void navigate(dispositionPath(nonconformanceId))}
        >
          {t.toDisposition}
        </Button>
        <Button
          type="button"
          variant="outlined"
          size="md"
          onClick={() => void navigate(SUPPLIER_RETURN_PATH)}
        >
          {t.toSupplierReturn}
        </Button>
      </div>
    </AlertBanner>
  );
};
