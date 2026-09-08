import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { PopSelect as Select } from '../../patterns/pop-select';
import { popTouchClass } from '../../patterns/pop-touch';
import type { ReissueReasonOption } from './queries';

const t = messages.popMaterialLotLabel.target.reissueDialog;

export interface ReissueDialogProps {
  reasons: ReissueReasonOption[];
  isLoading: boolean;
  isError: boolean;
  onConfirm: (reissueReasonCode: string) => void;
  onCancel: () => void;
}

/**
 * 재인쇄 사유를 받는 창.
 *
 * ⛔ **사유 없이 보내지 않는다.** 회차가 2 이상인 발행에 사유가 없으면 서버가 422 로 막는다 —
 * 그 거절을 화면이 미리 막아 사용자가 이유 없이 실패를 보지 않게 한다.
 *
 * ⛔ **선택지를 화면이 지어내지 않는다.** 값 목록은 서버가 내려 준다. 비어 오면 재인쇄를 열지
 * 않고 **왜 못 하는지** 보인다(공유계약 F-1·G-2) — 빈 목록을 「사유 없음」으로 통과시키면
 * 서버 거절이 그 자리에서 나온다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ReissueDialog = ({
  reasons,
  isLoading,
  isError,
  onConfirm,
  onCancel,
}: ReissueDialogProps) => {
  const [selected, setSelected] = useState<string | null>(null);

  const isChoosable = !isLoading && !isError && reasons.length > 0;
  /* 고르지 않은 채로는 보낼 수 없다 — 빈 값을 사유로 실으면 서버가 422 로 막는다. */
  const isReady = isChoosable && selected !== null;

  return (
    <Dialog
      open
      onClose={onCancel}
      size="md"
      closeOnBackdropClick={false}
      /*
       * ⛔ **X 를 두지 않는다**(사용자 결정 2026-09-08). 나가는 길이 바닥의 「취소」와
       *    우상단 X 로 둘이면, 장갑 낀 손이 어느 쪽을 눌러야 하는지 매번 고른다 —
       *    같은 일을 하는 단추가 둘이면 단말에서는 그냥 오조작 자리다.
       */
      showCloseButton={false}
      title={t.title}
      footer={
        <>
          {/*
           * ⭐ **둘의 크기를 맞춘다**(사용자 결정 2026-09-08) — 글자 수가 달라 폭이 갈리면
           *    「큰 쪽이 옳은 쪽」으로 읽힌다. 여기서 고르는 것은 옳고 그름이 아니다.
           */}
          <Button
            className={`${popTouchClass('normal')} pop-reissue-action`}
            variant="outlined"
            size="xl"
            onClick={onCancel}
          >
            {t.cancel}
          </Button>
          <Button
            className={`${popTouchClass('critical')} pop-reissue-action`}
            size="xl"
            disabled={!isReady}
            onClick={() => {
              if (selected !== null) onConfirm(selected);
            }}
          >
            {t.confirm}
          </Button>
        </>
      }
    >
      {isError ? <AlertBanner variant="error">{t.loadFailed}</AlertBanner> : null}
      {!isError && !isLoading && reasons.length === 0 ? (
        <AlertBanner variant="warning">{t.empty}</AlertBanner>
      ) : null}

      {isChoosable ? (
        /*
         * ⛔ **이름표를 붙이지 않는다**(사용자 결정 2026-09-08). 창 제목이 「재인쇄 사유」고
         *    고를 것이 이 하나뿐이라, 「사유」를 한 번 더 적어도 알려 주는 것이 없다.
         *    ⚠ 화면 낭독용 이름은 `aria-label` 로 남긴다 — 보이지 않을 뿐 사라지면 안 된다.
         */
        <Select
          aria-label={t.label}
          size="xl"
          placeholder={t.placeholder}
          value={selected}
          options={reasons.map((reason) => ({ value: reason.code, label: reason.name }))}
          onChange={setSelected}
        />
      ) : null}
    </Dialog>
  );
};
