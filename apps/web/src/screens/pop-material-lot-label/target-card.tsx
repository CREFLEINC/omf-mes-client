import { Button, Card } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { popTouchClass } from '../../patterns/pop-touch';
import type { IssueStep } from './mutations';
import { formatLotNo, toIssueStage, type TargetRow } from './types';

const t = messages.popMaterialLotLabel.target;

export interface TargetCardProps {
  row: TargetRow | null;
  itemLookup: LookupSource;
  uomLookup: LookupSource;
  supplierLookup: LookupSource;
  /** 이미 등록된 자재의 LOT 번호. 아직 등록 전이거나 못 읽었으면 `null`. */
  lotNo: string | null;
  isLotNoLoading: boolean;
  isLotNoError: boolean;
  /**
   * 귀속 사번을 확보했는가. **없으면 감추지 않고 비활성 + 사유**로 둔다(공유계약 F-1) —
   * 쓰기가 이 헤더를 요구하므로 부르면 서버가 거부한다.
   */
  hasWorkerNo: boolean;
  /** 진행 중인 걸음. 쉬는 중이면 `null`. */
  runningStep: IssueStep | null;
  onIssue: () => void;
  onReissue: () => void;
}

/**
 * 발번 대상 — 스펙 §3 의 오른쪽 구획이다.
 *
 * **입력이 없다.** 값은 전부 입하 라인에서 승계되며 사람이 고치지 않는다(§4-B).
 *
 * ⛔ **상태를 보이지 않는다.** 스펙 §4-B 가 2026-08-25 종결로 확정했다 — 「Hold」는
 * `lot.status_code` 값이 아니고 입하 보류는 서버가 등록과 함께 자동으로 건다. 화면은 응답의
 * `held`로 보류 여부만 읽으므로 **등록 전에는 보일 것이 없다**(변경 통지 #534).
 *
 * ⛔ **회차를 화면이 세지 않는다.** 재발행 사유를 실어 보내면 회차는 서버가 매긴다(착수 이슈 §6).
 */
export const TargetCard = ({
  row,
  itemLookup,
  uomLookup,
  supplierLookup,
  lotNo,
  isLotNoLoading,
  isLotNoError,
  hasWorkerNo,
  runningStep,
  onIssue,
  onReissue,
}: TargetCardProps) => {
  if (row === null) return <p className="field-note">{t.empty}</p>;

  /*
   * 등록이 이미 끝난 라인은 **인쇄만** 한다. 단추 이름이 다음에 무슨 일이 일어나는지를
   * 말해야 한다 — 「등록·인쇄」로 두면 이미 있는 LOT 위에 또 만든다고 읽힌다.
   */
  const isRegistered = toIssueStage(row) === 'registered';
  const isRunning = runningStep !== null;
  const isBlocked = !hasWorkerNo || isRunning;

  return (
    <>
      <Card>
        <dl className="pop-target-fields">
          <dt>{t.fields.item}</dt>
          <dd>{lookupDisplayLabel(itemLookup, row.itemId)}</dd>

          <dt>{t.fields.quantity}</dt>
          <dd>
            {row.receivedQty} {lookupDisplayLabel(uomLookup, row.uomId)}
          </dd>

          <dt>{t.fields.supplier}</dt>
          <dd>{lookupDisplayLabel(supplierLookup, row.supplierId)}</dd>
        </dl>
      </Card>

      <Card>
        <p className="pop-lot-label">{t.lotPreview.label}</p>
        {/*
         * 등록 전에는 번호가 없다 — 서버가 등록 시점에 매기므로 화면이 미리 만들면 실제
         * 번호와 달라진다(스펙 §3).
         *
         * 등록이 끝난 뒤에는 **34자리를 뜻의 경계로 끊어** 보인다. 그래야 라벨에 인쇄된
         * 번호와 눈으로 대조할 수 있다.
         */}
        {!isRegistered ? (
          <p className="field-note pop-wide-note">{t.lotPreview.pending}</p>
        ) : lotNo !== null ? (
          <p className="pop-lot-no">{formatLotNo(lotNo)}</p>
        ) : (
          <p className="field-note pop-wide-note">
            {isLotNoError ? t.lotPreview.loadFailed : isLotNoLoading ? t.lotPreview.loading : ''}
          </p>
        )}
      </Card>

      <div className="pop-target-actions">
        <Button
          className={popTouchClass('critical')}
          variant="filled"
          size="xl"
          disabled={isBlocked}
          onClick={onIssue}
        >
          {isRegistered ? t.actions.printOnly : t.actions.issue}
        </Button>
        <Button
          className={popTouchClass('critical')}
          variant="outlined"
          size="xl"
          /* 발행한 적이 없으면 재인쇄할 회차가 없다 — 사유를 실어 보내도 서버가 받을 것이 없다. */
          disabled={isBlocked || !isRegistered}
          onClick={onReissue}
        >
          {t.actions.reissue}
        </Button>
      </div>

      {isRegistered ? <p className="field-note pop-wide-note">{t.actions.registeredNote}</p> : null}
      {!isRegistered ? (
        <p className="field-note pop-wide-note">{t.actions.reissueNeedsIssue}</p>
      ) : null}
      {!hasWorkerNo ? <p className="field-note pop-wide-note">{t.actions.workerRequired}</p> : null}
      {runningStep === null ? null : (
        <p className="field-note pop-wide-note" role="status">
          {t.actions.running[runningStep]}
        </p>
      )}
    </>
  );
};
