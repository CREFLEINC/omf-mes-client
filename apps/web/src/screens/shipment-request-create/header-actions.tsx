import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import type { CreatedShipmentRequestView } from './types';

const t = messages.shipmentRequestCreate;

export interface HeaderActionsProps {
  /** 편성이 막힌 사유. `null`이면 열려 있다. */
  submitBlockReason: string | null;
  /** 저장 실패 배너. 인라인으로 소화하지 못한 오류만 남는다(`patterns/master`) */
  banner: ReactNode;
  /** 방금 만든 편성. `null`이면 아직 성공하지 않았다 */
  created: CreatedShipmentRequestView | null;
  onSubmit: () => void;
}

/**
 * 편성 결과 안내와 「출하작업지시 편성」 버튼 — 이 폼의 유일한 액션이다.
 *
 * **성공 뒤에도 배너를 지우지 않는다.** 편성에는 되돌릴 경로가 없고(계약 설명 「편성 취소를
 * 두지 않는다」) 이 화면에 목록으로 돌아가는 다른 진입점이 없어, 방금 만든 번호를 화면에 계속
 * 남겨 두는 것이 사용자가 그 값을 잃지 않는 유일한 방법이다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const HeaderActions = ({
  submitBlockReason,
  banner,
  created,
  onSubmit,
}: HeaderActionsProps) => {
  const reasonId = useId();

  return (
    <>
      {created !== null && (
        <div className="banner-slot">
          <AlertBanner variant="success" title={t.result.title}>
            {t.result.shipmentRequestNo(created.shipmentRequestNo)} ·{' '}
            {t.result.lineCount(created.lineCount)}
          </AlertBanner>
        </div>
      )}

      {banner}

      {/*
       * 잠긴 사유는 감추지 않고 항상 보이는 DOM 텍스트로 렌더해 `aria-describedby`로 잇는다
       * (배치 규범 4) — 잠긴 버튼은 포커스를 받지 못해 툴팁만으로는 닿을 수 없다.
       */}
      <div className="form-actions">
        <div className="field-cell">
          <Button
            disabled={submitBlockReason !== null}
            aria-describedby={submitBlockReason === null ? undefined : reasonId}
            onClick={onSubmit}
          >
            {t.actions.submit}
          </Button>
          {submitBlockReason !== null && (
            <span id={reasonId} className="field-note">
              {submitBlockReason}
            </span>
          )}
        </div>
      </div>
    </>
  );
};
