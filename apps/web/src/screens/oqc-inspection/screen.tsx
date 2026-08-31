import { Breadcrumb, Button, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { toApiError } from '../../patterns/request';
import { CODE_GROUPS, toCodeOptions } from './code-options';
import {
  EMPTY_FILTERS,
  readFilters,
  readPage,
  readSelectedId,
  toListQuery,
  toPageParams,
  toSearchParams,
  URL_KEYS,
  type QueueFilters,
} from './filters';
import { QueueLoadErrorBanner } from './load-error-banner';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { EMPTY_QUANTITY_DRAFT, toSendableNumber, type QuantityDraft } from './quantity-draft';
import {
  useCodeValues,
  useInspectionQueue,
  useInspectionRequestDetail,
  useInspectionRounds,
  useSaveInspectionResult,
} from './queries';
import { QueueFilterBar } from './queue-filter-bar';
import { QueueTable } from './queue-table';
import { RequestDetailPane } from './request-detail-pane';
import { ResultFormPane } from './result-form-pane';
import { RoundHistory } from './round-history';
import { latestRound } from './types';
import { targetSignatureOf, type WriteTargetSignature } from './write-target';

/**
 * W-04-03 OQC 출하검사 판정.
 *
 * 좌우 2단이다 — 왼쪽이 검사 대상 목록(약 1/3), 오른쪽이 고른 한 건의 대상 정보·판정 입력·회차
 * 이력이다(스펙 §3).
 *
 * **주소가 조건의 정본이다.** 조건·쪽·고른 의뢰가 전부 주소에 산다 — 새로고침·뒤로가기·공유가
 * 같은 결과를 내야 하기 때문이다. 읽고 쓰는 규칙은 `filters.ts` 가 소유한다.
 *
 * ⭐ **저장이 한 번이고 되돌릴 수 없다.** 임시 저장을 두지 않으므로 이 화면에는 「완충 구간」이
 * 없다 — 그래서 **편집 초안과 서버 조회가 언제 만나는가**가 이 화면의 중심축이다. 아래 규칙 넷이
 * 그 자리를 지킨다(§9 R1~R4).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.oqcInspection;

export const OqcInspectionScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = readFilters(searchParams);
  const page = readPage(searchParams);
  const selectedId = readSelectedId(searchParams);

  const queue = useInspectionQueue(toListQuery(filters, page));
  const detail = useInspectionRequestDetail(selectedId);
  const rounds = useInspectionRounds(selectedId);

  const round = latestRound(rounds.data ?? []);

  /**
   * 확정된 회차에서 **재검사 회차를 쓰는 중**인가.
   *
   * ⭐ **회차를 먼저 만들지 않는다.** 누르면 칸이 열릴 뿐이고 회차는 저장이 만든다 — 먼저
   * 만들면 열어 보고 그만둔 사람마다 빈 회차가 쌓인다.
   */
  const [isReinspecting, setIsReinspecting] = useState(false);

  /**
   * 재검사가 가리키는 **앞 회차**. 재검사 중이 아니면 `null`.
   *
   * ⭐ **지금 화면에 있는 회차로 매번 다시 판정한다** — 눌렀을 때의 식별자를 따로 들고 있지
   * 않는다. 들고 있으면 그 값이 화면의 회차와 어긋나는 상태가 생기고, 어느 쪽이 옳은지 정할
   * 근거가 코드 어디에도 없다.
   */
  const previousResultId = isReinspecting ? (round?.inspectionResultId ?? null) : null;
  const isReinspectingNow = previousResultId !== null;

  /** 방금 저장했는가. **상태가 아니라 결과다** — 고른 의뢰가 바뀌면 지워진다. */
  const [isJustSaved, setIsJustSaved] = useState(false);

  /**
   * 수량 초안. **고른 의뢰가 바뀌면 그 회차의 값으로 되돌아간다.**
   *
   * ⭐ **R1 — 되돌림을 참조가 아니라 값으로 판정한다.** 조회 응답이 다시 그려질 때마다 참조가
   * 달라지므로, 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다(§9 D1).
   *
   * ⛔ **0을 미리 채우지 않는다** — 채우면 「검사자가 0으로 판정했다」와 「아직 아무것도 넣지
   * 않았다」가 화면에서 같아 보인다.
   */
  const [draft, setDraft] = useState<QuantityDraft>(EMPTY_QUANTITY_DRAFT);

  /**
   * 종합 판정 — ⛔ **값 목록을 화면에 고정하지 않는다.** 그룹을 «이름»으로 부른다:
   * `codeGroupId` 정수는 환경마다 다르므로 코드에 박지 않는다(omf-mes#179 회신).
   */
  const judgmentValues = useCodeValues(CODE_GROUPS.overallJudgment);
  const judgmentOptions = toCodeOptions(judgmentValues.data ?? []);

  const [judgment, setJudgment] = useState('');

  /**
   * ⭐ **R3 — 「이 누름이 겨눈 대상」을 누를 때 적어 두고 돌아와 대조한다.**
   *
   * 되돌릴 수 없는 쓰기가 나가 있는 동안 화면은 계속 움직인다. 이 표식이 없으면 늦게 도착한
   * 응답이 **누르지도 않은 의뢰 창에** 「판정을 저장했습니다」를 세우고, 검사자는 안 한 일을
   * 했다고 읽고 자리를 뜬다(§9 D3).
   */
  const writeTargetRef = useRef<WriteTargetSignature | null>(null);

  /**
   * 지금 화면이 겨누고 있는 대상. **`onSuccess` 가 이 값을 «누를 때의 것»으로 붙잡는다** —
   * 훅에 넘긴 콜백은 `write()` 를 부른 렌더의 것이므로, 그 렌더의 서명과 지금 표식을 견주면
   * 「그 사이에 대상이 바뀌었는가」가 그대로 드러난다.
   */
  const writeTarget = selectedId === null ? null : targetSignatureOf(selectedId, previousResultId);

  const save = useSaveInspectionResult(selectedId, () => {
    /*
     * ⛔ **겨눈 대상이 그대로일 때만 반영한다.** 표식이 비었거나(의뢰가 바뀌었다) 다른 것을
     * 가리키면(그 사이 다른 저장이 나갔다) 이 성공은 이 화면의 것이 아니다.
     */
    if (writeTargetRef.current === null || writeTargetRef.current !== writeTarget) return;

    writeTargetRef.current = null;
    setIsJustSaved(true);
  });

  const roundId = round?.inspectionResultId ?? null;
  const { acceptedQty, rejectedQty, heldQty } = round ?? {
    acceptedQty: 0,
    rejectedQty: 0,
    heldQty: 0,
  };

  const storedJudgment = round?.overallJudgmentCode ?? '';

  /**
   * 회차가 화면에 보일 값. 회차가 없으면 빈 초안이다.
   */
  const draftOf = (
    source: { acceptedQty: number; rejectedQty: number; heldQty: number } | null,
  ): QuantityDraft =>
    source === null
      ? EMPTY_QUANTITY_DRAFT
      : {
          accepted: String(source.acceptedQty),
          rejected: String(source.rejectedQty),
          held: String(source.heldQty),
        };

  /*
   * ⭐ **R2 — 의존성에 `selectedId` 가 반드시 든다.**
   *
   * 회차 값만 보면 **회차가 없는 의뢰끼리 옮길 때** 네 값이 모두 그대로여서(`null`·0·0·0)
   * effect 가 깨어나지 않고, 앞 의뢰에 친 수량이 다음 의뢰 화면에 남는다. 그대로 저장하면
   * **다른 LOT 에 엉뚱한 판정이 나가는데 그 쓰기는 되돌릴 수 없다** — 값이 그럴듯해서 아무도
   * 눈치채지 못한다(§9 D2). **이 한 줄이 없어도 화면은 정상으로 보인다.**
   *
   * ⛔ 여기서 「저장했습니다」를 지우지 않는다 — 저장이 **새 회차를 만들어** `roundId` 가 바뀌면
   * 곧바로 이리 오는데, 그때 지우면 성공 문구가 뜨자마자 사라진다. 그 표시를 지우는 것은
   * 아래 「대상이 바뀌었다」 effect 의 몫이다.
   */
  useEffect(() => {
    /*
     * 재검사 모드를 함께 푼다 — 저장이 새 회차를 만들면 `roundId` 가 바뀌어 여기로 오고, 그
     * 회차는 이제 «실재하는 회차»라 재검사 모드로 남아 있으면 다음 저장이 또 새 회차를 만든다.
     */
    setIsReinspecting(false);
    setJudgment(storedJudgment);
    setDraft(draftOf(roundId === null ? null : { acceptedQty, rejectedQty, heldQty }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, roundId, acceptedQty, rejectedQty, heldQty, storedJudgment]);

  /*
   * 겨눈 대상이 바뀌었다 — **앞 대상의 쓰기는 이제 남의 것이다.**
   *
   * ⛔ 이 `null` 대입이 없으면 나가 있던 저장이 돌아와 **새 의뢰 창에** 성공을 알린다(§9 D3).
   * 화면은 멀쩡히 돌고 문구만 엉뚱한 자리에 선다 — **없어도 조용히 깨지는 자리다.**
   */
  useEffect(() => {
    writeTargetRef.current = null;
    setIsJustSaved(false);
  }, [selectedId]);

  const rows = queue.data?.rows ?? [];
  const pageView = toPageView(queue.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /**
   * 조건을 바꾼다. **첫 쪽으로 가고 고른 의뢰가 풀린다** — 결과가 통째로 달라지므로 3쪽을 보다가
   * 좁히면 결과가 3쪽에 못 미쳐 「좁혔더니 아무것도 없다」로 보이고, 고른 의뢰는 새 결과에 없을
   * 수 있다. 두 일을 `toSearchParams` 가 한 자리에서 한다.
   */
  const applyFilters = (next: QueueFilters): void => {
    setSearchParams(toSearchParams(next));
  };

  /** 쪽만 옮긴다 — 조건과 고른 의뢰는 그대로다. */
  const goToPage = (next: number): void => {
    setSearchParams(toPageParams(searchParams, next));
  };

  const select = (inspectionRequestId: number): void => {
    const next = new URLSearchParams(searchParams);
    next.set(URL_KEYS.selected, String(inspectionRequestId));
    setSearchParams(next);
  };

  /**
   * 표 자리에 그릴 것. **네 갈래를 가른다** — 실패 · 부르는 중 · 이 쪽에 없음 · 조건에 맞는 것 없음.
   *
   * ⭐ **실패를 「결과 없음」으로 접지 않는다.** 접으면 요청이 실패했을 뿐인데 표가 「조건을
   * 넓혀 보세요」라고 말하고, 사용자는 조건을 넓히다가 결국 못 찾는다.
   *
   * ⭐ 「이 쪽에 없음」과 「조건에 맞는 것이 없음」도 합치지 않는다. 앞은 **쪽이 문제**라 앞쪽으로
   * 가면 풀리고, 뒤는 **조건이 문제**라 조건을 넓혀야 풀린다.
   */
  const emptyContent = queue.isError ? (
    <p className="field-note">{t.queue.unavailable}</p>
  ) : queue.isPending ? (
    <p className="field-note">{t.queue.loading}</p>
  ) : pageView.isBeyondLast ? (
    <p className="field-note">
      {t.pageNav.beyondLast}{' '}
      <Button variant="outlined" size="sm" onClick={() => goToPage(1)}>
        {t.pageNav.toFirstPage}
      </Button>
    </p>
  ) : (
    <p className="field-note">{t.queue.empty}</p>
  );

  /* 회차가 있으면 그 회차의 검사수량이고, 없으면 의뢰의 대상 수량이다. */
  const inspectedQty = round?.inspectedQty ?? detail.data?.targetQty ?? 0;

  /**
   * 저장이 보낼 값을 만든다.
   *
   * 수량은 `toSendableNumber` 를 거친다 — 화면이 재는 자와 보내는 자가 같아야 한다.
   *
   * ⛔ **검사자·단말·재검사 사유를 보내지 않는다** — 앞 둘은 서버가 인증 주체에서 풀고
   * (omf-mes#173), 셋째는 값 목록이 없어 지어내면 서버가 모르는 값을 받는다.
   *
   * 고른 의뢰·단위를 **인자로 받는다** — 이 자리에 도달했으면 `null` 이 아니라는 사실이 타입이
   * 아니라 렌더 조건에 있어서, 단언으로 메우면 그 조건이 바뀔 때 조용히 어긋난다.
   */
  const saveResult = (inspectionRequestId: number, uomId: number, inspectedAt: string): void => {
    if (writeTarget === null) return;

    setIsJustSaved(false);
    /* ⭐ R3 — 누를 때 겨눈 대상을 적어 둔다. 돌아와 이 값과 대조한다. */
    writeTargetRef.current = writeTarget;

    save.write({
      inspectionRequestId,
      inspectedQty,
      acceptedQty: toSendableNumber(draft.accepted),
      rejectedQty: toSendableNumber(draft.rejected),
      heldQty: toSendableNumber(draft.held),
      uomId,
      /*
       * ⭐ **R4 — 고른 판정을 몸통에 싣는다.** 확정 저장이라 계약상 필수이기도 하고, 싣지
       * 않으면 저장 뒤 재조회가 «저장 전» 판정을 돌려주고 되돌림이 사용자가 고른 값을 덮는다 —
       * 이 화면은 확정이 한 번이라 **덮인 값 그대로 LOT 이 풀린다**(§9 D4).
       */
      overallJudgmentCode: judgment,
      /* 검사한 시각은 확인 창을 연 순간의 것이다 — 재시도에도 같은 값이어야 멱등 키가 유지된다. */
      inspectedAt,
      /*
       * 재검사면 앞 회차를 가리킨다 — 이 값이 있어야 서버가 회차를 +1 하고 사슬을 잇는다.
       * ⛔ 빠뜨리면 같은 의뢰에 회차 1이 두 번 만들어지려 해 `UNIQUE(의뢰, 회차)` 에 걸린다.
       */
      previousResultId,
    });
  };

  /**
   * 우측 창. **네 갈래다** — 고르지 않음 · 실패 · 부르는 중 · 상세.
   *
   * ⛔ 실패를 「고르지 않음」으로 접지 않는다. 접으면 고른 것이 사라진 것처럼 보여 사용자가 다시
   * 고르는데, 다시 골라도 같은 실패가 온다.
   */
  const detailContent =
    selectedId === null ? (
      <p className="field-note">{t.detail.nothingSelected}</p>
    ) : detail.isError ? (
      <QueueLoadErrorBanner
        error={toApiError(detail.error)}
        onRetry={() => void detail.refetch()}
      />
    ) : detail.data === undefined ? (
      <p className="field-note">{t.detail.loading}</p>
    ) : (
      <>
        <RequestDetailPane detail={detail.data} />

        {rounds.isError ? (
          /* 회차를 모르는 채로 저장을 열지 않는다 — 몇 회차인지 모르면 재검사인지도 모른다. */
          <QueueLoadErrorBanner
            error={toApiError(rounds.error)}
            onRetry={() => void rounds.refetch()}
          />
        ) : rounds.isPending ? (
          <p className="field-note">{t.result.loading}</p>
        ) : (
          <ResultFormPane
            /*
             * ⭐ **의뢰마다 새로 세운다.** 폼이 스스로 드는 상태(확인 창이 열려 있는가 · 오류를
             * 보일 때가 됐는가)는 «그 의뢰에 매인 것»이라, 대상이 바뀌면 함께 사라져야 한다.
             * 자리로만 이어 두면 다른 의뢰를 골랐는데 **앞 의뢰에서 열어 둔 확인 창이 새 의뢰의
             * 번호를 달고 그대로 서 있다** — 그 창의 단추는 되돌릴 수 없는 쓰기를 낸다.
             */
            key={selectedId}
            /*
             * ⭐ 재검사 중에는 **회차를 넘기지 않는다.** 넘기면 그 회차가 확정본이라 칸이 잠긴
             * 채로 남는다 — 지금 쓰는 것은 확정본이 아니라 «아직 없는 새 회차»다.
             */
            round={isReinspectingNow ? null : round}
            inspectionRequestNo={detail.data.inspectionRequestNo}
            inspectedQty={inspectedQty}
            draft={draft}
            onChange={setDraft}
            judgmentOptions={judgmentOptions}
            judgment={judgment}
            onJudgmentChange={setJudgment}
            onSave={(inspectedAt) => {
              saveResult(selectedId, detail.data.uomId, inspectedAt);
            }}
            isSaving={save.isSaving}
            isJustSaved={isJustSaved}
            fieldErrors={save.fieldErrors}
            saveError={save.error}
            onReload={() => void rounds.refetch()}
            isReinspecting={isReinspectingNow}
            onStartReinspection={() => {
              /* 새 회차는 빈 칸에서 시작한다 — 앞 회차의 값이 남으면 그대로 저장된다. */
              setIsJustSaved(false);
              setDraft(EMPTY_QUANTITY_DRAFT);
              setJudgment('');
              setIsReinspecting(true);
            }}
            onCancelReinspection={() => {
              setIsReinspecting(false);
              /*
               * ⛔ **확정본의 값을 되돌려 놓는다.** 비우면 그만둔 자리에 확정된 회차가 «수량
               * 없이» 놓인다 — 판정이 끝난 기록인데 화면이 비어 있으니 검사자는 자기가 방금
               * 그것을 지웠다고 읽는다.
               */
              setDraft(draftOf(round));
              setJudgment(storedJudgment);
            }}
          />
        )}

        {/* ⛔ 읽기 전용이다 — 앞 회차는 정정하지 않고 새 회차를 쌓는다(§5-3). */}
        <RoundHistory
          rounds={rounds.data ?? []}
          currentResultId={isReinspectingNow ? null : roundId}
        />
      </>
    );

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />

      <div className="two-pane">
        <section className="pane" aria-label={t.queue.heading}>
          <QueueFilterBar
            appliedFilters={filters}
            onSearch={applyFilters}
            onReset={() => applyFilters(EMPTY_FILTERS)}
          />

          {queue.isError && (
            <QueueLoadErrorBanner
              error={toApiError(queue.error)}
              onRetry={() => void queue.refetch()}
            />
          )}

          <QueueTable rows={rows} selectedId={selectedId} onSelect={select} empty={emptyContent} />

          {/*
           * ⛔ **셀 것이 없으면 그리지 않는다.** 조회가 끝나기 전이나 실패했을 때는 총계를
           * 모르는데, 그리면 대신 넘긴 0이 「전체 0건」이라는 **사실 주장**이 되어 화면에 선다.
           */}
          {queue.data !== undefined && (
            /*
             * 저장이 나가 있는 동안 쪽을 잠근다 — 쪽이 바뀌면 목록이 통째로 갈리는데, 그 사이
             * 돌아온 성공이 다른 목록 위에 서면 무엇에 대한 성공인지 읽을 수 없다.
             */
            <PageNav view={pageView} disabled={save.isSaving} onChange={goToPage} />
          )}
        </section>

        <section className="pane" aria-label={t.detail.paneLabel}>
          {detailContent}
        </section>
      </div>
    </>
  );
};
