import { AlertBanner, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { CreatedAdjustmentView } from './types';

const t = messages.stockAdjust;

/**
 * ERP 송신 **적재** 여부의 세 갈래.
 *
 * **셋인 이유는 계약이 이 필드를 선택으로 두었기 때문이다** — 값이 오지 않는 갈래가 실재하므로
 * `?? false`로 접으면 아무 근거 없이 「적재되지 않았다」로 읽힌다(C23).
 *
 * **「적재」는 「전송」이 아니다**(계약 문면) — 그래서 어느 갈래의 문구에도 「전송 완료」라는
 * 낱말이 없다.
 */
type ErpQueueState = { kind: 'queued' } | { kind: 'notQueued' } | { kind: 'unknown' };

const readErpQueue = (queued: boolean | null): ErpQueueState => {
  if (queued === null) return { kind: 'unknown' };

  return queued ? { kind: 'queued' } : { kind: 'notQueued' };
};

const erpQueueText = (state: ErpQueueState): string => {
  switch (state.kind) {
    case 'queued':
      return t.result.erpQueued;
    case 'notQueued':
      return t.result.erpNotQueued;
    case 'unknown':
      return t.result.erpUnknown;
  }
};

export interface ResultPaneProps {
  created: CreatedAdjustmentView;
}

/**
 * 등록 결과 — **화면이 확인한 것만 말한다.**
 *
 * | 말한다 | 말하지 않는다 |
 * | --- | --- |
 * | 「조정 전표 `SAMPLE-IA-…`를 만들었습니다」 — **서버가 201로 받아들였다**는 사실 | 「등록 완료」·「승인 대기」 — 상태의 뜻을 화면이 옮겨 적지 않는다(공유계약 G-2) |
 * | 서버가 준 **상태 코드 그대로**와 **그것이 등록 시점의 값**이라는 사실 | 지금의 진행 상태 — 그 정본은 결재함이다 |
 * | **서버가 저장한** 줄 수 | 화면이 보낸 줄 수 — 둘이 갈리면 서버가 맞다 |
 * | ERP **대기열 적재** 세 갈래 | 「ERP로 전송됐습니다」 — 적재는 전송이 아니다 |
 * | 재고가 **아직 움직이지 않았다**는 사실 | 「처리가 끝났습니다」 — 상신도 전기도 별개 조작이다 |
 *
 * **조작 자리를 두지 않는다.** 이 회차의 쓰기는 등록 하나이고, 상신·전기는 뒤따르는 회차가
 * 제 확인 창·잠금·실패 배너와 함께 세운다 — 여기에 잠긴 버튼을 미리 두면 「무엇이 풀리는
 * 조건인가」에 화면이 답하지 못한다.
 *
 * ⚠ **목이 채워 주는 값에 기대지 않는다.** 목 서버는 등록 응답에 승인 요청 번호와 전기 시각을
 * 계약 예시값으로 채워 준다 — 그것을 읽어 「상신됨」·「전기됨」을 그리면 **화면이 확인하지 않은
 * 사실**을 말하게 된다. 그래서 표시 타입(`CreatedAdjustmentView`)에 그 자리가 아예 없다.
 *
 * **사라지는 알림으로 내지 않는다.** 전표번호는 적어 두거나 옮겨 적는 값이라 몇 초 뒤에
 * 없어지면 안 된다 — 배너가 살아 있는 영역으로 알리되 글자는 화면에 남는다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ResultPane = ({ created }: ResultPaneProps) => (
  <section className="pane" aria-label={t.result.label}>
    <AlertBanner variant="success" title={t.result.createdTitle(created.inventoryAdjustmentNo)}>
      {t.result.createdDescription}
    </AlertBanner>

    {/*
     * **이름 하나에 값 하나로 짝을 맞춘다.** `<dt>` 하나 뒤의 `<dd>`는 전부 그 이름의 값이라,
     * 상태를 전표번호 아래에 그대로 두면 보조기술이 「전표번호: SAMPLE-IA-…, SAMPLE_…」로
     * 읽는다 — 이름 없는 값이 아니라 **틀린 이름이 붙은 값**이 된다.
     */}
    <dl className="filter-bar">
      <div className="field-cell">
        <dt className="field-label">{t.result.inventoryAdjustmentNo}</dt>
        <dd>{created.inventoryAdjustmentNo}</dd>
      </div>
      <div className="field-cell">
        <dt className="field-label">{t.result.statusCode}</dt>
        <dd>
          {/* 값으로 분기하지 않고 그대로 낸다 — 무슨 뜻인지는 화면이 판정하지 않는다(G-2). */}
          <Chip variant="status" size="sm">
            {created.statusCode}
          </Chip>
        </dd>
      </div>
      <div className="field-cell">
        <dt className="field-label">{t.result.erp}</dt>
        <dd>{erpQueueText(readErpQueue(created.erpMessageQueued))}</dd>
      </div>
    </dl>

    <p className="field-note">{t.result.statusNote}</p>

    <p>{t.result.lineCount(created.lineCount)}</p>

    {/* 적재는 전송이 아니다 — 상대 시스템에서 아직 보이지 않는 것이 정상이다. */}
    <p className="field-note">{t.result.erpNote}</p>
  </section>
);
