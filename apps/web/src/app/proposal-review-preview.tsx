import '@crefle/web-ui/styles/index.css';
import '@crefle/web-ui/css';
import './app.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ProposalReviewPreviewPage } from '../screens/production-order/proposal-review/preview';

// This entry is development-only and uses no business API or authentication bypass.
if (import.meta.env.DEV) {
  const container = document.getElementById('root');
  if (container)
    createRoot(container).render(
      <QueryClientProvider client={new QueryClient()}>
        <BrowserRouter>
          <div className="proposal-preview-frame">
            <ProposalReviewPreviewPage />
          </div>
        </BrowserRouter>
      </QueryClientProvider>,
    );
}
