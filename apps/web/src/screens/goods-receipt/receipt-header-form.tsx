import { TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.goodsReceipt;

export interface ReceiptHeaderFormProps {
  receiptDatetime: string;
  remarks: string;
  /** 화면이 잡은 오류와 서버가 준 필드 오류를 합친 것. 어느 쪽이든 같은 자리에 낸다 */
  fieldErrors: Record<string, string>;
  isLocked: boolean;
  onChangeReceiptDatetime: (value: string) => void;
  onChangeRemarks: (value: string) => void;
}

/**
 * 입고 일시와 비고.
 *
 * **영업일 입력칸을 두지 않는다.** 계약이 영업일을 필수로 요구하지만 산출 규칙(야간조 경계 등)이
 * 어디에도 정의돼 있지 않아, 입력칸을 두면 사용자가 무엇을 넣어야 하는지 화면이 설명할 수 없다.
 * 입고 일시의 날짜로 파생하고 **그 사실을 안내로 밝힌다**(계획 결정 10).
 *
 * **수량 입력칸이 없다.** 전량 입고라 고른 입하 라인의 수량을 그대로 싣는다(계획 결정 4) —
 * 값이 어디서 오는지 안내가 밝힌다. 밝히지 않으면 「수량을 어디서 고치나」를 찾게 된다.
 *
 * 설치본에 `DatePicker`가 없어 네이티브 타입으로 대체한다(W-01-07이 세운 처리).
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ReceiptHeaderForm = ({
  receiptDatetime,
  remarks,
  fieldErrors,
  isLocked,
  onChangeReceiptDatetime,
  onChangeRemarks,
}: ReceiptHeaderFormProps) => (
  <>
    <div className="form-grid">
      <TextField
        type="datetime-local"
        label={t.fields.receiptDatetime}
        value={receiptDatetime}
        error={fieldErrors.receiptDatetime}
        disabled={isLocked}
        onChange={(event) => {
          onChangeReceiptDatetime(event.target.value);
        }}
      />

      <TextField
        label={t.fields.remarks}
        value={remarks}
        error={fieldErrors.remarks}
        disabled={isLocked}
        onChange={(event) => {
          onChangeRemarks(event.target.value);
        }}
      />
    </div>

    {/* 입력칸이 없는 값이 무엇에서 정해지는지 밝힌다 — 밝히지 않으면 화면 어디에서도 읽을 수 없다. */}
    <div className="field-cell">
      <span className="field-note">{t.notes.businessDateDerived}</span>
      <span className="field-note">{t.notes.qtyFromInboundLine}</span>
    </div>
  </>
);
