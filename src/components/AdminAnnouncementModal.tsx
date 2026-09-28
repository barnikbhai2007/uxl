import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Megaphone, X, Plus, Pin, Trash2, Send, BellRing, Sparkles, AlertTriangle, Info, Calendar } from 'lucide-react';
import { Announcement } from '../types';
import { soundService } from '../utils/notificationSound';

interface AdminAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: Announcement[];
  onAddAnnouncement: (announcement: Omit<Announcement, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
  onTogglePin?: (id: string, currentPinned: boolean) => Promise<void>;
  authorEmail?: string;
  authorName?: string;
}

const PRESET_ANNOUNCEMENTS = [
  {
    title: 'Matchday 1 Fixtures Are Live! ⚽',
    content: 'All participants please check your upcoming matches in My Campaign and coordinate with your opponents!',
    category: 'match' as const
  },
  {
    title: 'Match Result Submission Reminder 📸',
    content: 'Please upload a clear screenshot of the final score screen and select Man of the Match immediately after your game.',
    category: 'rule' as const
  },
  {
    title: 'Knockout Stage Starting Soon! 🏆',
    content: 'Top teams from each group will advance to the Champions Bracket. Check the standings and stay alert!',
    category: 'urgent' as const
  },
  {
    title: 'Fair Play & Disconnection Rules ⚖️',
    content: 'In case of game disconnection before the 80th minute, remaining time must be played in a new match. Contact an admin if disputes arise.',
    category: 'general' as const
  }
];

export const AdminAnnouncementModal: React.FC<AdminAnnouncementModalProps> = ({
  isOpen,
  onClose,
  announcements,
  onAddAnnouncement,
  onDeleteAnnouncement,
  onTogglePin,
  authorEmail,
  authorName
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'general' | 'match' | 'urgent' | 'rule'>('general');
  const [pinned, setPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddAnnouncement({
        title: title.trim(),
        content: content.trim(),
        category,
        pinned,
        authorEmail: authorEmail || 'Admin',
        authorName: authorName || 'Tournament Organizer'
      });
      soundService.playAnnouncementChime();
      setTitle('');
      setContent('');
      setPinned(false);
      setActiveTab('list');
    } catch (err) {
      console.error('Failed to post announcement:', err);
      alert('Failed to publish announcement. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyPreset = (preset: typeof PRESET_ANNOUNCEMENTS[0]) => {
    setTitle(preset.title);
    setContent(preset.content);
    setCategory(preset.category);
  };

  const getCategoryBadge = (cat: Announcement['category']) => {
    switch (cat) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" /> Urgent</span>;
      case 'match':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-fc-neon-green/20 text-fc-neon-green border border-fc-neon-green/40 flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> Match</span>;
      case 'rule':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1"><Info className="w-2.5 h-2.5" /> Rule</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" /> General</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 bg-gradient-to-r from-fc-purple-dark via-zinc-950 to-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-fc-neon-green/10 border border-fc-neon-green/30 rounded-2xl text-fc-neon-green">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-display text-white flex items-center gap-2">
                Tournament Announcements
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-fc-neon-green text-black rounded-full">Admin</span>
              </h2>
              <p className="text-xs text-white/50">Broadcast messages directly to all players & spectators</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/10 bg-white/[0.02] px-6 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-3 px-4 font-bold text-xs tracking-wide transition-all border-b-2 ${
              activeTab === 'create'
                ? 'border-fc-neon-green text-fc-neon-green'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            Create New Announcement
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`pb-3 px-4 font-bold text-xs tracking-wide transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'border-fc-neon-green text-fc-neon-green'
                : 'border-transparent text-white/50 hover:text-white'
            }`}
          >
            All Broadcasts ({announcements.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'create' ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Presets */}
              <div>
                <label className="text-[11px] font-bold uppercase text-white/40 mb-2 block">
                  Quick Templates
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PRESET_ANNOUNCEMENTS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="text-left p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-fc-neon-green/30 transition-all text-xs group"
                    >
                      <span className="font-bold text-white group-hover:text-fc-neon-green line-clamp-1 block mb-0.5">
                        {p.title}
                      </span>
                      <span className="text-[11px] text-white/40 line-clamp-1">
                        {p.content}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-[11px] font-bold uppercase text-white/40 mb-1.5 block">
                  Announcement Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Matchday 2 Schedule Announced!"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-fc-neon-green transition-all"
                />
              </div>

              {/* Category & Pin */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold uppercase text-white/40 mb-1.5 block">
                    Category Tag
                  </label>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fc-neon-green"
                  >
                    <option value="general">✨ General Update</option>
                    <option value="match">⚽ Match & Schedule</option>
                    <option value="urgent">🚨 Urgent / Breaking</option>
                    <option value="rule">📋 Rules & Info</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl cursor-pointer hover:bg-white/10 w-full transition-all">
                    <input
                      type="checkbox"
                      checked={pinned}
                      onChange={(e) => setPinned(e.target.checked)}
                      className="w-4 h-4 rounded text-fc-neon-green accent-fc-neon-green"
                    />
                    <div className="flex items-center gap-1.5 text-xs text-white">
                      <Pin className={`w-3.5 h-3.5 ${pinned ? 'text-amber-400 rotate-45' : 'text-white/40'}`} />
                      <span className="font-semibold">Pin announcement to top banner</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Message Content */}
              <div>
                <label className="text-[11px] font-bold uppercase text-white/40 mb-1.5 block">
                  Announcement Details *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write full announcement details, links, or instructions here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-fc-neon-green transition-all"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-white/40 flex items-center gap-1">
                  <BellRing className="w-3.5 h-3.5 text-fc-neon-green" />
                  Sends instant notifications to active players
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !content.trim()}
                  className="px-6 py-3 bg-fc-neon-green text-black font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-fc-neon-green/90 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center gap-2 shadow-lg shadow-fc-neon-green/20"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? 'Publishing...' : 'Broadcast Now'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {announcements.length === 0 ? (
                <div className="p-8 text-center text-white/40 bg-white/5 rounded-2xl border border-white/5">
                  <Megaphone className="w-10 h-10 text-white/20 mx-auto mb-2" />
                  <p className="text-sm">No announcements broadcasted yet.</p>
                </div>
              ) : (
                announcements.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.pinned && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                            <Pin className="w-2.5 h-2.5" /> Pinned
                          </span>
                        )}
                        {getCategoryBadge(item.category)}
                        <h4 className="font-bold text-white text-sm">{item.title}</h4>
                      </div>
                      <p className="text-xs text-white/70 whitespace-pre-wrap leading-relaxed">
                        {item.content}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-white/40 pt-1">
                        <span>{new Date(item.createdAt).toLocaleString()}</span>
                        {item.authorName && <span>• By {item.authorName}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 self-end sm:self-center">
                      {onTogglePin && (
                        <button
                          onClick={() => onTogglePin(item.id, !item.pinned)}
                          title={item.pinned ? 'Unpin' : 'Pin to top'}
                          className={`p-2 rounded-xl transition-colors ${
                            item.pinned ? 'text-amber-400 bg-amber-400/10' : 'text-white/40 hover:text-white hover:bg-white/5'
                          }`}
                        >
                          <Pin className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm('Delete this announcement?')) {
                            onDeleteAnnouncement(item.id);
                          }
                        }}
                        title="Delete announcement"
                        className="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
