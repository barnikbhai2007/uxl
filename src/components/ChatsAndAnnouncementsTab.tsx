import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Megaphone, MessageSquare, Bell, BellRing, Pin, CheckCircle2, AlertTriangle, 
  Send, Lock, Search, Filter, Sparkles, Volume2, Shield, Calendar, Trophy, 
  Clock, Check, Trash2, ChevronDown, ChevronUp, UserCheck, RefreshCw, Info,
  Share2
} from 'lucide-react';
import { Announcement, DirectChatMessage, Match, Team, Registration } from '../types';
import { PREMIER_LEAGUE_TEAMS } from '../constants';
import { 
  soundService, 
  sendBrowserNotification, 
  requestBrowserNotificationPermission 
} from '../utils/notificationSound';

interface ChatsAndAnnouncementsTabProps {
  announcements: Announcement[];
  messages: DirectChatMessage[];
  matches: Match[];
  teams: Team[];
  registrations: Registration[];
  currentUser: any;
  myRegistrationData?: Registration | null;
  isAdmin: boolean;
  onOpenAdminAnnouncementModal: () => void;
  onDeleteAnnouncement: (id: string) => Promise<void>;
  onTogglePinAnnouncement: (id: string, currentPinned: boolean) => Promise<void>;
  onSendMessage: (matchId: string, text: string, recipientId?: string, recipientName?: string) => Promise<void>;
}

export const ChatsAndAnnouncementsTab: React.FC<ChatsAndAnnouncementsTabProps> = ({
  announcements,
  messages,
  matches,
  teams,
  registrations,
  currentUser,
  myRegistrationData,
  isAdmin,
  onOpenAdminAnnouncementModal,
  onDeleteAnnouncement,
  onTogglePinAnnouncement,
  onSendMessage,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'announcements' | 'upcoming' | 'finished'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [messageInputs, setMessageInputs] = useState<Record<string, string>>({});
  const [guestSenderName, setGuestSenderName] = useState(() => {
    return localStorage.getItem('chat_guest_name') || '';
  });
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [sendingMatchId, setSendingMatchId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const chatScrollBottomRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Sync browser permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionState(Notification.permission);
    }
  }, []);

  const handleRequestPermission = async () => {
    const res = await requestBrowserNotificationPermission();
    setPermissionState(res);
    if (res === 'granted') {
      soundService.playAnnouncementChime();
      void sendBrowserNotification('🔔 Notifications Enabled!', {
        body: 'You will now receive instant Chrome alerts for tournament announcements and match chats.',
        tag: 'perm-granted-test'
      });
    }
  };

  const handleTestNotification = () => {
    soundService.playMessageChime();
    void sendBrowserNotification('⚽ Chrome Notification Test', {
      body: 'Notifications are working! You will be alerted when new match chats or announcements arrive.',
      tag: 'test-chrome-notification'
    });
  };

  // Helper to get team details
  const getTeam = (teamId: string) => {
    const fromTeams = teams.find(t => t.id === teamId);
    if (fromTeams) return fromTeams;
    const fromReg = registrations.find(r => r.id === teamId || r.userId === teamId);
    if (fromReg) {
      return {
        id: fromReg.id,
        name: fromReg.country || fromReg.name,
        fullName: fromReg.name,
        fcName: fromReg.fcName,
        logoUrl: fromReg.logoUrl,
        country: fromReg.country,
      } as any;
    }
    const plClub = PREMIER_LEAGUE_TEAMS.find(c => c.name.toLowerCase() === teamId.toLowerCase() || c.shortName.toLowerCase() === teamId.toLowerCase());
    if (plClub) {
      return {
        id: plClub.shortName,
        name: plClub.name,
        fullName: plClub.name,
        fcName: plClub.manager,
        logoUrl: plClub.logoUrl,
        country: plClub.name,
      } as any;
    }
    return {
      id: teamId,
      name: teamId,
      fullName: teamId,
      fcName: teamId,
      logoUrl: undefined,
      country: undefined
    } as any;
  };

  // Sort matches into upcoming vs finished
  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      // Prioritize upcoming matches
      const aIsFinished = a.status === 'finished' || (a.homeScore !== undefined && a.awayScore !== undefined && a.homeScore !== null);
      const bIsFinished = b.status === 'finished' || (b.homeScore !== undefined && b.awayScore !== undefined && b.homeScore !== null);
      if (aIsFinished !== bIsFinished) return aIsFinished ? 1 : -1;
      return a.matchNumber - b.matchNumber;
    });
  }, [matches]);

  // Filter announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(a => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
    });
  }, [announcements, searchQuery]);

  // Filter matches
  const filteredMatches = useMemo(() => {
    return sortedMatches.filter(m => {
      const isFinished = m.status === 'finished' || (m.homeScore !== undefined && m.awayScore !== undefined && m.homeScore !== null);
      if (filterMode === 'upcoming' && isFinished) return false;
      if (filterMode === 'finished' && !isFinished) return false;
      if (filterMode === 'announcements') return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const home = getTeam(m.homeTeamId);
      const away = getTeam(m.awayTeamId);
      return (
        m.matchNumber.toString().includes(q) ||
        (m.date && m.date.toLowerCase().includes(q)) ||
        (home?.name && home.name.toLowerCase().includes(q)) ||
        (home?.fullName && home.fullName.toLowerCase().includes(q)) ||
        (home?.fcName && home.fcName.toLowerCase().includes(q)) ||
        (away?.name && away.name.toLowerCase().includes(q)) ||
        (away?.fullName && away.fullName.toLowerCase().includes(q)) ||
        (away?.fcName && away.fcName.toLowerCase().includes(q))
      );
    });
  }, [sortedMatches, filterMode, searchQuery, teams, registrations]);

  // Messages count per match
  const messagesByMatch = useMemo(() => {
    const map: Record<string, DirectChatMessage[]> = {};
    messages.forEach(msg => {
      if (msg.matchId) {
        if (!map[msg.matchId]) map[msg.matchId] = [];
        map[msg.matchId].push(msg);
      }
    });
    return map;
  }, [messages]);

  // Handle message submission
  const handleSend = async (match: Match) => {
    const isFinished = match.status === 'finished' || (match.homeScore !== undefined && match.awayScore !== undefined && match.homeScore !== null);
    if (isFinished) {
      alert("Match is finished. Chat is closed and locked.");
      return;
    }

    const text = messageInputs[match.id]?.trim();
    if (!text) return;

    const home = getTeam(match.homeTeamId);
    const away = getTeam(match.awayTeamId);

    // Save guest name if entered
    if (guestSenderName.trim()) {
      try {
        localStorage.setItem('chat_guest_name', guestSenderName.trim());
      } catch {}
    }

    setSendingMatchId(match.id);
    try {
      await onSendMessage(
        match.id,
        text,
        match.awayTeamId,
        away?.name || 'Opponent'
      );
      setMessageInputs(prev => ({ ...prev, [match.id]: '' }));
      
      // Auto-scroll chat
      setTimeout(() => {
        const el = chatScrollBottomRefs.current[match.id];
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSendingMatchId(null);
    }
  };

  const upcomingCount = sortedMatches.filter(m => !(m.status === 'finished' || (m.homeScore !== undefined && m.awayScore !== undefined && m.homeScore !== null))).length;
  const finishedCount = sortedMatches.filter(m => (m.status === 'finished' || (m.homeScore !== undefined && m.awayScore !== undefined && m.homeScore !== null))).length;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a0022] via-[#120017] to-[#08000a] border border-[#00ff85]/20 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#00ff85] blur-[120px] opacity-[0.08] pointer-events-none rounded-full" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00ff85]/10 border border-[#00ff85]/30 text-[#00ff85] text-[10px] font-black uppercase tracking-widest mb-3">
              <span className="w-2 h-2 rounded-full bg-[#00ff85] animate-ping" />
              Official Tournament Hub
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-black text-white tracking-tight flex items-center gap-3">
              Chats & Announcements
            </h2>
            <p className="text-white/60 text-sm max-w-xl mt-2 leading-relaxed font-sans">
              Official broadcast notice board & live discussion rooms for upcoming matches. Once a match concludes, its chat is archived and locked.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <button
                onClick={onOpenAdminAnnouncementModal}
                className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-purple-900/30"
              >
                <Megaphone className="w-4 h-4" />
                <span>Post Notice</span>
              </button>
            )}

            {permissionState === 'granted' ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Chrome Alerts On
                </span>
                <button
                  onClick={handleTestNotification}
                  className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white/90 rounded-xl text-xs font-bold transition-colors border border-white/10"
                  title="Test if Chrome desktop notification fires"
                >
                  Test Alert
                </button>
              </div>
            ) : (
              <button
                onClick={handleRequestPermission}
                className="px-4 py-2.5 bg-[#00ff85] hover:bg-[#00ff85]/90 text-[#38003c] font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-lg hover:shadow-[0_0_20px_rgba(0,255,133,0.4)]"
              >
                <BellRing className="w-4 h-4 animate-bounce" />
                <span>Enable Chrome Notifications</span>
              </button>
            )}
          </div>
        </div>

        {/* Chrome Push Status Alert Banner */}
        {permissionState !== 'granted' && (
          <div className="mt-6 p-3.5 rounded-2xl bg-[#00ff85]/10 border border-[#00ff85]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#00ff85]/20 text-[#00ff85] shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <p className="text-white/80">
                <strong className="text-[#00ff85]">Chrome Notifications:</strong> Turn on notifications so you immediately hear the chime and see popup alerts when new match chats or official announcements are sent.
              </p>
            </div>
            <button
              onClick={handleRequestPermission}
              className="px-4 py-2 bg-[#00ff85] text-black font-extrabold rounded-xl shrink-0 uppercase tracking-wider text-[11px] hover:brightness-110 active:scale-95 transition-all"
            >
              Allow in Chrome
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white/[0.02] border border-white/10 p-3 rounded-2xl backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterMode === 'all'
                ? 'bg-[#00ff85] text-black font-extrabold shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            All Updates
          </button>
          <button
            onClick={() => setFilterMode('announcements')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterMode === 'announcements'
                ? 'bg-purple-600 text-white font-extrabold shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Announcements ({announcements.length})</span>
          </button>
          <button
            onClick={() => setFilterMode('upcoming')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterMode === 'upcoming'
                ? 'bg-emerald-500 text-black font-extrabold shadow-md'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Upcoming Match Chats ({upcomingCount})</span>
          </button>
          <button
            onClick={() => setFilterMode('finished')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              filterMode === 'finished'
                ? 'bg-zinc-700 text-white font-extrabold shadow-md'
                : 'text-white/40 hover:text-white hover:bg-white/5'
            }`}
          >
            <Lock className="w-3 h-3 text-white/50" />
            <span>Finished (Archived {finishedCount})</span>
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search teams, matches, notices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-white/40 focus:outline-none focus:border-[#00ff85]/50 transition-colors"
          />
        </div>
      </div>

      {/* Guest Name Config (if user not logged in) */}
      {!currentUser && (
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-white/70">
            <UserCheck className="w-4 h-4 text-[#00ff85]" />
            <span>You are chatting as a visitor. Set your chat nickname:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. Priyam / GamerX"
              value={guestSenderName}
              onChange={(e) => setGuestSenderName(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-[#00ff85]"
            />
            <span className="text-[10px] text-white/40 font-mono">(auto-saved)</span>
          </div>
        </div>
      )}

      {/* SECTION 1: OFFICIAL ANNOUNCEMENTS NOTICE BOARD */}
      {(filterMode === 'all' || filterMode === 'announcements') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Megaphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-white tracking-tight">
                  Official Tournament Notice Board
                </h3>
                <p className="text-xs text-white/50">
                  Broadcasts, schedule updates, and disciplinary notifications from tournament administration
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider">
              {filteredAnnouncements.length} Notices
            </span>
          </div>

          {filteredAnnouncements.length === 0 ? (
            <div className="p-8 text-center bg-white/[0.02] border border-white/5 rounded-2xl text-white/40 text-xs">
              No notices matching your filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAnnouncements.map((ann) => (
                <div
                  key={ann.id}
                  className={`p-5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                    ann.pinned
                      ? 'bg-gradient-to-br from-amber-500/10 via-purple-900/20 to-black border-amber-500/40 shadow-lg shadow-amber-950/20'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                  }`}
                >
                  {ann.pinned && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[9px] font-black uppercase tracking-widest">
                      <Pin className="w-3 h-3 fill-amber-400" />
                      PINNED
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        ann.category === 'urgent' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                        ann.category === 'rule' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        ann.category === 'match' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                        'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      }`}>
                        {ann.category}
                      </span>
                      <span className="text-[11px] text-white/40 font-mono">
                        {new Date(ann.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white font-sans tracking-tight mb-2">
                      {ann.title}
                    </h4>

                    <p className="text-white/80 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                      {ann.content}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/5">
                    <span className="text-[10px] text-white/40 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-[#00ff85]" />
                      {ann.authorName || 'Tournament Official'}
                    </span>

                    {isAdmin && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onTogglePinAnnouncement(ann.id, !!ann.pinned)}
                          className="p-1.5 text-white/50 hover:text-amber-400 hover:bg-white/10 rounded-lg transition-colors"
                          title={ann.pinned ? 'Unpin' : 'Pin to top'}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteAnnouncement(ann.id)}
                          className="p-1.5 text-white/50 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors"
                          title="Delete notice"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: MATCH-BY-MATCH DISCUSSION CHATS */}
      {(filterMode === 'all' || filterMode === 'upcoming' || filterMode === 'finished') && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-white tracking-tight">
                  Match Discussion Rooms
                </h3>
                <p className="text-xs text-white/50">
                  Upcoming matches are open for team banter and coordination. Completed matches fade and are locked from further messaging.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
              {filteredMatches.length} Matches
            </span>
          </div>

          {filteredMatches.length === 0 ? (
            <div className="p-8 text-center bg-white/[0.02] border border-white/5 rounded-2xl text-white/40 text-xs">
              No matches found matching current filters.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMatches.map((match) => {
                const home = getTeam(match.homeTeamId);
                const away = getTeam(match.awayTeamId);
                const isFinished = match.status === 'finished' || (match.homeScore !== undefined && match.awayScore !== undefined && match.homeScore !== null);
                const matchChatList = messagesByMatch[match.id] || [];
                const isExpanded = expandedMatchId === match.id;
                const draftText = messageInputs[match.id] || '';

                return (
                  <div
                    key={match.id}
                    id={`match-chat-${match.id}`}
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isFinished
                        ? 'opacity-60 grayscale-[35%] bg-white/[0.01] border-white/5 hover:opacity-85'
                        : isExpanded
                        ? 'bg-[#18021f]/90 border-[#00ff85]/60 shadow-[0_8px_35px_rgba(0,255,133,0.15)] ring-1 ring-[#00ff85]/30'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/25 hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Match Card Header Row */}
                    <div 
                      onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      {/* Left: Match Number & Status */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                          isFinished
                            ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            : 'bg-[#00ff85]/20 text-[#00ff85] border border-[#00ff85]/40'
                        }`}>
                          #{match.matchNumber}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-white/50">
                              {match.date || 'TBD'}
                            </span>
                            {isFinished ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[9px] font-bold uppercase tracking-wider border border-zinc-700">
                                <Lock className="w-2.5 h-2.5" />
                                Done · Faded & Locked
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold uppercase tracking-wider border border-emerald-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Upcoming · Chat Open
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-white/40 mt-0.5">
                            {match.matchday ? `Matchday ${match.matchday}` : 'Premier League Stage'}
                          </p>
                        </div>
                      </div>

                      {/* Center: Teams Confrontation */}
                      <div className="flex items-center justify-between sm:justify-center gap-4 flex-1 max-w-md mx-auto">
                        {/* Home Team */}
                        <div className="flex items-center gap-2.5 flex-1 justify-end min-w-0">
                          <div className="text-right min-w-0">
                            <p className="font-bold text-sm text-white truncate">{home.fullName || home.name}</p>
                            <p className="text-[10px] text-[#00ff85] truncate font-mono">{home.fcName}</p>
                          </div>
                          <div className="w-9 h-9 rounded-xl bg-black border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                            {home.logoUrl ? (
                              <img src={home.logoUrl} alt={home.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-white/40">{home.name?.slice(0, 2)}</span>
                            )}
                          </div>
                        </div>

                        {/* VS or Score */}
                        <div className="px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-center shrink-0 min-w-[55px]">
                          {isFinished ? (
                            <span className="font-display font-extrabold text-base text-white tracking-wider">
                              {match.homeScore ?? 0} - {match.awayScore ?? 0}
                            </span>
                          ) : (
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                              VS
                            </span>
                          )}
                        </div>

                        {/* Away Team */}
                        <div className="flex items-center gap-2.5 flex-1 justify-start min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-black border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                            {away.logoUrl ? (
                              <img src={away.logoUrl} alt={away.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-white/40">{away.name?.slice(0, 2)}</span>
                            )}
                          </div>
                          <div className="text-left min-w-0">
                            <p className="font-bold text-sm text-white truncate">{away.fullName || away.name}</p>
                            <p className="text-[10px] text-[#00ff85] truncate font-mono">{away.fcName}</p>
                          </div>
                        </div>
                      </div>

                      {/* Right: Messages count & Toggle */}
                      <div className="flex items-center justify-end gap-3 shrink-0">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                          matchChatList.length > 0
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-white/5 text-white/40 border border-white/10'
                        }`}>
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{matchChatList.length}</span>
                        </span>
                        <div className="p-1 text-white/40 hover:text-white transition-colors">
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-[#00ff85]" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Chat Drawer */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-white/10 bg-black/40"
                        >
                          <div className="p-4 sm:p-6 space-y-4">
                            {/* Match Chat Header status info */}
                            <div className="flex items-center justify-between text-xs text-white/60 pb-2 border-b border-white/5">
                              <span className="font-bold text-white/80">
                                Match #{match.matchNumber} Chat Channel
                              </span>
                              {isFinished ? (
                                <span className="text-red-400 font-bold flex items-center gap-1">
                                  <Lock className="w-3.5 h-3.5" />
                                  Match done · Input locked
                                </span>
                              ) : (
                                <span className="text-[#00ff85] font-bold flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-[#00ff85] animate-ping" />
                                  Live chat active
                                </span>
                              )}
                            </div>

                            {/* Chat Messages Log */}
                            <div className="max-h-[360px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/20">
                              {matchChatList.length === 0 ? (
                                <div className="py-12 text-center text-white/30 text-xs">
                                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                  <p>No messages in this match chat yet.</p>
                                  {!isFinished && <p className="text-[11px] text-[#00ff85] mt-1">Be the first to send a message!</p>}
                                </div>
                              ) : (
                                matchChatList.map((msg) => {
                                  const isMyMessage = currentUser?.uid === msg.senderId || (guestSenderName && msg.senderName === guestSenderName);
                                  return (
                                    <div
                                      key={msg.id}
                                      className={`flex items-start gap-2.5 ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                                    >
                                      {!isMyMessage && (
                                        <div className="w-7 h-7 rounded-lg bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-bold text-white/70">
                                          {msg.senderPhoto ? (
                                            <img src={msg.senderPhoto} alt="" className="w-full h-full object-cover" />
                                          ) : (
                                            msg.senderName?.slice(0, 2).toUpperCase() || 'P'
                                          )}
                                        </div>
                                      )}

                                      <div className={`max-w-[78%] rounded-2xl p-3 text-xs leading-relaxed ${
                                        isMyMessage
                                          ? 'bg-[#00ff85] text-[#120017] font-medium rounded-tr-none shadow-md'
                                          : 'bg-white/10 text-white rounded-tl-none border border-white/10'
                                      }`}>
                                        <div className="flex items-center gap-2 mb-1 text-[10px] opacity-75">
                                          <span className="font-extrabold truncate">{msg.senderName}</span>
                                          {msg.senderClub && (
                                            <span className="truncate">· {msg.senderClub}</span>
                                          )}
                                          <span className="ml-auto font-mono text-[9px]">
                                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                        </div>
                                        <p className="whitespace-pre-wrap font-sans">{msg.text}</p>
                                      </div>

                                      {isMyMessage && (
                                        <div className="w-7 h-7 rounded-lg bg-[#00ff85] text-black font-extrabold flex items-center justify-center shrink-0 text-[10px]">
                                          {msg.senderPhoto ? (
                                            <img src={msg.senderPhoto} alt="" className="w-full h-full object-cover rounded-lg" />
                                          ) : (
                                            msg.senderName?.slice(0, 2).toUpperCase() || 'ME'
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                              <div ref={(el) => { chatScrollBottomRefs.current[match.id] = el; }} />
                            </div>

                            {/* Chat Input Section */}
                            {isFinished ? (
                              <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                                <Lock className="w-4 h-4 text-zinc-500" />
                                <span>
                                  <strong>Match Concluded:</strong> Chat is permanently faded and archived. No further messages can be submitted.
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {/* Quick reaction chips */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                                  {['⚽ Good game!', '🔥 Let’s play!', '👏 Well played', '🏆 Ready to win', '⚔️ Match on', '🤝 GG'].map((quick) => (
                                    <button
                                      key={quick}
                                      type="button"
                                      onClick={() => setMessageInputs(prev => ({
                                        ...prev,
                                        [match.id]: prev[match.id] ? `${prev[match.id]} ${quick}` : quick
                                      }))}
                                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-white/70 hover:text-white text-[11px] font-sans border border-white/10 transition-colors shrink-0"
                                    >
                                      {quick}
                                    </button>
                                  ))}
                                </div>

                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    placeholder={
                                      currentUser
                                        ? `Message match participants as ${currentUser.displayName || 'Player'}...`
                                        : guestSenderName
                                        ? `Message as ${guestSenderName}...`
                                        : 'Type message for this match...'
                                    }
                                    value={draftText}
                                    onChange={(e) => setMessageInputs(prev => ({ ...prev, [match.id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend(match);
                                      }
                                    }}
                                    disabled={sendingMatchId === match.id}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-xs placeholder:text-white/40 focus:outline-none focus:border-[#00ff85] transition-colors"
                                  />
                                  <button
                                    onClick={() => handleSend(match)}
                                    disabled={!draftText.trim() || sendingMatchId === match.id}
                                    className="px-4 py-2.5 bg-[#00ff85] hover:bg-[#00ff85]/90 disabled:opacity-40 disabled:pointer-events-none text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shadow-md shrink-0"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Send</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
