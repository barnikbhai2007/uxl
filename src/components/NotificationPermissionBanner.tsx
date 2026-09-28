import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, BellRing, X, Megaphone, CheckCircle2, ChevronRight, Pin } from 'lucide-react';
import { Announcement } from '../types';
import { requestBrowserNotificationPermission, soundService, sendBrowserNotification } from '../utils/notificationSound';

interface NotificationPermissionBannerProps {
  pinnedAnnouncement?: Announcement | null;
  onOpenAnnouncement?: (announcement: Announcement) => void;
}

export const NotificationPermissionBanner: React.FC<NotificationPermissionBannerProps> = ({
  pinnedAnnouncement,
  onOpenAnnouncement,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isDismissed, setIsDismissed] = useState(false);
  const [pinnedDismissed, setPinnedDismissed] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleEnable = async () => {
    const res = await requestBrowserNotificationPermission();
    setPermission(res);
    if (res === 'granted') {
      setJustEnabled(true);
      soundService.playAnnouncementChime();
      sendBrowserNotification('Notifications Activated! ⚽', {
        body: 'You will now receive live match notifications, opponent chat replies, and tournament announcements.'
      });
      setTimeout(() => setJustEnabled(false), 4500);
    }
  };

  return (
    <div className="w-full space-y-3 mb-6">
      {/* Pinned Broadcast Announcement (if present) */}
      {pinnedAnnouncement && !pinnedDismissed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-fc-purple-dark via-indigo-950 to-zinc-950 border border-fc-neon-green/40 p-3.5 sm:p-4 shadow-xl shadow-fc-neon-green/10"
        >
          <div className="flex items-start justify-between gap-3">
            <div
              className="flex items-start sm:items-center gap-3 flex-1 cursor-pointer min-w-0 active:opacity-80 transition-opacity touch-manipulation"
              onClick={() => onOpenAnnouncement && onOpenAnnouncement(pinnedAnnouncement)}
            >
              <div className="p-2 sm:p-2.5 rounded-xl bg-fc-neon-green/20 text-fc-neon-green shrink-0 border border-fc-neon-green/30 mt-0.5 sm:mt-0">
                <Megaphone className="w-4 h-4 sm:w-5 sm:h-5 animate-bounce" />
              </div>
              <div className="flex-1 min-w-0 pr-6 sm:pr-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-fc-neon-green text-black">
                    Official Announcement
                  </span>
                  <span className="text-[10px] text-white/50">
                    {new Date(pinnedAnnouncement.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <h4 className="text-sm sm:text-base font-bold text-white truncate mt-0.5 hover:text-fc-neon-green transition-colors flex items-center gap-1.5">
                  <span className="truncate">{pinnedAnnouncement.title}</span>
                  <ChevronRight className="w-4 h-4 text-fc-neon-green shrink-0 inline opacity-80" />
                </h4>
                <p className="text-xs text-white/70 line-clamp-1 sm:line-clamp-2 mt-0.5">
                  {pinnedAnnouncement.content}
                </p>
              </div>
            </div>
            <button
              onClick={() => setPinnedDismissed(true)}
              className="absolute top-3 right-3 p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10 active:scale-95 transition-all"
              title="Dismiss announcement bar"
              aria-label="Dismiss announcement"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* Ask Users To Turn On Notifications Banner (Mobile Compatible & Fully Responsive) */}
      <AnimatePresence>
        {permission !== 'granted' && !isDismissed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="relative rounded-2xl bg-zinc-900/95 border border-white/15 p-4 sm:p-5 backdrop-blur-xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Dismiss button positioned neatly at top right */}
              <button
                onClick={() => setIsDismissed(true)}
                className="absolute top-3 right-3 p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/10 active:scale-95 transition-colors"
                title="Dismiss notification banner"
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start sm:items-center gap-3 pr-8 sm:pr-0">
                <div className="p-2.5 rounded-xl bg-fc-neon-green/10 text-fc-neon-green border border-fc-neon-green/20 shrink-0 mt-0.5 sm:mt-0">
                  <BellRing className="w-5 h-5 animate-pulse text-fc-neon-green" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm sm:text-base">
                      Never miss a match or message!
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-fc-neon-green/20 text-fc-neon-green border border-fc-neon-green/30">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-white/60 leading-relaxed max-w-xl">
                    Turn on notifications to receive live match fixture alerts, direct opponent replies in campaign chat, and official admin announcements.
                  </p>
                </div>
              </div>

              {/* Full width button on mobile for comfortable one-thumb tapping */}
              <div className="w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
                <button
                  onClick={handleEnable}
                  className="w-full sm:w-auto px-5 py-3 bg-fc-neon-green text-black font-extrabold text-xs uppercase tracking-wider rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-fc-neon-green/25 flex items-center justify-center gap-2 touch-manipulation"
                >
                  <Bell className="w-4 h-4" />
                  <span>Turn On Notifications</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation feedback when just enabled */}
      {justEnabled && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="p-3.5 bg-fc-neon-green/15 border border-fc-neon-green rounded-2xl flex items-center gap-2.5 text-fc-neon-green text-xs font-bold shadow-lg"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>Notifications successfully enabled! You will now receive opponent replies and tournament updates directly on this device.</span>
        </motion.div>
      )}
    </div>
  );
};
