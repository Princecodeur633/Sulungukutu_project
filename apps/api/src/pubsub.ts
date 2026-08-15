/**
 * PubSub centralisé — module standalone pour éviter les imports circulaires.
 * En production : remplacer createPubSub par @graphql-yoga/redis-pubsub
 */
import { createPubSub } from 'graphql-yoga';

export type PubSubChannels = {
  NOTIFICATION_ADDED:     [profileId: string, payload: { notificationAdded: unknown }];
  MESSAGE_RECEIVED:       [schoolId: string,  payload: { messageReceived:    unknown }];
  ATTENDANCE_UPDATED:     [csId: string,      payload: { attendanceUpdated:  unknown }];
  BULLETIN_STATUS:        [studentId: string, payload: { bulletinStatusChanged: unknown }];
  PAYMENT_STATUS:         [studentId: string, payload: { paymentStatusChanged:  unknown }];
  REMOTE_PAYMENT_STATUS:  [transactionId: string, payload: { remotePaymentStatusChanged: unknown }];
  ANNOUNCEMENT_PUBLISHED: [schoolId: string,  payload: { announcementPublished: unknown }];
};

export const pubsub = createPubSub<PubSubChannels>();
