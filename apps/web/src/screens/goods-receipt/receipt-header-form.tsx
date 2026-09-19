import { TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.goodsReceipt;

export interface ReceiptHeaderFormProps {
  receiptDatetime: string;
  remarks: string;
  /** 화면이 잡은 오류와 서버가 준 필드 오류를 합친 것. 어느 쪽이든 같은 자리에 낸다 */
  fieldErrors: Record<string, string>;
  isLocked: boolean;
  /** 입고 일시·비고 칸이 열려 있는가 — 입고 정보는 순서대로 입력한다(`post-steps.ts`). 주지 않으면 열린다. */
  isOpen?: boolean;
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
  isOpen = true,
  onChangeReceiptDatetime,
  onChangeRemarks,
}: ReceiptHeaderFormProps) => (
  <>
    <div className="form-grid goods-receipt-post-grid">
      <div className="field-cell goods-receipt-step-receiptDatetime">
        <TextField
          type="datetime-local"
          label={t.fields.receiptDatetime}
          required
          /* 영업일은 따로 넣는 칸이 없다 — 어디서 정해지는지 이 칸 바로 아래에 밝힌다(사용자 지시). */
          helperText={t.notes.businessDateDerived}
          value={receiptDatetime}
          error={fieldErrors.receiptDatetime}
          disabled={isLocked || !isOpen}
          onChange={(event) => {
            onChangeReceiptDatetime(event.target.value);
          }}
        />
      </div>

      <div className="field-cell">
        <TextField
          label={t.fields.remarks}
          value={remarks}
          error={fieldErrors.remarks}
          disabled={isLocked || !isOpen}
          onChange={(event) => {
            onChangeRemarks(event.target.value);
          }}
        />
      </div>
    </div>
  </>
);
