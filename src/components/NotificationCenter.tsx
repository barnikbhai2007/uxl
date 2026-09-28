import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, BellRing, X, Megaphone, MessageSquare, Volume2, VolumeX, Shield, Check, ExternalLink, Sparkles, Pin } from 'lucide-react';
import { Announcement, DirectChatMessage } from '../types';
import { soundService, requestBrowserNotificationPermission, sendBrowserNotification } from '../utils/notificationSound';

interface NotificationCenterProps {
  announcements: Announcement[];
  messages: DirectChatMessage[];
  currentUserId?: string;
  onOpenChatWithOpponent?: (opponentId: string, matchId?: string) => void;
  onViewAllAnnouncements?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  announcements,
  messages,
  currentUserId,
  onOpenChatWithOpponent,
  onViewAllAnnouncements,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'announcements' | 'messages'>('all');
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('read_announcements') || '[]');
    } catch {
      return [];
    }
  });
  const [readMessageIds, setReadMessageIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('read_messages') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen && typeof document !== 'undefined') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Filter unread
  const unreadAnnouncements = announcements.filter(a => !readAnnouncementIds.includes(a.id));
  const myIncomingMessages = messages.filter(m => m.recipientId === currentUserId);
  const unreadMessages = myIncomingMessages.filter(m => !readMessageIds.includes(m.id));

  const totalUnreadCount = unreadAnnouncements.length + unreadMessages.length;

  const handleRequestPermission = async () => {
    const res = await requestBrowserNotificationPermission();
    setPermission(res);
    if (res === 'granted') {
      soundService.playAnnouncementChime();
      sendBrowserNotification('Notifications Enabled! 🔔', {
        body: 'You will now receive live match updates, announcements, and direct messages from opponents.'
      });
    }
  };

  const markAllRead = () => {
    const allAnnounceIds = announcements.map(a => a.id);
    const allMsgIds = myIncomingMessages.map(m => m.id);
    setReadAnnouncementIds(allAnnounceIds);
    setReadMessageIds(allMsgIds);
    try {
      localStorage.setItem('read_announcements', JSON.stringify(allAnnounceIds));
      localStorage.setItem('read_messages', JSON.stringify(allMsgIds));
    } catch {}
  };

  const markAnnouncementRead = (id: string) => {
    if (!readAnnouncementIds.includes(id)) {
      const updated = [...readAnnouncementIds, id];
      setReadAnnouncementIds(updated);
      try {
        localStorage.setItem('read_announcements', JSON.stringify(updated));
      } catch {}
    }
  };

  return (
    <>
      <div className="relative inline-flex items-center">
        {/* Bell Trigger Button with comfortable 44px+ touch target */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(prev => !prev);
          }}
          className="relative p-2.5 sm:p-3 min-w-[42px] min-h-[42px] flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-white hover:text-fc-neon-green transition-all focus:outline-none touch-manipulation shadow-sm cursor-pointer"
          title="Notifications & Announcements"
          aria-label="Open notifications"
        >
          {totalUnreadCount > 0 ? (
            <BellRing className="w-5 h-5 text-fc-neon-green animate-wiggle" />
          ) : (
            <Bell className="w-5 h-5 text-white/70 hover:text-white" />
          )}

          {totalUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 px-1.5 py-0.5 min-w-[20px] h-[20px] text-[10px] font-extrabold bg-fc-neon-green text-black rounded-full flex items-center justify-center shadow-lg shadow-fc-neon-green/50 animate-pulse">
              {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Render drawer via Portal directly into document.body to avoid clipping or stacking issues */}
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[99998] pointer-events-auto">
              {/* Backdrop for both mobile and desktop */}
              <motion.div
                key="notification-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-md"
                onClick={() => setIsOpen(false)}
              />

              {/* Notification Drawer: Slide-up Bottom Sheet on Mobile, Popover on Desktop */}
              <motion.div
                key="notification-drawer"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                transition={{ type: "spring", damping: 28, stiffness: 350 }}
                className="fixed inset-x-0 bottom-0 sm:bottom-auto sm:top-20 sm:right-6 sm:inset-x-auto sm:w-[420px] w-full max-h-[85vh] sm:max-h-[80vh] rounded-t-[2rem] sm:rounded-3xl bg-zinc-950 border-t sm:border border-white/20 shadow-[0_20px_70px_rgba(0,0,0,0.9)] z-[99999] overflow-hidden flex flex-col"
              >
              {/* Mobile Drawer Pull Indicator */}
              <div className="w-12 h-1.5 bg-white/25 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

              {/* Header */}
              <div className="p-4 border-b border-white/10 bg-gradient-to-r from-fc-purple-dark via-zinc-950 to-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-fc-neon-green/10 border border-fc-neon-green/30 rounded-xl text-fc-neon-green">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Notifications</h3>
                    <p className="text-[10px] text-white/50">
                      {totalUnreadCount > 0 ? `${totalUnreadCount} new updates` : 'All caught up'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {totalUnreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="px-2.5 py-1 text-[11px] font-bold text-fc-neon-green hover:underline active:opacity-75"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 text-white/60 hover:text-white rounded-xl hover:bg-white/10 active:scale-95 transition-all min-w-[36px] min-h-[36px] flex items-center justify-center"
                    aria-label="Close notification drawer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Notification Permission Banner inside drawer (Mobile friendly) */}
              {permission !== 'granted' && (
                <div className="m-3 p-3 rounded-2xl bg-fc-neon-green/10 border border-fc-neon-green/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <BellRing className="w-3.5 h-3.5 text-fc-neon-green" />
                      Turn on device alerts
                    </p>
                    <p className="text-[10px] text-white/60 leading-tight">
                      Receive real-time match fixtures, announcements & opponent chats directly.
                    </p>
                  </div>
                  <button
                    onClick={handleRequestPermission}
                    className="w-full sm:w-auto px-3.5 py-2 bg-fc-neon-green text-black font-bold text-xs uppercase tracking-wider rounded-xl hover:brightness-110 active:scale-95 transition-all shrink-0 text-center"
                  >
                    Enable Alerts
                  </button>
                </div>
              )}

              {/* Responsive Segmented Tabs */}
              <div className="grid grid-cols-3 border-b border-white/10 bg-white/[0.02] text-xs font-bold">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`py-3 px-2 text-center border-b-2 transition-all text-xs ${
                    activeTab === 'all'
                      ? 'border-fc-neon-green text-fc-neon-green bg-fc-neon-green/5'
                      : 'border-transparent text-white/40 hover:text-white'
                  }`}
                >
                  All ({announcements.length + myIncomingMessages.length})
                </button>
                <button
                  onClick={() => setActiveTab('announcements')}
                  className={`py-3 px-2 text-center border-b-2 transition-all text-xs truncate ${
                    activeTab === 'announcements'
                      ? 'border-fc-neon-green text-fc-neon-green bg-fc-neon-green/5'
                      : 'border-transparent text-white/40 hover:text-white'
                  }`}
                >
                  Announce ({announcements.length})
                </button>
                <button
                  onClick={() => setActiveTab('messages')}
                  className={`py-3 px-2 text-center border-b-2 transition-all text-xs truncate ${
                    activeTab === 'messages'
                      ? 'border-fc-neon-green text-fc-neon-green bg-fc-neon-green/5'
                      : 'border-transparent text-white/40 hover:text-white'
                  }`}
                >
                  Opponents ({myIncomingMessages.length})
                </button>
              </div>

              {/* Notification List with Smooth Touch Scroll */}
              <div className="overflow-y-auto flex-1 p-3 space-y-2 overscroll-contain">
                {/* Announcements */}
                {(activeTab === 'all' || activeTab === 'announcements') &&
                  announcements.map((ann) => {
                    const isUnread = !readAnnouncementIds.includes(ann.id);
                    return (
                      <div
                        key={`ann-${ann.id}`}
                        onClick={() => markAnnouncementRead(ann.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] touch-manipulation ${
                          isUnread
                            ? 'bg-fc-neon-green/5 border-fc-neon-green/40 shadow-sm shadow-fc-neon-green/5'
                            : 'bg-white/5 border-white/5 hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="p-1 rounded-md bg-fc-purple-light/20 text-fc-neon-green">
                              <Megaphone className="w-3.5 h-3.5" />
                            </span>
                            {ann.pinned && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold flex items-center gap-0.5">
                                <Pin className="w-2.5 h-2.5" /> Pinned
                              </span>
                            )}
                            <span className="font-bold text-white text-xs leading-snug">{ann.title}</span>
                          </div>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-fc-neon-green shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-[11px] text-white/70 line-clamp-3 leading-relaxed">
                          {ann.content}
                        </p>
                        <div className="flex items-center justify-between text-[9px] text-white/40 mt-2.5 pt-2 border-t border-white/5">
                          <span>{new Date(ann.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(ann.createdAt).toLocaleDateString()}</span>
                          {ann.authorName && <span className="text-fc-neon-green/80 font-bold">Admin Broadcast</span>}
                        </div>
                      </div>
                    );
                  })}

                {/* Opponent Messages */}
                {(activeTab === 'all' || activeTab === 'messages') &&
                  myIncomingMessages.map((msg) => {
                    const isUnread = !readMessageIds.includes(msg.id);
                    return (
                      <div
                        key={`msg-${msg.id}`}
                        onClick={() => {
                          if (onOpenChatWithOpponent) {
                            onOpenChatWithOpponent(msg.senderId, msg.matchId);
                            setIsOpen(false);
                          }
                        }}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] touch-manipulation ${
                          isUnread
                            ? 'bg-blue-500/10 border-blue-500/40 shadow-sm shadow-blue-500/10'
                            : 'bg-white/5 border-white/5 hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            {msg.senderPhoto ? (
                              <img
                                src={msg.senderPhoto}
                                alt={msg.senderName}
                                className="w-7 h-7 rounded-full object-cover border border-white/20 shrink-0"
                              />
                            ) : (
                              <div className="p-1.5 rounded-md bg-blue-500/20 text-blue-400 shrink-0">
                                <MessageSquare className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-bold text-white text-xs block truncate">
                                {msg.senderName}
                              </span>
                              {msg.senderClub && (
                                <span className="text-[9px] text-fc-neon-green font-bold block truncate">
                                  {msg.senderClub}
                                </span>
                              )}
                            </div>
                          </div>
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-[11px] text-white/85 line-clamp-2 italic mt-1 bg-black/20 p-2 rounded-xl">
                          "{msg.text}"
                        </p>
                        <div className="flex items-center justify-between text-[9px] text-white/40 mt-2 pt-1 border-t border-white/5">
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="text-fc-neon-green font-bold flex items-center gap-1">
                            Reply in Chat &rarr;
                          </span>
                        </div>
                      </div>
                    );
                  })}

                {announcements.length === 0 && myIncomingMessages.length === 0 && (
                  <div className="py-12 px-6 text-center text-white/40 space-y-2">
                    <Bell className="w-10 h-10 text-white/20 mx-auto mb-2" />
                    <p className="text-xs font-bold text-white/60">No notifications yet</p>
                    <p className="text-[11px] leading-relaxed">Upcoming fixtures, admin announcements and opponent chats will appear here.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs pb-safe">
                <button
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    if (next) soundService.playMessageChime();
                  }}
                  className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors py-1 px-2 rounded-lg active:bg-white/5"
                >
                  {soundEnabled ? (
                    <>
                      <Volume2 className="w-4 h-4 text-fc-neon-green" />
                      <span className="text-[11px] font-semibold">Sound On</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-4 h-4 text-white/40" />
                      <span className="text-[11px] font-semibold">Muted</span>
                    </>
                  )}
                </button>
                {onViewAllAnnouncements && (
                  <button
                    onClick={() => {
                      onViewAllAnnouncements();
                      setIsOpen(false);
                    }}
                    className="text-fc-neon-green hover:underline font-bold text-xs py-1 px-2.5 rounded-lg active:bg-white/5"
                  >
                    View All &rarr;
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>,
      document.body
    )}
  </>
);
};
