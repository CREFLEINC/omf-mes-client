import { AlertBanner, Button, Card } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { popTouchClass } from '../../patterns/pop-touch';
import { nameSource, type ItemNameSource, type SupplierLookup } from './lookups';
import type { IssueStep } from './mutations';
import { toIssueStage, type TargetRow } from './types';

const t = messages.popMaterialLotLabel.target;

export interface TargetCardProps {
  row: TargetRow | null;
  /** 품목 — 목록 줄과 **같은 원천**을 쓴다(`lookups`). 카드는 코드·이름을 갈라 싣는다. */
  itemNames: ReadonlyMap<number, ItemNameSource>;
  uomLookup: LookupSource;
  /** 공급사 — 목록과 같은 원천을 쓴다. 카드는 코드·이름을 갈라 싣는다. */
  supplierLookup: SupplierLookup;
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
  /**
   * 방금 이 자재의 발행이 **403** 으로 막혔는가. ⛔ **그때는 재시도 수단을 주지 않는다**
   * (스펙 §5-2 · 변경 통지 #534 §2) — 이 단말에는 출력 권한이 없어 다시 눌러도 같은 답이 온다.
   * 사유는 바로 아래 결과 알림이 말한다.
   */
  isPrintForbidden: boolean;
  /**
   * 발행 완료 목록에서 고른 자재인가(#1241). 보기마다 단추가 하나다 — 아래 단추 줄 주석.
   */
  isIssued: boolean;
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
  itemNames,
  uomLookup,
  supplierLookup,
  lotNo,
  isLotNoLoading,
  isLotNoError,
  hasWorkerNo,
  runningStep,
  isPrintForbidden,
  isIssued,
  onIssue,
  onReissue,
}: TargetCardProps) => {
  if (row === null) return <p className="field-note">{t.empty}</p>;

  /*
   * 등록이 이미 끝난 라인은 **인쇄만** 한다. 단추 이름이 다음에 무슨 일이 일어나는지를
   * 말해야 한다 — 「등록·인쇄」로 두면 이미 있는 LOT 위에 또 만든다고 읽힌다.
   */
  /*
   * 풀어 낸 품목. 못 풀었으면 `null` 이고, 그때 두 칸에 세울 사유가 `itemStatus` 다 —
   * 「알 수 없음」·「이름 불러오는 중」·「이름을 불러오지 못했습니다」를 가른다.
   */
  const itemSource = nameSource(itemNames, row.itemId);
  const item = itemSource.item;
  const itemStatus = lookupDisplayLabel(itemSource, row.itemId);

  /* 공급사도 같은 규율이다 — 못 풀었으면 두 칸이 같은 사유를 말한다. */
  const supplier = supplierLookup.byId.get(row.supplierId) ?? null;
  const supplierStatus = lookupDisplayLabel(supplierLookup, row.supplierId);

  const isRegistered = toIssueStage(row) === 'registered';
  const isRunning = runningStep !== null;
  const isBlocked = !hasWorkerNo || isRunning || isPrintForbidden;

  return (
    <>
      <Card>
        <dl className="pop-target-fields">
          {/*
           * ⭐ **입하번호는 여기서만 보인다**(사용자 지시 2026-09-19). 목록에서 뺀 값이라,
           *    고른 줄이 어느 입하의 것인지 확인하는 자리가 여기다.
           */}
          <dt>{t.fields.receipt}</dt>
          <dd>{row.inboundReceiptNo}</dd>

          {/*
           * ⭐ **코드와 이름을 가른다**(같은 지시). 아직 못 푼 동안에는 두 칸이 같은 사유를
           *    말한다 — 코드도 이름도 같은 한 번의 조회에서 오므로 한쪽만 아는 상태가 없다.
           */}
          <dt>{t.fields.itemCode}</dt>
          <dd>{item === null ? itemStatus : item.code}</dd>

          <dt>{t.fields.itemName}</dt>
          <dd>{item === null ? itemStatus : item.name}</dd>

          <dt>{t.fields.quantity}</dt>
          <dd>
            {row.receivedQty} {lookupDisplayLabel(uomLookup, row.uomId)}
          </dd>

          <dt>{t.fields.supplierCode}</dt>
          <dd>{supplier === null ? supplierStatus : supplier.code}</dd>

          <dt>{t.fields.supplierName}</dt>
          <dd>{supplier === null ? supplierStatus : supplier.name}</dd>
        </dl>
      </Card>

      <Card>
        <p className="pop-lot-label">{t.lotPreview.label}</p>
        {/*
         * 등록 전에는 번호가 없다 — 서버가 등록 시점에 매기므로 화면이 미리 만들면 실제
         * 번호와 달라진다(스펙 §3).
         *
         * 등록이 끝난 뒤에는 번호를 **원문 그대로** 보인다 — 칸 사이에 구분자 `|` 가 이미 있어
         * 끊지 않아도 라벨에 인쇄된 번호와 눈으로 대조할 수 있다.
         */}
        {!isRegistered ? (
          <p className="field-note pop-wide-note">{t.lotPreview.pending}</p>
        ) : lotNo !== null ? (
          <p className="pop-lot-no">{lotNo}</p>
        ) : (
          <p className="field-note pop-wide-note">
            {isLotNoError ? t.lotPreview.loadFailed : isLotNoLoading ? t.lotPreview.loading : ''}
          </p>
        )}
      </Card>

      {/*
       * ⭐ 보기마다 단추가 하나다(사용자 지시 2026-09-15 · #1241) — 미발행은 등록·인쇄(등록된
       *    라인은 인쇄)만, 발행 완료는 재인쇄만 둔다.
       *
       * ⛔ 발행 완료 자재에 첫 단추를 두지 않는다 — 사유 없이 다시 발행하면 서버가 거절한다(2회차부터
       *    사유 필수). 미발행 자재에 재인쇄를 두지 않는다 — 발행한 적이 없어 재인쇄할 회차가 없다.
       */}
      <div className="pop-target-actions">
        {isIssued ? (
          <Button
            className={popTouchClass('critical')}
            variant="outlined"
            size="xl"
            disabled={isBlocked}
            onClick={onReissue}
          >
            {t.actions.reissue}
          </Button>
        ) : (
          <Button
            className={popTouchClass('critical')}
            variant="filled"
            size="xl"
            disabled={isBlocked}
            onClick={onIssue}
          >
            {isRegistered ? t.actions.printOnly : t.actions.issue}
          </Button>
        )}
      </div>

      {/*
       * ⛔ **버튼 이름이 이미 말하는 것을 문장으로 되풀이하지 않는다.**
       *
       * 「이미 등록된 자재입니다」는 버튼이 「등록·인쇄」에서 「인쇄」로 바뀐 것과 같은 말이고,
       * 「먼저 등록·인쇄를 하세요」는 재인쇄가 잠긴 것과 같은 말이다. 스펙 §3 은 이 아래를
       * **「여유 119px — 하단에 상시 구획을 두지 않는다」**로 못박았는데, 두 문장이 바로 그
       * 자리에 상주하고 있었다.
       *
       * ⭐ 사번 사유는 여기 적지 않는다 — 화면 맨 위 공용 띠가 말한다(사용자 지시 2026-09-17).
       */}
      {/*
       * 진행 상태도 결과와 같은 띠로 낸다(`AlertBanner` · 사용자 지시 2026-09-10) — 발행·인쇄가
       * 어디까지 갔는지는 다른 POP 화면이 모두 띠로 말한다.
       */}
      {runningStep === null ? null : (
        <div className="banner-slot pop-wide-note">
          <AlertBanner variant="info" title={t.actions.running[runningStep]} />
        </div>
      )}
    </>
  );
};
