import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { usePopShellActions } from './pop-console/shell-actions';

const t = messages.popChrome;

export interface PopWorkerMissingBannerProps {
  /** 지금 화면을 쓰는 사람의 사번. 아직 못 받았으면 `null`. */
  workerNo: string | null;
}

/**
 * POP 본문 맨 위의 **사번 미확인 경고 띠** — 화면마다 같은 모양·같은 말로 한 곳에서 그린다
 * (사용자 지시 2026-09-17).
 *
 * 화면들이 제각기 하단 잠금 사유·잔글씨·띠로 갈라 적고 문구도 「…할 수 없습니다」 꼴로 달랐다.
 * 사번이 있으면 아무것도 그리지 않는다.
 *
 * ⭐ **풀 길을 함께 준다.** 사번 입력이 진입 페이지에서 상태바의 창으로 옮겨 갔으므로(P-CO-01),
 *    띠의 [작업자 확인]이 그 창을 바로 연다 — 「사번을 먼저」라고만 하고 길을 주지 않으면 작업자는
 *    어디서 사번을 넣는지 찾아야 한다. 골격 밖(화면 단위 시험)에서는 단추 없이 글만 선다.
 */
export const PopWorkerMissingBanner = ({ workerNo }: PopWorkerMissingBannerProps) => {
  const { openWorkerSignIn } = usePopShellActions();

  if (workerNo !== null && workerNo.trim() !== '') return null;

  return (
    <div className="banner-slot">
      <AlertBanner
        variant="warning"
        action={
          openWorkerSignIn === null ? undefined : (
            <Button type="button" variant="outlined" size="sm" onClick={openWorkerSignIn}>
              {t.console.statusBar.signIn}
            </Button>
          )
        }
      >
        {t.workerMissing}
      </AlertBanner>
    </div>
  );
};
