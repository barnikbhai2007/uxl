import React from 'react';
import { motion } from 'motion/react';
import { Megaphone, X, Pin, Calendar, AlertTriangle, Info, Sparkles, Bell } from 'lucide-react';
import { Announcement } from '../types';

interface AnnouncementsViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: Announcement[];
  selectedAnnouncement?: Announcement | null;
}

export const AnnouncementsViewModal: React.FC<AnnouncementsViewModalProps> = ({
  isOpen,
  onClose,
  announcements,
  selectedAnnouncement,
}) => {
  if (!isOpen) return null;

  const sortedAnnouncements = [...announcements].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getCategoryBadge = (cat: Announcement['category']) => {
    switch (cat) {
      case 'urgent':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Urgent Alert</span>;
      case 'match':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-fc-neon-green/20 text-fc-neon-green border border-fc-neon-green/40 flex items-center gap-1"><Calendar className="w-3 h-3" /> Match Notice</span>;
      case 'rule':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1"><Info className="w-3 h-3" /> Tournament Rule</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Official Update</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-zinc-950 border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 bg-gradient-to-r from-fc-purple-dark via-zinc-950 to-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-fc-neon-green/10 border border-fc-neon-green/30 rounded-2xl text-fc-neon-green">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-white">
                Tournament Announcements
              </h2>
              <p className="text-xs text-white/50">
                Official broadcasts from tournament administration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content List */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {sortedAnnouncements.length === 0 ? (
            <div className="py-16 text-center text-white/40 space-y-2">
              <Megaphone className="w-12 h-12 text-white/20 mx-auto" />
              <p className="text-base font-semibold text-white/60">No announcements yet</p>
              <p className="text-xs">Upcoming news, match day details, and updates will be posted here.</p>
            </div>
          ) : (
            sortedAnnouncements.map((item) => (
              <div
                key={item.id}
                className={`p-5 rounded-2xl border transition-all ${
                  item.pinned
                    ? 'bg-gradient-to-r from-zinc-900 via-zinc-900 to-fc-purple-dark/30 border-amber-500/40 shadow-lg'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.pinned && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                        <Pin className="w-2.5 h-2.5" /> Pinned
                      </span>
                    )}
                    {getCategoryBadge(item.category)}
                    <h3 className="text-base font-bold text-white">{item.title}</h3>
                  </div>
                  <span className="text-[10px] text-white/40">
                    {new Date(item.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </div>
                <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
                  {item.content}
                </p>
                {item.authorName && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-white/40">
                    <span>Broadcast by: <strong className="text-white/70">{item.authorName}</strong></span>
                    <span className="text-fc-neon-green/80 flex items-center gap-1"><Bell className="w-3 h-3" /> Broadcast Alert</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};
