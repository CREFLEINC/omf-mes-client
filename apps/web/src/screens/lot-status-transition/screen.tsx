import { AlertBanner, Breadcrumb, Button, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

import { LotStatusTransitionCandidateScreen } from './candidate-screen';

const t = messages.lotStatusTransition;

export const LotStatusTransitionScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="screen lot-status-transition-screen">
      {/*
       * 변경 이력 이동은 안내 띠 옆 글자 링크가 아니라 머리의 보조 단추다 — 띠와 한 덩어리로 읽히지
       * 않게 떼어 둔다. 가는 곳(W-03-01)은 그대로다.
       */}
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
        actions={
          <Button variant="outlined" size="sm" onClick={() => void navigate('/quality/lot-status')}>
            {t.historyLink}
          </Button>
        }
      />
      <div className="lot-status-transition-workspace">
        <div className="banner-slot lot-status-transition-notice">
          <AlertBanner variant="warning">{t.historyNotice}</AlertBanner>
        </div>
        <LotStatusTransitionCandidateScreen />
      </div>
    </div>
  );
};
