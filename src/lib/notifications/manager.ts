/**
 * Notification Manager
 * Creates and manages user notifications for processing events
 */

import { adminFirestore } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export type NotificationType = 
  | 'coach_video_ready' 
  | 'coach_video_failed' 
  | 'coach_batch_complete' 
  | 'student_video_ready' 
  | 'oauth_expired';

export interface NotificationData {
  userId: string;
  coachId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a notification
 */
export async function createNotification(data: NotificationData): Promise<string> {
  const db = adminFirestore();
  
  const notificationRef = await db.collection('notifications').add({
    userId: data.userId,
    coachId: data.coachId || null,
    type: data.type,
    title: data.title,
    message: data.message,
    actionUrl: data.actionUrl || null,
    metadata: data.metadata || null,
    read: false,
    createdAt: Timestamp.now(),
  });

  console.log('[Notifications] Created:', {
    notificationId: notificationRef.id,
    userId: data.userId,
    type: data.type,
  });

  return notificationRef.id;
}

async function getCoachRecipientIds(coachId: string): Promise<string[]> {
  const db = adminFirestore();
  const snapshot = await db
    .collection('users')
    .where('coachId', '==', coachId)
    .get();
  const recipients = snapshot.docs
    .filter(doc => ['coach', 'admin'].includes(doc.data()?.role))
    .map(doc => doc.id);
  return recipients.length > 0 ? recipients : [coachId];
}

/**
 * Notify coach that video is ready
 */
export async function notifyVideoReady(
  coachId: string,
  videoId: string,
  videoTitle: string,
  assignmentId?: string
): Promise<void> {
  const recipients = await getCoachRecipientIds(coachId);
  await Promise.all(
    recipients.map(userId =>
      createNotification({
        userId,
        coachId,
        type: 'coach_video_ready',
        title: 'Video Ready',
        message: `"${videoTitle}" has been processed and is ready for students`,
        actionUrl: assignmentId ? `/dashboard/assignments/${assignmentId}` : `/dashboard/videos/${videoId}`,
        metadata: { videoId, videoTitle, assignmentId },
      })
    )
  );
}

/**
 * Notify coach that video processing failed
 */
export async function notifyVideoFailed(
  coachId: string,
  videoId: string,
  videoTitle: string,
  errorMessage: string,
  assignmentId?: string
): Promise<void> {
  const recipients = await getCoachRecipientIds(coachId);
  await Promise.all(
    recipients.map(userId =>
      createNotification({
        userId,
        coachId,
        type: 'coach_video_failed',
        title: 'Video Processing Failed',
        message: `"${videoTitle}" failed: ${errorMessage}`,
        actionUrl: assignmentId ? `/dashboard/assignments/${assignmentId}` : `/dashboard/videos/${videoId}`,
        metadata: { videoId, videoTitle, errorMessage, assignmentId },
      })
    )
  );
}

/**
 * Notify coach that batch job is complete
 */
export async function notifyBatchComplete(
  coachId: string,
  jobId: string,
  totalVideos: number,
  successCount: number,
  failedCount: number
): Promise<void> {
  const message = failedCount > 0
    ? `Batch complete: ${successCount} succeeded, ${failedCount} failed`
    : `Batch complete: All ${successCount} videos processed successfully`;

  const recipients = await getCoachRecipientIds(coachId);
  await Promise.all(
    recipients.map(userId =>
      createNotification({
        userId,
        coachId,
        type: 'coach_batch_complete',
        title: 'Batch Processing Complete',
        message,
        actionUrl: `/admin/processing/queue?jobId=${jobId}`,
        metadata: { jobId, totalVideos, successCount, failedCount },
      })
    )
  );
}

/**
 * Notify students that a new video is ready
 */
export async function notifyStudentsVideoReady(
  studentIds: string[],
  videoId: string,
  videoTitle: string,
  assignmentId: string
): Promise<void> {
  const db = adminFirestore();
  const batch = db.batch();

  studentIds.forEach(studentId => {
    const notificationRef = db.collection('notifications').doc();
    batch.set(notificationRef, {
      userId: studentId,
      coachId: null,
      type: 'student_video_ready',
      title: 'New Video Available',
      message: `"${videoTitle}" is now ready to watch`,
      actionUrl: `/dashboard/assignments/${assignmentId}`,
      metadata: { videoId, videoTitle, assignmentId },
      read: false,
      createdAt: Timestamp.now(),
    });
  });

  await batch.commit();

  console.log('[Notifications] Notified students:', {
    count: studentIds.length,
    videoId,
    videoTitle,
  });
}

/**
 * Notify coach that OAuth token expired
 */
export async function notifyOAuthExpired(coachId: string): Promise<void> {
  const recipients = await getCoachRecipientIds(coachId);
  await Promise.all(
    recipients.map(userId =>
      createNotification({
        userId,
        coachId,
        type: 'oauth_expired',
        title: 'YouTube Connection Expired',
        message: 'Please reconnect your YouTube account to continue using OAuth captions',
        actionUrl: '/dashboard/youtube',
        metadata: {},
      })
    )
  );
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  const db = adminFirestore();
  await db.collection('notifications').doc(notificationId).update({
    read: true,
  });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const db = adminFirestore();
  
  const unreadSnapshot = await db.collection('notifications')
    .where('userId', '==', userId)
    .where('read', '==', false)
    .get();

  const batch = db.batch();
  unreadSnapshot.docs.forEach(doc => {
    batch.update(doc.ref, { read: true });
  });

  await batch.commit();
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const db = adminFirestore();
  
  const unreadSnapshot = await db.collection('notifications')
    .where('userId', '==', userId)
    .where('read', '==', false)
    .get();

  return unreadSnapshot.size;
}
