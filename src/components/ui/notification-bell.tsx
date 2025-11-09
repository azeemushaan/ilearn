'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useFirestore, useFirebaseAuth } from '@/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  coachId?: string | null;
  actionUrl?: string;
  read: boolean;
  createdAt: any;
}

export function NotificationBell() {
  const firestore = useFirestore();
  const { user } = useFirebaseAuth();
  const router = useRouter();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Set up real-time listener with tab visibility check
  useEffect(() => {
    if (!firestore || !user?.uid) return;

    const setupListener = () => {
      try {
        const notificationsQuery = query(
          collection(firestore, 'notifications'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(20)
        );

        const unsubscribe = onSnapshot(
          notificationsQuery,
          (snapshot) => {
            const notifs: Notification[] = [];
            let unread = 0;

            snapshot.docs.forEach(doc => {
              const data = doc.data();
              notifs.push({
                id: doc.id,
                type: data.type,
                title: data.title,
                message: data.message,
                actionUrl: data.actionUrl,
                read: data.read,
                createdAt: data.createdAt,
              });

              if (!data.read) {
                unread++;
              }
            });

            // Debounce UI updates (300ms)
            setTimeout(() => {
              setNotifications(notifs);
              setUnreadCount(unread);
            }, 300);
          },
          (error) => {
            console.error('[Notifications] Listener error:', error);
            toast({
              title: 'Notifications unavailable',
              description: 'Real-time updates temporarily disabled. Please refresh later.',
              variant: 'destructive',
            });
            setNotifications([]);
            setUnreadCount(0);
          }
        );

        unsubscribeRef.current = unsubscribe;
      } catch (error) {
        console.error('[Notifications] Failed to set up listener:', error);
        // Fallback to empty state
        setNotifications([]);
        setUnreadCount(0);
      }
    };

    // Only set up listener when tab is visible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden - unsubscribe to save reads
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      } else {
        // Tab visible - resubscribe
        if (!unsubscribeRef.current) {
          setupListener();
        }
      }
    };

    // Initial setup
    if (!document.hidden) {
      setupListener();
    }

    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [firestore, user]);

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read && firestore) {
      try {
        const notifRef = doc(firestore, 'notifications', notification.id);
        await updateDoc(notifRef, { read: true });
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Navigate to action URL
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }

    setOpen(false);
  };

  const handleMarkAllRead = async () => {
    if (!firestore || !user?.uid) return;

    try {
      const batch = writeBatch(firestore);
      
      notifications
        .filter(n => !n.read)
        .forEach(n => {
          const notifRef = doc(firestore, 'notifications', n.id);
          batch.update(notifRef, { read: true });
        });

      await batch.commit();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'coach_video_ready':
      case 'student_video_ready':
        return '✅';
      case 'coach_video_failed':
        return '❌';
      case 'coach_batch_complete':
        return '📦';
      case 'oauth_expired':
        return '⚠️';
      default:
        return '🔔';
    }
  };

  const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-2">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={cn(
                  'flex flex-col items-start gap-1 px-3 py-3 cursor-pointer',
                  !notification.read && 'bg-blue-50'
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-2 w-full">
                  <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{notification.title}</p>
                      {!notification.read && (
                        <div className="h-2 w-2 rounded-full bg-blue-600 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getRelativeTime(notification.createdAt)}
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
