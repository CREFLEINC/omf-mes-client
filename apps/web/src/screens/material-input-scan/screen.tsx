import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';
import { useSearchParams } from 'react-router';

import { ConfirmPanel } from './confirm-panel';
import { LoadErrorBanner } from './load-error-banner';
import { useLotStatusLabels } from './lot-status-labels';
import { useReceiptLines } from './queries';
import { ReceiptTable } from './receipt-table';
import { applyScan, EMPTY_SCAN_DRAFT, type ScanDraft, type ScanOutcome } from './scan';
import { ScanField } from './scan-field';
import { useScanLookup } from './scan-queries';
import { ScannedList } from './scanned-list';
import { readWorkOrderId } from './screen-params';

const t = messages.materialInputScan;

/** 스캔 한 번의 결과를 사람의 말로 옮긴다. 실패도 성공과 **같은 자리**에 선다. */
const describeOutcome = (outcome: ScanOutcome): string => {
  switch (outcome.kind) {
    case 'material':
      return t.scan.outcomes.material(outcome.code, outcome.material.lotNo);
    case 'mold':
      return t.scan.outcomes.mold(outcome.code, outcome.mold.moldCode);
    case 'duplicate':
      return t.scan.outcomes.duplicate(outcome.code, outcome.lotNo);
    case 'ambiguous':
      return t.scan.outcomes.ambiguous(outcome.count);
    case 'not-found':
      return t.scan.outcomes.notFound(outcome.code);
  }
};

/**
 * P-02-03 컨테이너 — **POP(현장 단말) 화면이라 관리웹 셸을 쓰지 않는다.**
 *
 * 사이드바·상단 바는 마우스로 메뉴를 오가는 사람을 위한 것이고, 이 화면 앞에 선 사람은
 * 장갑을 낀 채 스캐너를 든다. 그래서 `AppLayout` 밖에 서서 자기 `<main>`을 직접 렌더한다 —
 * `W-CO-01`(로그인)이 셸 밖에 선 것과 같은 형태이고, 근거는 다르다: 그쪽은 **메뉴가
 * 성립하지 않는 것**이고 이쪽은 **메뉴를 쓸 손이 없는 것**이다.
 *
 * ## 이 화면이 하는 것과 하지 않는 것
 *
 * | | |
 * | --- | --- |
 * | 한다 | 계획 대비 수령 대조 · 자재LOT·금형 스캔 · 담은 것 표시 · 타발수 경고 |
 * | **하지 않는다** | **투입 확정 쓰기** — 계약 필수 본문 셋을 채울 근거가 없다(`ConfirmPanel`) |
 *
 * ⛔ **판정을 화면이 대신하지 않는다.** 셋 다 서버 몫이다 —
 * 오투입(BOM 정합)·자재 상태(Hold·불량)·단말 게이팅. 화면은 읽은 것을 보이고 서버가 거절하면
 * 그 말을 옮긴다. 스캔한 LOT의 상태 코드를 색으로 갈래 지우지 않는 것도 같은 이유다(스펙 §5-2).
 *
 * ⛔ **단말 게이팅을 미리 판정하지 않는다.** 스펙 §5-1이 요구하는 플래그가 계약의 단말 기능
 * 구성에 없다(검토 요청 omf-mes#246) — **없는 값을 다른 플래그로 대신 읽지 않는다.**
 *
 * ⚠ 그 자리를 「서버의 403을 안내로 그린다」로 메우려 했으나 **지금은 그것이 온전히 서지
 * 않는다.** 계약이 403에 실으라고 한 본문 모양(`{ errors: [...] }`)을 공용 정규화가 검증
 * 실패로 분류해, 권한 없음이 다른 실패와 같은 배너로 선다. 이 화면만 고칠 수 있는 자리가
 * 아니라 지금 상태를 감지기로 박아 두었다(`screen.test.tsx`).
 */
export const MaterialInputScanScreen = () => {
  const [searchParams] = useSearchParams();
  const workOrderId = readWorkOrderId(searchParams);

  const titleId = useId();

  const receipt = useReceiptLines(workOrderId);

  const [draft, setDraft] = useState<ScanDraft>(EMPTY_SCAN_DRAFT);
  const scan = useScanLookup();
  /* 표시용 이름 풀이. 어느 판정에도 쓰이지 않는다 — 읽을 수 있게 하는 데만 쓴다. */
  const statusLabels = useLotStatusLabels();

  const handleScan = (code: string): void => {
    /*
     * **후보 목록을 그 순간의 값으로 넘긴다.** 중복 판정이 조회 쪽에서 일어나는데, 훅이
     * 목록을 따로 들고 있으면 화면과 훅에 정본이 둘 생긴다.
     */
    scan.mutate(
      { draft, code },
      {
        onSuccess: (outcome) => {
          /*
           * 함수형 갱신으로 담는다 — 연달아 읽힌 스캔 둘이 같은 `draft`를 각자 읽고 덮으면
           * **먼저 담긴 자재가 사라진다.** 현장에서는 이 연타가 기본 사용법이다.
           */
          setDraft((prev) => applyScan(prev, outcome));
        },
      },
    );
  };

  const removeMaterial = (lotId: number): void => {
    setDraft((prev) => ({
      ...prev,
      materials: prev.materials.filter((material) => material.lotId !== lotId),
    }));
  };

  const outcome = scan.data;

  return (
    /*
     * **표제가 본문의 이름이 된다.** 셸이 있는 화면은 `AppShell`이 본문 이름을 주지만
     * 이 화면에는 줄 사람이 없다 — 이름 없는 랜드마크로 남으면 무엇인지 알 수 없다.
     */
    <main className="pop-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {workOrderId !== null && <p className="pop-context">{t.header.workOrder(workOrderId)}</p>}
      </header>

      {/*
       * 작업지시가 없으면 **조회가 나가지 않는다.** 그 사실을 배너로 먼저 말한다 — 표의 빈
       * 상태만으로는 「받은 자재가 없다」와 「무엇을 볼지 정해지지 않았다」가 같은 모양이 된다.
       */}
      {workOrderId === null && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.title}>
            {t.header.workOrderMissing}
          </AlertBanner>
        </div>
      )}

      {receipt.isError && <LoadErrorBanner error={receipt.error} onRetry={receipt.refetch} />}

      <div className="pop-panes">
        <section className="pane" aria-label={t.panes.receipt}>
          <h2 className="pane-title">{t.panes.receipt}</h2>
          {!receipt.isError && (
            <ReceiptTable
              lines={receipt.lines}
              isLoading={receipt.isPending && workOrderId !== null}
              hasWorkOrder={workOrderId !== null}
            />
          )}
        </section>

        <section className="pane" aria-label={t.panes.scan}>
          <h2 className="pane-title">{t.panes.scan}</h2>

          <ScanField isScanning={scan.isPending} onScan={handleScan} />

          {/*
           * 스캔 결과는 **한 자리에서만** 말한다. `role="status"`라 화면을 보지 않는 작업자도
           * 읽힌 결과를 듣는다 — 이 화면의 사용자는 손과 눈이 자재에 가 있다.
           */}
          <p className="scan-outcome" role="status">
            {scan.isError
              ? t.scan.outcomes.failed
              : outcome === undefined
                ? ''
                : describeOutcome(outcome)}
          </p>

          <ScannedList
            draft={draft}
            statusLabels={statusLabels}
            onRemoveMaterial={removeMaterial}
          />

          <ConfirmPanel hasMaterials={draft.materials.length > 0} />
        </section>
      </div>
    </main>
  );
};
