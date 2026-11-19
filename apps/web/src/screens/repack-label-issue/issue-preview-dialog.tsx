import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { PuButton, PuDialog, PuNote } from '../../patterns/pop-uniform';
import type { PackingLabelDraw } from './packing-label';

const t = messages.repackLabelIssue;

export interface IssuePreviewTarget {
  handlingUnitId: number;
  issueSeq: number;
}

/**
 * 「라벨 발행 미리 보기」(#295 시안) — **발행 «전»에** 라벨 모양을 보인다.
 *
 * ⛔ 기록을 만들지 않는다. 창의 [발번·인쇄]는 화면의 [발번·인쇄]와 같은 일을 한다(사유가 필요하면
 *    사유 창으로 넘어간다). [취소]는 창만 닫는다.
 */
export const IssuePreviewDialog = ({
  draw,
  targets,
  canIssue,
  onIssue,
  onClose,
}: {
  draw: PackingLabelDraw;
  targets: readonly IssuePreviewTarget[];
  canIssue: boolean;
  onIssue: () => void;
  onClose: () => void;
}) => {
  const [urls, setUrls] = useState<string[] | null>(null);
  const [failed, setFailed] = useState(false);
  const key = targets
    .map((each) => `${String(each.handlingUnitId)}:${String(each.issueSeq)}`)
    .join();

  useEffect(() => {
    let alive = true;
    let made: string[] = [];
    setUrls(null);
    setFailed(false);
    Promise.all(targets.map((each) => draw(each.handlingUnitId, each.issueSeq)))
      .then((drawn) => {
        made = drawn.map((one) => URL.createObjectURL(new Blob([one.png], { type: 'image/png' })));
        if (alive) setUrls(made);
        else made.forEach((url) => URL.revokeObjectURL(url));
      })
      .catch(() => {
        if (alive) setFailed(true);
      });

    return () => {
      alive = false;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 대상이 같으면 다시 그리지 않는다
  }, [draw, key]);

  return (
    <PuDialog
      title={t.preview.issueTitle}
      wide
      onClose={onClose}
      footer={
        <>
          <PuButton onClick={onClose}>{t.preview.close}</PuButton>
          <PuButton variant="primary" disabled={!canIssue} onClick={onIssue}>
            {t.issue.submitCount(targets.length)}
          </PuButton>
        </>
      }
    >
      <div className="rpk-dialog">
        {failed ? (
          <PuNote tone="bad">{t.preview.failed}</PuNote>
        ) : urls === null ? (
          <PuNote>{t.preview.loading}</PuNote>
        ) : (
          urls.map((url) => (
            <img key={url} className="rpk-preview-image" src={url} alt={t.preview.alt} />
          ))
        )}
      </div>
    </PuDialog>
  );
};
