import type { ApiError } from '@omf-mes/api-client';
import { AlertBanner, Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { PopWorkerTag } from '../../patterns/pop-worker-tag';
import { usePopIdentity } from '../../patterns/pop-identity';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { SaveErrorBanner } from '../../patterns/master';
import { canIssue, issueGuard, type IssueGuard } from './issue-target';
import { hasIssuedTarget, hasUnknownTarget, rowId, toLineRows } from './line-rows';
import { LineListPane } from './line-list-pane';
import { IssueLookupField } from './issue-lookup-field';
import { toLabelFields, toLabelFieldsForLine } from './label-fields';
import { PendingPane } from './pending-pane';
import { usePendingIssueLines } from './pending-list';
import { renderGoodsIssueQrLabel } from './label-image';
import {
  useDestinationCode,
  useItemNames,
  useLotNames,
  useReissueReasonOptions,
  useUomNames,
} from './lookups';
import { useDocumentIssueWrite, usePrintFlow } from './mutations';
import { hasPrintBridge } from '../../patterns/pop-print';
import { printResult, type PrintResult } from './print-result';
import {
  goodsIssueQrKeys,
  useDocumentIssueSummary,
  useGoodsIssue,
  useGoodsIssueLines,
  useHandlingUnitContents,
  isPalletListUnsupported,
  useLineHandlingUnits,
  usePrinters,
} from './queries';
import { TargetPane, type PalletQuantity } from './target-pane';
import { useGoodsIssueQrEntry } from './entry-context';
import {
  DOCUMENT_TYPE_CODE,
  ISSUE_UNIT,
  LINE_TARGET_TYPE_CODE,
  PALLET_TARGET_TYPE_CODE,
  type DocumentIssue,
  type HandlingUnitContent,
  type IssueUnit,
  type Printer,
} from './types';

const t = messages.goodsIssueQr;

/**
 * P-01-02 — POP(1024×768 터치)에서 출고 단위 QR 을 발행·재발행한다.
 *
 * **이 화면의 본론은 「발행과 인쇄는 다른 걸음」이다**(스펙 §5-5 · K-4).
 *
 * - 서버가 하는 것: 발행 기록을 만들고 **회차를 매기고**, 출력물을 그린다
 * - 셸이 하는 것: 그린 것을 프린터로 보낸다
 * - 화면이 하는 것: 대상을 고르고, 두 걸음의 결과를 **각각** 말한다
 *
 * ⛔ **인쇄 실패로 발행을 되돌리지 않는다.** 되돌리면 같은 대상에 회차를 다시 매겨야 하고,
 * 그사이 다른 단말이 그 회차를 가져간다.
 *
 * ⛔ **셸(`AppShell`)을 쓰지 않는다.** POP 은 사이드바로 옮겨 다니는 화면이 아니라 전표 하나에
 * 매인 태스크 화면이고, 세로 예산이 액션바까지 정해져 있다(스펙 §3).
 *
 * ⚠ **단말 권한으로 선차단하지 않는다**(통지 #535). 창고 POP 은 단말 기능 구성의 적용 범위
 * 밖이고 게이트는 서버의 403 이다 — 막혔다는 사실은 눌러 본 뒤에 알려 준다.
 */
export const GoodsIssueQrScreen = () => {
  const titleId = useId();
  const { baseUrl } = useApiClient();

  const entry = useGoodsIssueQrEntry();
  const [, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const identity = usePopIdentity();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /**
   * 라인 단위인가 파렛트 단위인가(스펙 §5-2). **화면 안에서만 쓰는 구분이다** — 서버로 나가는
   * 것은 이 값이 아니라 대상 유형 코드다.
   */
  const [unit, setUnit] = useState<IssueUnit>(ISSUE_UNIT.line);
  const [palletId, setPalletId] = useState<number | null>(null);
  const [reasonCode, setReasonCode] = useState('');
  const [issued, setIssued] = useState<DocumentIssue[] | null>(null);
  /**
   * 서버가 이 발행을 재발행으로 보고 사유를 물었다.
   *
   * ⛔ **거부 문구가 사라진다고 칸까지 접지 않는다.** 값을 고치면 옛 거부는 지워지는데, 칸이
   * 그 오류에만 매여 있으면 **사용자가 방금 고른 사유와 함께 칸이 사라지고** 다시 사유 없는
   * 요청이 나간다 — 같은 거부를 무한히 반복한다. 발행이 실제로 성공할 때까지 열어 둔다.
   */
  const [reasonAsked, setReasonAsked] = useState(false);

  const goodsIssue = useGoodsIssue(entry.goodsIssueId);
  const lines = useGoodsIssueLines(entry.goodsIssueId);
  const lineItems = lines.data ?? [];

  const summary = useDocumentIssueSummary(
    LINE_TARGET_TYPE_CODE,
    lineItems.map((line) => line.goodsIssueLineId),
  );
  const rows = toLineRows(lineItems, summary.data ?? []);

  /*
   * 파렛트 대상은 **고른 라인의 LOT** 으로 좁힌다(스펙 §5-2). 라인이 하나로 정해지지 않으면
   * 어느 LOT 으로 좁힐지 화면이 대신 정하게 되므로 조회 자체를 내보내지 않는다.
   */
  const palletSelectable = unit === ISSUE_UNIT.pallet && selectedIds.length === 1;
  const selectedLine = rows.find((row) => rowId(row.line) === selectedIds[0])?.line ?? null;
  const pallets = useLineHandlingUnits(palletSelectable ? (selectedLine?.lotId ?? null) : null);
  const palletItems = pallets.data?.items ?? [];
  /*
   * 서버가 말한 총계가 받은 수보다 크면 **목록이 한 쪽에서 잘렸다.** 고르려던 파렛트가
   * 목록에 없는데 화면이 아무 말도 하지 않으면 사용자는 남은 것 중에서 잘못 고른다.
   */
  const palletsTruncated = pallets.data !== undefined && pallets.data.total > palletItems.length;
  const palletContents = useHandlingUnitContents(unit === ISSUE_UNIT.pallet ? palletId : null);

  /*
   * 파렛트도 회차가 오른다 — 같은 취급 단위를 두 번 찍으면 재발행이고 사유가 필요하다.
   * **대상 유형이 달라 라인 요약으로는 알 수 없다**(같은 표를 유형으로 가른다 · 스펙 §5-1).
   */
  const palletSummary = useDocumentIssueSummary(
    PALLET_TARGET_TYPE_CODE,
    palletId === null ? [] : [palletId],
  );

  /* 화면에 선 라인의 품목만 묻는다 — 목록 한 쪽에 기대면 없는 품목이 「알 수 없음」이 된다(D2). */
  /*
   * QR 발행 대기 목록 — 전표를 고르기 «전»에만 세운다(ISSUE-QR-01 D5). 전표에 들어간 뒤에도
   * 띄우면 같은 화면에 목록이 둘이 되어 어느 것을 고르는 중인지 흐려진다.
   */
  const pending = usePendingIssueLines();

  /*
   * 이름 풀이는 **대기 목록과 전표 라인을 함께** 먹인다 — 목록이 번호를 찍지 않게 한다.
   * 같은 번호는 한 번만 묻는다(`useItemNames` 가 중복을 걷는다).
   */
  const itemNames = useItemNames([
    ...lineItems.map((line) => line.itemId),
    ...pending.lines.map((each) => each.line.itemId),
  ]);
  const uomNames = useUomNames();
  const lotNames = useLotNames([
    ...lineItems.map((line) => line.lotId),
    ...pending.lines.map((each) => each.line.lotId),
  ]);
  const reasonOptions = useReissueReasonOptions();

  const printers = usePrinters();
  const destination = useDestinationCode(
    goodsIssue.data?.destinationTypeCode,
    goodsIssue.data?.destinationId,
  );

  /*
   * ⭐ **라벨 값은 발행 직후 그 자리에서 조립한다.** POP 이 그림을 스스로 그리므로(설계 결정
   *    8·9 의 2단계) 이름 풀이가 그리기 직전에 갖춰져 있어야 한다 — 서버가 그려 줄 때는
   *    필요 없던 값이다.
   */
  const labelFieldsOf = (record: DocumentIssue) =>
    toLabelFields(record, {
      issue: goodsIssue.data ?? null,
      lines: lineItems,
      itemNames,
      lotNames,
      destination,
    });

  const printFlow = usePrintFlow(entry.workerNo, labelFieldsOf);

  /*
   * ⛔ **자리로 읽지 않는다.** 대상을 `targetId` 로 짝지어 찾는다 — 라인 쪽(`toLineRows`)과
   * 같은 축이다. 자리로 읽으면 응답이 여러 건이 되거나 차례가 바뀌는 순간 다른 대상의 회차를
   * 이 파렛트의 것으로 말하게 되고, 재발행 사유를 물을지가 그 값에 걸려 있다.
   */
  const palletIssueCount =
    palletSummary.data?.find((entry) => entry.targetId === palletId)?.issueCount ?? null;
  const needsReason =
    unit === ISSUE_UNIT.pallet
      ? palletIssueCount !== null && palletIssueCount > 0
      : hasIssuedTarget(rows, selectedIds);

  const write = useDocumentIssueWrite({
    workerNo: entry.workerNo ?? '',
    onSuccess: (records) => {
      setIssued(records);
      setReasonAsked(false);
      /* 발행이 끝나면 곧바로 그린 것을 받아 셸로 보낸다 — 사용자가 한 번 더 누르지 않는다. */
      printFlow.mutate(records);
    },
  });

  /*
   * 사유 칸을 세우는 세 경우. **필수인 것은 첫째뿐이다.**
   *
   * ⛔ 서버가 이 칸을 짚어 거부했는데 칸이 서 있지 않으면, 사용자는 **고칠 자리를 찾지 못한 채**
   * 같은 거부만 반복해서 본다 — 발행은 되돌릴 수 없는 쓰기이고 정정 경로가 없다.
   */
  const reasonServerError = write.fieldErrors.reissueReasonCode ?? null;
  const hasUnknownStatus =
    unit === ISSUE_UNIT.pallet
      ? palletId !== null && palletIssueCount === null
      : hasUnknownTarget(rows, selectedIds);
  const showReason = needsReason || hasUnknownStatus || reasonAsked;

  useEffect(() => {
    if (reasonServerError !== null) setReasonAsked(true);
  }, [reasonServerError]);

  const guard = issueGuard({
    workerNo: entry.workerNo,
    unit,
    selectedIds,
    palletId,
    palletListUnsupported: isPalletListUnsupported(),
    palletContentCount: palletContents.data?.length ?? null,
    /*
     * 내용물을 아직 «묻는 중»이면 열지 않는다 — 빈 파렛트 차단(스펙 §6)이 조회가 닿기 전
     * 잠깐 비어 있어, 그 틈에 누르면 찍을 것이 없는 파렛트로 발행 기록이 남는다.
     *
     * ⭐ **끊겨도 잠기지 않는다.** 이 앱은 `networkMode: 'always'` 라(`app/providers`) 조회가
     * 「멈춘 상태」로 머물지 않는다 — 연결이 없으면 요청이 나갔다가 실패하고, 그때
     * `isPending` 이 내려가 버튼이 다시 열린다. 잠기는 것은 «답을 기다리는 동안»뿐이다.
     */
    palletContentsPending: palletContents.isPending,
    needsReason,
    reasonCode,
  });

  const issue = (): void => {
    if (!canIssue(guard)) return;
    /*
     * ⛔ **파렛트 단위인데 대상이 비었으면 라인 대상으로 흘려보내지 않는다.** 가드가 이미
     * 막는 자리지만, 여기서 조용히 다른 대상을 싣는 길이 남아 있으면 되돌릴 수 없는 쓰기가
     * 사용자가 고르지 않은 것으로 나간다.
     */
    if (unit === ISSUE_UNIT.pallet && palletId === null) return;

    setIssued(null);
    printFlow.reset();

    write.write({
      documentTypeCode: DOCUMENT_TYPE_CODE,
      /*
       * ⛔ **파렛트 발행은 `lotId` 를 싣지 않는다**(스펙 §5-2). 취급 단위 하나가 여러 LOT 을
       * 담아 한 칸에 못 담는다 — 아무 LOT 이나 골라 채우면 이력이 그 LOT 의 것으로 굳는다.
       */
      targets:
        unit === ISSUE_UNIT.pallet && palletId !== null
          ? [{ targetTypeCode: PALLET_TARGET_TYPE_CODE, targetId: palletId }]
          : rows
              .filter((row) => selectedIds.includes(rowId(row.line)))
              .map((row) => ({
                targetTypeCode: LINE_TARGET_TYPE_CODE,
                targetId: row.line.goodsIssueLineId,
                lotId: row.line.lotId,
              })),
      /*
       * 재발행이 아닐 때는 보내지 않는다 — 신규 기록에 사유가 붙으면 이력이 거짓이 된다.
       * ⚠ 현황을 모르는 라인이 섞였을 때는 **고른 경우에만** 싣는다: 사용자가 고르지 않았으면
       * 화면이 대신 정하지 않고, 재발행인지의 판정을 서버에 맡긴다.
       */
      ...(showReason && reasonCode !== '' ? { reissueReasonCode: reasonCode } : {}),
    });
  };

  const firstIssued = issued?.[0] ?? null;
  /*
   * 고른 라인마다 발행 대상 한 줄 — 회차는 방금 발행했으면 그 회차, 아니면 발행 현황의 최근 회차.
   */
  const selectedLines = rows
    .filter((row) => selectedIds.includes(rowId(row.line)))
    .map((row) => {
      const record = issued?.find((one) => one.target.targetId === row.line.goodsIssueLineId);

      return {
        key: rowId(row.line),
        lineNo: row.line.lineNo,
        lotLabel: lookupDisplayLabel(lotNames, row.line.lotId),
        seq:
          record?.issueSeq ??
          summary.data?.find((one) => one.targetId === row.line.goodsIssueLineId)?.lastIssueSeq ??
          null,
      };
    });
  /**
   * 미리보기 — **방금 찍은 그 그림 그대로다.**
   *
   * ⛔ **서버 주소를 물리지 않는다.** 전에는 `/rendition?format=png` 를 `<img>` 에 직접 물렸는데,
   *    서버는 이 유형을 그리지 않으므로(422 · 단말 허용 목록에도 없어 401) 그 자리는 언제나
   *    깨진 그림이었다. 게다가 그 길로 보이는 것은 **인쇄된 것과 다른 그림**일 수 있다 —
   *    지금은 인쇄에 넘긴 바이트를 그대로 보여 준다.
   *
   * ⚠ 만든 주소는 쓰고 나면 거둔다(아래 `useEffect`) — 두면 회차마다 쌓인다.
   */
  /*
   * ⭐ **고르면 곧바로 보인다**(사용자 지시 2026-09-16 · ISSUE-QR-01 D3). 페이로드가 담는 것은
   *    발행과 무관하게 이미 정해져 있어, 발행을 눌러야 그림이 뜨던 것은 **확인을 발행 뒤로
   *    미루는 일**이었다 — 되돌릴 수 없는 쓰기 앞에서 무엇이 찍힐지 볼 수 없었다.
   *
   * 발행 뒤에는 **발행본**으로 바꾼다(그 자리가 가리키는 대상이 정해지므로). 라벨 면에 회차를
   * 싣지 않아 두 그림은 같지만, 「무엇을 보고 있는가」는 다르다.
   */
  const previewLine =
    firstIssued !== null
      ? (lineItems.find((line) => line.goodsIssueLineId === firstIssued.target.targetId) ?? null)
      : (rows.find((row) => rowId(row.line) === selectedIds[0])?.line ?? null);

  /**
   * 미리보기 그림과 **못 그린 까닭**.
   *
   * ⛔ **까닭을 버리지 않는다.** 처음엔 못 그리면 `null` 만 돌려줬는데, 그러면 화면이 「발행하면
   *    보인다」는 빈 상태 문구만 세워 **고르고도 안 보이는 사람에게 아무 말도 하지 못한다**
   *    (사용자 실기 지적 2026-09-16). 사유는 「어떻게 풀 것인가」를 담아야 한다(공유계약 G-3).
   */
  const preview = useMemo((): { src: string | null; problem: string | null } => {
    if (previewLine === null) return { src: null, problem: null };

    const fields = toLabelFieldsForLine(previewLine, {
      issue: goodsIssue.data ?? null,
      itemNames,
      lotNames,
      destination,
    });

    if ('unavailableReason' in fields) return { src: null, problem: fields.unavailableReason };

    /* `Blob` 은 `ArrayBuffer` 를 받는다 — 바이트 배열의 버퍼를 잘라 넘긴다. */
    const bytes = renderGoodsIssueQrLabel(fields);

    return {
      src: URL.createObjectURL(
        new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)], {
          type: 'image/png',
        }),
      ),
      problem: null,
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- 고른 줄과 이름이 갖춰지면 다시 그린다. */
  }, [
    previewLine,
    goodsIssue.data,
    itemNames.entries.length,
    lotNames.entries.length,
    destination,
  ]);

  const previewSrc = preview.src;

  useEffect(() => {
    if (previewSrc === null) return;

    return () => {
      URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc]);

  return (
    <main className="pop-shell pop-ui pop-giqr-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {/* 맥락은 화면명 옆이다 — 오른쪽 끝은 사번·단말·프린터 같은 상태 자리다(스펙 §3 머리줄). */}
        {goodsIssue.data === undefined ? null : (
          <p className="pop-context">{`${t.entry.issueLabel} ${goodsIssue.data.goodsIssueNo}`}</p>
        )}
        <div className="pop-context-right">
          <PopWorkerTag workerNo={entry.workerNo} />
          <PrinterChip
            isLoading={printers.isPending}
            isError={printers.isError}
            displayName={defaultPrinter(printers.data)?.displayName ?? null}
            hasPrinter={(printers.data?.length ?? 0) > 0}
          />
          {/*
           * 단말도 상시 보인다(스펙 §3 머리줄 `POP-W1 ●`). 인쇄가 안 될 때 「이 단말이 무엇인가」가
           * 프린터 상태와 함께 있어야 현장이 어느 자리를 봐야 하는지 안다.
           */}
          <Chip status={identity.terminalId === null ? 'warning' : 'info'}>
            {`${t.device.terminalLabel} ${
              identity.terminalId === null ? t.device.terminalUnknown : String(identity.terminalId)
            }`}
          </Chip>
        </div>
      </header>

      {/* ⭐ 사번 미확인은 모든 POP 화면이 같은 맨 위 띠로 말한다(사용자 지시 2026-09-17). */}
      <PopWorkerMissingBanner workerNo={entry.workerNo} />

      {entry.goodsIssueId === null && (
        <div className="banner-slot pop-giqr-lookup">
          <AlertBanner variant="warning">{t.entry.missingIssue}</AlertBanner>
          <IssueLookupField
            onFound={(goodsIssueId) => {
              /*
               * ⛔ **주소가 전표를 소유한다.** 화면 상태에 담아 두면 새로 고침·되돌아오기에서
               *    전표가 사라지고, 같은 단말을 넘겨받은 다음 작업자가 남의 전표를 이어 본다.
               */
              setSearchParams(
                (previous) => {
                  const next = new URLSearchParams(previous);
                  next.set('goodsIssueId', String(goodsIssueId));

                  return next;
                },
                { replace: true },
              );
            }}
          />
        </div>
      )}

      {/*
       * ⭐ **전표를 고르기 전에는 대기 목록이 선다**(사용자 요구 2026-09-16 · D5). 자재창고
       *    담당은 관리자 웹을 쓸 수 없어 「무엇을 찍어야 하는가」를 볼 자리가 없었다 —
       *    출고번호를 «이미 아는» 사람만 이 화면을 쓸 수 있었다.
       */}
      {entry.goodsIssueId === null && (
        <PendingPane
          list={pending}
          itemNames={itemNames}
          lotNames={lotNames}
          uomNames={uomNames}
          onRefresh={() => {
            void queryClient.invalidateQueries({ queryKey: goodsIssueQrKeys.all });
          }}
          onPick={(goodsIssueId, goodsIssueLineId) => {
            /* 고른 라인을 함께 세운다 — 들어가자마자 미리보기가 보이도록(D3). */
            setSelectedIds([String(goodsIssueLineId)]);
            setSearchParams(
              (previous) => {
                const next = new URLSearchParams(previous);
                next.set('goodsIssueId', String(goodsIssueId));

                return next;
              },
              { replace: true },
            );
          }}
        />
      )}

      {/*
       * ⭐ **전표에서 대기 목록으로 되돌아가는 길**(사용자 결정 2026-09-16 · D5 배치). 두 목록을
       *    한 화면에 겹치지 않기로 했으므로, 돌아가는 길이 없으면 전표에 들어간 담당은 셸
       *    [화면 이동]으로 이 화면을 다시 열어야 한다.
       *
       * 돌아가며 **목록을 다시 받는다** — 방금 찍은 라인이 대기에서 빠져 있어야 한다.
       */}
      {/* ⭐ [← 대기 목록으로]는 「자재 출고 라인」 표제 줄 왼쪽에 선다(사용자 지시 2026-09-17). */}

      {/*
       * 403 만 화면의 말로 바꿔 낸다(스펙 §6 · F-7) — 공용 배너의 일반 문구는 「권한이 없습니다」
       * 까지이고, 여기서 필요한 것은 **어느 단말에서 다시 하면 되는가**다. 대상 선택은 그대로
       * 둔다 — 재시도는 다른 단말에서 하는 것이지 다시 고르는 것이 아니다.
       */}
      {isForbidden(write.error) ? (
        <div className="banner-slot">
          <AlertBanner variant="error">{t.errors.forbidden}</AlertBanner>
        </div>
      ) : (
        <SaveErrorBanner error={write.error} />
      )}

      {/*
       * ⚠ **인쇄 통로가 없는 것은 배너로 먼저 말한다.** 액션바 «아래»에 작은 글로 달아 두었는데,
       *    설계 §3 의 세로 예산은 액션바에서 끝나(768 슬랙 0) 그 줄이 화면 밖으로 밀렸다 —
       *    단말에서는 없는 문구가 된다.
       *
       * ⛔ 프린터가 0건인 것과 뭉치지 않는다 — 전자는 이 셸에서 찍을 수 없다는 뜻이고 후자는
       *    이 단말에 등록된 프린터가 없다는 뜻이라, 사용자가 손댈 곳이 다르다.
       */}
      {!hasPrintBridge() && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.printer.noShell}</AlertBanner>
        </div>
      )}

      {issued !== null && (
        <div className="banner-slot">
          <AlertBanner variant="success">{t.result.issued(issued.length)}</AlertBanner>
        </div>
      )}
      {/*
       * ⭐ **전표를 고르기 전에는 전표 구획을 세우지 않는다**(사용자 지시 2026-09-16 · D9).
       *    라인 목록·발행 대상·미리보기·발행 단추는 **전표 하나에 매인 것**이라, 전표가 없으면
       *    빈 표와 잠긴 단추만 남아 그 자리를 차지한다 — 그 자리는 대기 목록이 쓴다.
       *
       * ⚠ 머리줄(사번·프린터·단말)과 자재 출고번호 입력 칸은 두 단계 모두 선다.
       */}
      {entry.goodsIssueId !== null && (
        <>
          <PrintResultBanner
            isPending={printFlow.isPending}
            result={printResult(printFlow.data?.reports ?? [])}
          />

          <div className="pop-panes">
            <LineListPane
              headerStart={
                <Button
                  variant="outlined"
                  size="md"
                  className="pop-touch-target pop-giqr-back"
                  onClick={() => {
                    setSelectedIds([]);
                    setIssued(null);
                    setSearchParams(
                      (previous) => {
                        const next = new URLSearchParams(previous);
                        next.delete('goodsIssueId');

                        return next;
                      },
                      { replace: true },
                    );
                    void queryClient.invalidateQueries({ queryKey: goodsIssueQrKeys.all });
                  }}
                >
                  <span aria-hidden="true">← </span>
                  {t.pending.back}
                </Button>
              }
              rows={rows}
              selectedIds={selectedIds}
              onSelectionChange={(ids) => {
                setSelectedIds(ids);
                /* 좁히는 LOT 이 바뀌면 앞서 고른 파렛트는 이 라인의 것이 아니다. */
                setPalletId(null);
                /* 대상이 바뀌면 앞 거부는 이 발행의 것이 아니다 — 물음도 함께 내린다. */
                setReasonAsked(false);
                write.clearFieldError('reissueReasonCode');
              }}
              itemNames={itemNames}
              lotNames={lotNames}
              uomNames={uomNames}
              /*
               * ⛔ **부르지도 않은 조회를 「불러오는 중」으로 그리지 않는다**(#1093 ②).
               *    react-query 는 꺼 둔 조회(`enabled: false`)를 계속 `pending` 으로 둔다 —
               *    그대로 쓰면 전표 없이 들어왔을 때 뼈대가 **영영 걷히지 않는다.** 위 배너는
               *    「전표를 고른 뒤 들어오세요」라고 옳게 말하는데 옆은 로딩이라, 작업자는
               *    화면이 곧 뜰 줄 알고 기다린다. 아래 파렛트 줄이 같은 일을 이미 하고 있다.
               */
              isLoading={lines.isPending && entry.goodsIssueId !== null}
              isError={lines.isError}
            />
            <TargetPane
              selectedCount={selectedIds.length}
              selectedLines={selectedLines}
              unit={unit}
              onUnitChange={(next) => {
                setUnit(next);
                /* 유형이 바뀌면 앞 유형의 대상은 이 발행의 것이 아니다. */
                setPalletId(null);
                setReasonAsked(false);
                write.clearFieldError('reissueReasonCode');
              }}
              pallets={palletItems}
              palletsPending={pallets.isPending && palletSelectable}
              palletsFailed={pallets.isError}
              palletsUnavailable={isPalletListUnsupported()}
              palletsTruncated={palletsTruncated}
              palletTotal={pallets.data?.total ?? 0}
              palletSelectable={palletSelectable}
              palletId={palletId}
              onPalletChange={(handlingUnitId) => {
                setPalletId(handlingUnitId);
                setReasonAsked(false);
                write.clearFieldError('reissueReasonCode');
              }}
              palletContents={
                palletContents.data === undefined
                  ? null
                  : {
                      lineCount: palletContents.data.length,
                      quantities: toPalletQuantities(palletContents.data),
                    }
              }
              uomNames={uomNames}
              issuedSeq={firstIssued?.issueSeq ?? null}
              showReason={showReason}
              needsReason={needsReason}
              hasUnknownStatus={hasUnknownStatus}
              reasonServerError={reasonServerError}
              reasonCode={reasonCode}
              onReasonChange={(code) => {
                setReasonCode(code);
                /* 고친 값 옆에 옛 거부를 남기지 않는다 — 저장소의 다른 화면들과 같은 처리다. */
                write.clearFieldError('reissueReasonCode');
              }}
              reasonOptions={reasonOptions}
              previewSrc={previewSrc}
              previewProblem={preview.problem}
              destinationMissing={destination.kind === 'failed'}
            />
          </div>

          {/*
           * 액션바 — **화면 바닥의 띠**(설계 §3 · 88). 다른 POP 화면과 같은 이름(`pop-action-bar`)
           * 을 쓴다: `.pop-actions` 는 단추만 오른쪽으로 미는 줄이라 띠의 높이·경계선을 갖지 않아,
           * 이 화면만 바닥이 없는 것처럼 떠 있었다.
           */}
          <div className="pop-action-bar pop-giqr-actions">
            {/*
             * ⛔ 「발행할 라인을 먼저 고르세요」는 띄우지 않는다(사용자 지시 2026-09-15) — 비활성 단추와
             *    라인 목록이 이미 말한다. 다른 사유(파렛트·재발행 사유)는 그대로 남긴다.
             * ⭐ 사번 사유는 여기 적지 않는다 — 맨 위 공용 띠가 말한다(사용자 지시 2026-09-17).
             */}
            {guard.kind !== 'ready' &&
              guard.kind !== 'noSelection' &&
              guard.kind !== 'noWorker' && <p className="field-note">{guardNote(guard.kind)}</p>}
            <Button
              variant="filled"
              size="2xl"
              type="button"
              disabled={!canIssue(guard)}
              loading={write.isSaving || printFlow.isPending}
              onClick={issue}
            >
              {t.action.issue}
            </Button>
          </div>
        </>
      )}
    </main>
  );
};

/**
 * 머리에 세울 프린터 한 대. **계약이 표시한 기본 프린터를 고른다** — 목록의 첫 줄을 집으면
 * 서버가 순서를 바꾸는 순간 다른 프린터의 상태를 보이게 된다. 기본 표시가 없으면 첫 줄이다.
 */
const defaultPrinter = (printers: Printer[] | undefined): Printer | null => {
  if (printers === undefined || printers.length === 0) return null;

  return printers.find((printer) => printer.isDefault) ?? printers[0] ?? null;
};

/**
 * 담긴 내용을 **단위별로 합친다.**
 *
 * ⛔ **단위를 무시하고 하나로 더하지 않는다.** 한 취급 단위가 서로 다른 단위의 LOT 을 담을 수
 * 있어(계약 `HandlingUnitContent.uomId`), 더해 버리면 화면이 실재하지 않는 수를 말한다.
 *
 * 차례는 **처음 나온 단위 순**이다 — 응답 차례를 그대로 따라 화면이 다시 줄 세우지 않는다.
 */
const toPalletQuantities = (contents: readonly HandlingUnitContent[]): PalletQuantity[] => {
  const byUom = new Map<number, number>();

  for (const content of contents) {
    byUom.set(content.uomId, (byUom.get(content.uomId) ?? 0) + content.qty);
  }

  return [...byUom].map(([uomId, qty]) => ({ uomId, qty }));
};

/** 서버가 이 단말의 발행을 막았는가. 게이트는 서버가 갖는다(통지 #535). */
const isForbidden = (error: ApiError | null): boolean =>
  error !== null && error.kind === 'http' && error.status === 403;

const guardNote = (
  kind: Exclude<IssueGuard['kind'], 'ready' | 'noSelection' | 'noWorker'>,
): string => {
  switch (kind) {
    case 'palletNeedsOneLine':
      return t.action.disabledPalletNeedsOneLine;
    case 'noPallet':
      return t.action.disabledNoPallet;
    /* 막힌 사유는 대상 칸이 이미 적는다 — 액션바에서 되풀이하지 않는다(#1095). */
    case 'palletUnsupported':
      return t.action.disabledPalletUnsupported;
    case 'palletContentsPending':
      return t.action.disabledPalletContentsPending;
    case 'emptyPallet':
      return t.action.disabledEmptyPallet;
    case 'reasonRequired':
      return t.action.disabledNoReason;
  }
};

interface PrinterChipProps {
  isLoading: boolean;
  isError: boolean;
  hasPrinter: boolean;
  displayName: string | null;
}

/**
 * 프린터 상태는 **머리에 상시 보인다**(스펙 §5-5 · K-4) — 인쇄가 안 될 때 사용자가 가장 먼저
 * 보는 자리다.
 *
 * ⭐ **이름만 보인다**(사용자 지시 2026-09-15). 뒤에 붙던 설명(「이 프린터로 나갑니다」 등)은
 *    머리줄을 길게 만들 뿐이라 뺐다 — 자재 LOT 라벨 머리줄과 같은 표기다.
 */
const PrinterChip = ({ isLoading, isError, hasPrinter, displayName }: PrinterChipProps) => {
  if (isLoading) return <Chip status="idle">{t.printer.loading}</Chip>;
  if (isError) return <Chip status="error">{t.printer.failed}</Chip>;
  if (!hasPrinter) return <Chip status="warning">{t.printer.empty}</Chip>;

  return <Chip status="success">{`${t.printer.label} ${displayName ?? ''}`.trim()}</Chip>;
};

interface PrintResultBannerProps {
  isPending: boolean;
  result: PrintResult;
}

/**
 * 인쇄 걸음의 결과. **다섯 갈래를 다섯 문장으로 말한다** — 접으면 사용자가 다음에 무엇을
 * 해야 하는지가 달라지는데 화면은 같은 말을 하게 된다.
 */
const PrintResultBanner = ({ isPending, result }: PrintResultBannerProps) => {
  if (isPending) {
    return (
      <div className="banner-slot">
        <AlertBanner variant="info">{t.result.printing}</AlertBanner>
      </div>
    );
  }

  switch (result.kind) {
    case 'none':
      return null;
    /*
     * ⛔ **인쇄 성공은 따로 말하지 않는다**(사용자 지시 2026-09-09). 바로 위에 「N건을
     *    발행했습니다」가 이미 서 있어 초록 띠가 둘로 겹쳤다 — 잘된 것을 두 번 말하면
     *    정작 봐야 할 «실패» 띠가 묻힌다. 아래 실패·미보고 갈래는 그대로 남긴다.
     */
    case 'printed':
      return null;
    case 'printedUnreported':
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.result.printedUnreported}</AlertBanner>
        </div>
      );
    case 'failed':
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.result.printFailed}</AlertBanner>
        </div>
      );
    case 'failedUnreported':
      return (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.result.reportFailed}</AlertBanner>
        </div>
      );
  }
};
