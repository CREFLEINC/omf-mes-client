import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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
 */
export const PopWorkerMissingBanner = ({ workerNo }: PopWorkerMissingBannerProps) =>
  workerNo === null || workerNo.trim() === '' ? (
    <div className="banner-slot">
      <AlertBanner variant="warning">{t.workerMissing}</AlertBanner>
    </div>
  ) : null;
