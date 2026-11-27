import { AlertBanner, Button, Dialog, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { InfoEmpty, InfoGroupTitle } from '../../patterns/info-facts';
import { toVisibleLine } from './approval-progress-pane';
import { toReasonLines } from './types';

const t = messages.disposalIssue;

/**
 * 창이 보이는 줄 하나.
 *
 * **이름이 아니라 값이 온다.** 참조 풀이·수량 표기는 화면이 이미 끝냈고, 이 창은 받은 것을
 * 그리기만 한다 — 여기서 다시 만들면 **확인한 값과 보내는 값이 갈린다.**
 *
 * 줄을 가르는 것은 **표시 순번**이다. 내부 번호를 쓰지 않는다(`omf-mes#44`) — 화면 글자가
 * 아니어도 DOM에 남고, 한 번 쓰기 시작하면 접근 이름으로도 새기 쉽다.
 */
export interface SubmitLineSummary {
  ordinal: number;
  itemName: string;
  /** 이름을 아직 못 풀었으면 빈 글 — 그때는 `itemName`이 그 사정(불러오는 중 등)을 말한다 */
  itemCode: string;
  lot: string;
  /** 「30 EA」 — 단위 코드를 한 번만 붙인 표기 그대로 */
  qty: string;
}

export interface SubmitSummary {
  /** 폐기의 근거가 되는 입고 전표. **업무 번호다** — 내부 번호가 아니다 */
  goodsReceiptNo: string;
  warehouseName: string;
  /** 코드는 **이름**으로 온다(코드값 이름 · 없으면 코드 그대로). 보내는 값은 화면이 든 코드다 */
  issueTypeName: string;
  sourceDocumentTypeName: string;
  reasonName: string;
  /** 「2026-08-11 09:30」 — 보이는 표기 그대로 */
  issuedAt: string;
  /** **파생값이다.** 사용자가 넣은 적 없는 값이므로 창이 그 사실을 함께 밝힌다 */
  businessDate: string;
  remarks: string;
  /**
   * 폐기한 물건이 어디로 가는가 — 「자체 폐기」 또는 **고른 폐기 거래처의 이름**(#128).
   *
   * **한 값으로 받는다.** 나가는 본문의 두 키는 이 하나에서 따라오므로(도착지 유형은 상수다)
   * 창이 유형과 번호를 따로 보이면 사용자가 정하지 않은 것을 확인하게 된다. 판정과 글자는
   * `issue-request.ts`가 만든다 — **확인한 글자와 나가는 값이 같은 자리에서 나온다.**
   */
  destination: string;
  lines: readonly SubmitLineSummary[];
  /** 결재 요청 사유 **전문**. 줄바꿈이 유지된다 */
  reason: string;
  /** 상한을 확인하지 못한 줄이 **섞여 있는가**. 있으면 그 사실을 창이 밝힌다 */
  hasUnknownOnHand: boolean;
}

export interface SubmitConfirmDialogProps {
  summary: SubmitSummary;
  onConfirm: () => void;
  onClose: () => void;
}

interface SummaryRow {
  key: string;
  label: string;
  value: string;
}

const isBlank = (value: string): boolean => value.trim() === '';

/** 「출고 정보」 상자 — 비고는 값이 있을 때만. */
const toIssueInfo = (summary: SubmitSummary): SummaryRow[] => [
  { key: 'goodsReceiptNo', label: t.summary.goodsReceiptNo, value: summary.goodsReceiptNo },
  { key: 'warehouse', label: t.summary.warehouse, value: summary.warehouseName },
  { key: 'reason', label: t.formFields.reason, value: summary.reasonName },
  { key: 'issuedAt', label: t.dialog.issuedAt, value: summary.issuedAt },
  /*
   * **도착지는 한 행이다** — 사용자가 정한 것은 「어디로 가는가」 하나이고 본문의 두 키는 거기서
   * 따라온다. 라벨은 입력 화면과 같은 「폐기 거래처」(값은 거래처 이름 또는 「자체 폐기」).
   */
  { key: 'destination', label: t.formFields.disposalPartner, value: summary.destination },
  ...(isBlank(summary.remarks)
    ? []
    : [{ key: 'remarks', label: t.formFields.remarks, value: summary.remarks }]),
];

/** 접힌 「처리 상세」 — 확인 빈도가 낮은 값. */
const toDetails = (summary: SubmitSummary): SummaryRow[] => [
  { key: 'issueType', label: t.formFields.issueType, value: summary.issueTypeName },
  {
    key: 'sourceDocumentType',
    label: t.formFields.sourceDocumentType,
    value: summary.sourceDocumentTypeName,
  },
  /* 파생값임을 **값 자체가** 밝힌다 — 라벨만으로는 사용자가 자기가 넣은 값으로 읽는다. */
  {
    key: 'businessDate',
    label: t.formFields.businessDate,
    value: t.dialog.businessDateAuto(summary.businessDate),
  },
];

/** 이름 · 값 줄 — 라벨 열과 값 열의 시작점을 맞춘다. 값이 없으면 회색 「—」. */
const FactList = ({ rows }: { rows: readonly SummaryRow[] }) => (
  <dl className="di-confirm-facts">
    {rows.map((row) => (
      <div className="di-confirm-fact" key={row.key}>
        <dt className="field-label">{row.label}</dt>
        <dd>{isBlank(row.value) ? <InfoEmpty /> : row.value}</dd>
      </div>
    ))}
  </dl>
);

/**
 * 승인 요청 확인 — **되돌릴 수 없는 조작 앞의 마지막 층이다.**
 *
 * **이 조작 한 번에 요청이 둘 나간다**(승인 기록 정정 1-1) — 전표를 만들고 이어서 결재에
 * 올린다. 창이 그 사실을 적는 이유는, 「승인을 요청했는데 전표만 생겼다」는 중간 실패가
 * 실재하고 그때 사용자가 무슨 일이 일어난 것인지 알아야 하기 때문이다.
 *
 * **재고는 아직 움직이지 않는다.** 이 화면에서 재고가 빠지는 순간은 승인 뒤의 「기타출고 처리」
 * 하나뿐이고(계약 `:post` — 승인 전이면 400), 창이 그 경계를 분명히 한다.
 *
 * **승인 요청은 되돌릴 수 없다.** 계약의 승인 요청에는 승인 · 반려만 있다. 반려된 뒤 다시 올릴
 * 수는 있으나 그것은 **새 요청**이다(스펙 §6).
 *
 * 모양은 공급사 반품 확인 창과 같은 틀이다(#360) — 맨 위 「폐기 대상 N건」, 「출고 정보」 상자,
 * 접힌 「처리 상세」, 결재 요청 사유, 단추 바로 위 경고 상자. 창 높이는 내용만큼이고 넘치면
 * 본문만 구른다(공용 `Dialog` 본문).
 *
 * **창 안에 선택칸을 두지 않는다**(`omf-mes#45` · 디자인 시스템 갭). 이 창은 값을 고치는
 * 자리가 아니라 확인하는 자리다 — 고칠 것이 있으면 닫고 폼에서 고친다(입력값은 그대로 남는다).
 *
 * **스크림 클릭·X로 닫히지 않게 한다**(`closeOnBackdropClick={false}`·`showCloseButton={false}`).
 * 되돌릴 수 없는 조작을 확인하는 창이 스치는 클릭에 사라지면 확인 자체가 형식이 된다 —
 * 파기 확인 창과 갈리는 자리다. Escape는 막을 수 없으므로 그 길의 규율은 화면의 `resetIfIdle`이
 * 갖는다(나가는 중인 쓰기를 끊지 않는다).
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const SubmitConfirmDialog = ({ summary, onConfirm, onClose }: SubmitConfirmDialogProps) => {
  const reasonLines = toReasonLines(summary.reason);

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      closeOnBackdropClick={false}
      showCloseButton={false}
      title={t.dialog.submitTitle}
      footer={
        <>
          {/* 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */}
          <Button variant="outlined" onClick={onClose}>
            {t.actions.backToInput}
          </Button>
          <Button onClick={onConfirm}>{t.actions.requestApproval}</Button>
        </>
      }
    >
      <div className="sr-confirm-body">
        {/*
         * **무엇이 얼마나 나가는지를 줄마다 다시 보인다.** 합계만 보이면 어느 줄이 얼마인지
         * 확인할 수 없고, 이 화면에서 잘못 실린 수량은 승인을 거쳐 그대로 재고에서 빠진다.
         * 줄은 순번 차례 그대로 — 내부 번호를 키로 쓰지 않는다(#44).
         */}
        <section aria-label={t.dialog.targetHead(summary.lines.length)}>
          <InfoGroupTitle>{t.dialog.targetHead(summary.lines.length)}</InfoGroupTitle>
          <ul className="di-confirm-lines">
            {summary.lines.map((line) => (
              <li className="di-confirm-line" key={line.ordinal}>
                <div className="di-confirm-line-main">
                  <div className="di-confirm-line-item">
                    <span className="di-confirm-line-name">{line.itemName}</span>
                    {line.itemCode !== '' && (
                      <span className="di-confirm-line-code">{line.itemCode}</span>
                    )}
                  </div>
                  <div className="di-confirm-line-lot" title={line.lot}>
                    {`${t.lineTable.lot} ${line.lot}`}
                  </div>
                </div>
                <div className="di-confirm-line-qty">
                  <span className="visually-hidden">{t.dialog.disposalQty}</span>
                  <span>{line.qty}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label={t.dialog.issueInfo}>
          <InfoGroupTitle>{t.dialog.issueInfo}</InfoGroupTitle>
          <FactList rows={toIssueInfo(summary)} />
        </section>

        <details className="sr-confirm-details">
          <summary>
            {t.dialog.details}
            <Icon name="expand_more" size={20} aria-hidden />
          </summary>
          <FactList rows={toDetails(summary)} />
        </details>

        <section aria-label={t.dialog.approvalReason}>
          <InfoGroupTitle>{t.dialog.approvalReason}</InfoGroupTitle>
          {/*
           * 줄바꿈이 뜻을 나른다 — 한 줄로 이어 붙이면 문단 구분이 사라진다. 줄마다 상자를 세우고
           * 빈 줄은 보이는 글자로 바꾼다(결재 진행 구획과 같은 처리).
           */}
          <div className="di-confirm-reason">
            {reasonLines.map((line, index) => (
              <p key={`${String(index)}:${line}`}>{toVisibleLine(line)}</p>
            ))}
          </div>
          {/* 결재함 목록에서 요약을 겸하는 것이 첫 줄이다 — 여러 줄일 때만 밝힌다. */}
          {reasonLines.length > 1 && <p className="field-note">{t.dialog.reasonFirstLineNote}</p>}
        </section>

        {summary.hasUnknownOnHand && <p className="field-note">{t.dialog.submitOnHandUnknown}</p>}

        <AlertBanner variant="warning">
          <span>{t.dialog.submitLead}</span>
          <br />
          <span>{t.dialog.submitEffects}</span>
          <br />
          <span>{t.dialog.submitNoUndo}</span>
        </AlertBanner>
      </div>
    </Dialog>
  );
};
