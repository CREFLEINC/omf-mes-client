import type { components, paths } from '@omf-mes/api-client';

/** W-CO-13 알림 발송 이력. api-client 는 `import type` 으로만 참조한다. */
type Schemas = components['schemas'];

export type NotificationEvent = Schemas['NotificationEvent'];
export type Department = Schemas['Department'];
export type PageMeta = Schemas['PageMeta'];
export type DispatchPage = Schemas['NotificationDispatchPage'];
export type Dispatch = DispatchPage['items'][number];
export type DeliveryPage = Schemas['ZaloDeliveryPage'];
export type Delivery = DeliveryPage['items'][number];
export type DeliveryStatus = Delivery['status'];
export type DispatchQuery = paths['/app/notification-dispatches']['get']['parameters']['query'];
