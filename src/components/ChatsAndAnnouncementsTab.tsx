import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Megaphone, MessageSquare, Bell, BellRing, Pin, CheckCircle2,
  Send, Lock, Search, Shield, Trash2, ChevronDown, ChevronUp, UserCheck, 
  Users, Swords, Check
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
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [sendingMatchId, setSendingMatchId] = useState<string | null>(null);
  
  // Selected player ID for visitors/guests or when switching player identity
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('selected_player_id') || '';
    }
    return '';
  });

  // Admin view mode toggle: 'my_matches' (default) vs 'all_matches'
  const [adminViewMode, setAdminViewMode] = useState<'my_matches' | 'all_matches'>('my_matches');

  const [guestSenderName, setGuestSenderName] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('chat_guest_name') || '';
    }
    return '';
  });

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
        body: 'You will receive Chrome alerts when your match opponents message you or official notices are posted.',
        tag: 'perm-granted-test'
      });
    }
  };

  const handleTestNotification = () => {
    soundService.playMessageChime();
    void sendBrowserNotification('⚽ Chrome Notification Test', {
      body: 'Notifications are working! You will be alerted when new opponent chats or announcements arrive.',
      tag: 'test-chrome-notification'
    });
  };

  // Helper to get team/player details
  const getTeam = (teamId: string) => {
    const fromTeams = teams.find(t => t.id === teamId);
    if (fromTeams) return fromTeams;
    const fromReg = registrations.find(r => r.id === teamId || r.userId === teamId);
    if (fromReg) {
      return {
        id: fromReg.id,
        uid: fromReg.userId,
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
        uid: plClub.shortName,
        name: plClub.name,
        fullName: plClub.name,
        fcName: plClub.manager,
        logoUrl: plClub.logoUrl,
        country: plClub.name,
      } as any;
    }
    return {
      id: teamId,
      uid: teamId,
      name: teamId,
      fullName: teamId,
      fcName: teamId,
      logoUrl: undefined,
      country: undefined
    } as any;
  };

  // Determine active player registration
  const activePlayer = useMemo(() => {
    if (myRegistrationData) return myRegistrationData;
    if (selectedPlayerId) {
      const found = registrations.find(r => r.id === selectedPlayerId || r.userId === selectedPlayerId);
      if (found) return found;
      const teamFound = teams.find(t => t.id === selectedPlayerId);
      if (teamFound) {
        return {
          id: teamFound.id,
          userId: teamFound.uid || teamFound.id,
          name: teamFound.fullName || teamFound.name,
          fcName: teamFound.fcName || teamFound.name,
          country: teamFound.country || teamFound.name,
          logoUrl: teamFound.logoUrl,
          status: 'approved'
        } as Registration;
      }
    }
    if (currentUser?.uid) {
      const foundByUid = registrations.find(r => r.userId === currentUser.uid || r.id === currentUser.uid);
      if (foundByUid) return foundByUid;
    }
    return null;
  }, [myRegistrationData, selectedPlayerId, currentUser, registrations, teams]);

  // Handle switching player identity
  const handleSelectPlayer = (playerId: string) => {
    setSelectedPlayerId(playerId);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('selected_player_id', playerId);
    }
  };

  // Check if a match is "my match" (the user is home or away team)
  const isMyMatch = (m: Match): boolean => {
    // Direct matches to active player
    const candidateIds = [
      activePlayer?.id,
      activePlayer?.userId,
      myRegistrationData?.id,
      myRegistrationData?.userId,
      currentUser?.uid,
      selectedPlayerId
    ].filter(Boolean) as string[];

    if (candidateIds.includes(m.homeTeamId) || candidateIds.includes(m.awayTeamId)) {
      return true;
    }

    const candidateNames = [
      activePlayer?.fcName?.toLowerCase(),
      activePlayer?.name?.toLowerCase(),
      activePlayer?.country?.toLowerCase(),
      myRegistrationData?.fcName?.toLowerCase(),
      myRegistrationData?.name?.toLowerCase(),
      guestSenderName?.toLowerCase()
    ].filter(Boolean) as string[];

    const home = getTeam(m.homeTeamId);
    const away = getTeam(m.awayTeamId);

    if (candidateIds.includes(home.id) || candidateIds.includes(home.uid)) return true;
    if (candidateIds.includes(away.id) || candidateIds.includes(away.uid)) return true;

    if (candidateNames.some(n => 
      home.fcName?.toLowerCase() === n || 
      home.name?.toLowerCase() === n || 
      home.fullName?.toLowerCase() === n
    )) return true;

    if (candidateNames.some(n => 
      away.fcName?.toLowerCase() === n || 
      away.name?.toLowerCase() === n || 
      away.fullName?.toLowerCase() === n
    )) return true;

    return false;
  };

  // Determine opponent for a match
  const getOpponentInfo = (m: Match) => {
    const home = getTeam(m.homeTeamId);
    const away = getTeam(m.awayTeamId);

    const candidateIds = [
      activePlayer?.id,
      activePlayer?.userId,
      myRegistrationData?.id,
      myRegistrationData?.userId,
      currentUser?.uid,
      selectedPlayerId
    ].filter(Boolean) as string[];

    const isHomeMe = candidateIds.includes(m.homeTeamId) || 
      candidateIds.includes(home.id) || 
      (activePlayer?.fcName && home.fcName?.toLowerCase() === activePlayer.fcName.toLowerCase());

    if (isHomeMe) {
      return {
        myTeam: home,
        opponent: away,
        isHome: true,
        opponentId: m.awayTeamId,
        opponentName: away.fcName || away.name || away.fullName || 'Opponent'
      };
    } else {
      return {
        myTeam: away,
        opponent: home,
        isHome: false,
        opponentId: m.homeTeamId,
        opponentName: home.fcName || home.name || home.fullName || 'Opponent'
      };
    }
  };

  // Sort matches into upcoming vs finished
  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      const aIsFinished = a.status === 'finished' || (a.homeScore !== undefined && a.awayScore !== undefined && a.homeScore !== null);
      const bIsFinished = b.status === 'finished' || (b.homeScore !== undefined && b.awayScore !== undefined && b.homeScore !== null);
      if (aIsFinished !== bIsFinished) return aIsFinished ? 1 : -1;
      return a.matchNumber - b.matchNumber;
    });
  }, [matches]);

  // Filter matches: ONLY show matches the user is playing in (unless admin specifically chooses all matches)
  const userMatchedMatches = useMemo(() => {
    if (isAdmin && adminViewMode === 'all_matches') {
      return sortedMatches;
    }
    return sortedMatches.filter(m => isMyMatch(m));
  }, [sortedMatches, isAdmin, adminViewMode, activePlayer, selectedPlayerId, currentUser, myRegistrationData, teams, registrations]);

  // Filter announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(a => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
    });
  }, [announcements, searchQuery]);

  // Filter matches by tab mode and search query
  const filteredMatches = useMemo(() => {
    return userMatchedMatches.filter(m => {
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
  }, [userMatchedMatches, filterMode, searchQuery, teams, registrations]);

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

    const { opponent, opponentId, opponentName } = getOpponentInfo(match);

    // Save guest name if entered
    if (guestSenderName.trim() && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('chat_guest_name', guestSenderName.trim());
      } catch {}
    }

    setSendingMatchId(match.id);
    try {
      await onSendMessage(
        match.id,
        text,
        opponentId,
        opponentName || opponent.name || 'Opponent'
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

  const myUpcomingCount = userMatchedMatches.filter(m => !(m.status === 'finished' || (m.homeScore !== undefined && m.awayScore !== undefined && m.homeScore !== null))).length;
  const myFinishedCount = userMatchedMatches.filter(m => (m.status === 'finished' || (m.homeScore !== undefined && m.awayScore !== undefined && m.homeScore !== null))).length;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1a0022] via-[#120017] to-[#08000a] border border-[#00ff85]/20 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#00ff85] blur-[120px] opacity-[0.08] pointer-events-none rounded-full" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00ff85]/10 border border-[#00ff85]/30 text-[#00ff85] text-[10px] font-black uppercase tracking-widest mb-3">
              <span className="w-2 h-2 rounded-full bg-[#00ff85] animate-ping" />
              Direct Opponent & Notice Center
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-black text-white tracking-tight flex items-center gap-3">
              Chats & Announcements
            </h2>
            <p className="text-white/60 text-sm max-w-xl mt-2 leading-relaxed font-sans">
              Connect directly with players you have a scheduled match against. Official announcements and notices are posted above.
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
                <strong className="text-[#00ff85]">Chrome Notifications:</strong> Turn on notifications so you immediately hear the chime and see alerts when your match opponents message you or official tournament notices are posted.
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

      {/* PLAYER IDENTITY & FILTER BAR */}
      <div className="p-4 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-md space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Active Player Status */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-fc-neon-green/10 border border-fc-neon-green/30 flex items-center justify-center shrink-0 overflow-hidden">
              {activePlayer?.logoUrl ? (
                <img src={activePlayer.logoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <Swords className="w-5 h-5 text-fc-neon-green" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#00ff85]">
                  Active Player View
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff85]" />
                <span className="text-[10px] text-white/50">
                  {userMatchedMatches.length} Match{userMatchedMatches.length === 1 ? '' : 'es'} with Opponents
                </span>
              </div>
              <p className="text-sm font-bold text-white truncate">
                {activePlayer ? (
                  <>
                    <span>{activePlayer.fcName || activePlayer.name}</span>
                    <span className="text-white/40 font-normal ml-1.5">({activePlayer.country || 'Team'})</span>
                  </>
                ) : (
                  <span className="text-white/60 italic">No player selected - Select your player profile below</span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Player Switcher / Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-white/50 font-sans flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-fc-neon-green" />
              <span>Playing As:</span>
            </label>
            <select
              value={activePlayer?.id || selectedPlayerId || ''}
              onChange={(e) => handleSelectPlayer(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-black/60 border border-white/15 text-white text-xs font-bold focus:outline-none focus:border-[#00ff85] transition-colors"
            >
              <option value="" disabled>-- Select Your Gamer/Team Profile --</option>
              {registrations.map((reg) => (
                <option key={reg.id} value={reg.id}>
                  {reg.fcName || reg.name} ({reg.country || 'Club'})
                </option>
              ))}
            </select>

            {isAdmin && (
              <div className="ml-2 flex items-center gap-1 p-1 rounded-xl bg-purple-900/30 border border-purple-500/30">
                <button
                  onClick={() => setAdminViewMode('my_matches')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                    adminViewMode === 'my_matches'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-purple-300 hover:text-white'
                  }`}
                  title="Only show matches involving your player"
                >
                  My Matches Only
                </button>
                <button
                  onClick={() => setAdminViewMode('all_matches')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                    adminViewMode === 'all_matches'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-purple-300 hover:text-white'
                  }`}
                  title="Admin view of all tournament matches"
                >
                  All Matches (Admin)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Guest Name setting if not logged in */}
        {!currentUser && (
          <div className="pt-2 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-white/70">
              <UserCheck className="w-4 h-4 text-[#00ff85]" />
              <span>Chatting as guest / visitor:</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Enter your chat nickname..."
                value={guestSenderName}
                onChange={(e) => setGuestSenderName(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-white text-xs placeholder:text-white/30 focus:outline-none focus:border-[#00ff85]"
              />
              <span className="text-[10px] text-white/40 font-mono">(saved)</span>
            </div>
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
            <span>Upcoming Matches ({myUpcomingCount})</span>
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
            <span>Finished & Locked ({myFinishedCount})</span>
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search opponents, notices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-white/40 focus:outline-none focus:border-[#00ff85]/50 transition-colors"
          />
        </div>
      </div>

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

      {/* SECTION 2: MATCH OPPONENT CHATS (ONLY PLAYERS I HAVE A MATCH WITH) */}
      {(filterMode === 'all' || filterMode === 'upcoming' || filterMode === 'finished') && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Swords className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-white tracking-tight">
                  My Match Chats & Opponents
                </h3>
                <p className="text-xs text-white/50">
                  Private discussion rooms exclusively with players you have a match with. When a match ends, the room is faded and locked.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
              {filteredMatches.length} Opponent{filteredMatches.length === 1 ? '' : 's'}
            </span>
          </div>

          {filteredMatches.length === 0 ? (
            <div className="p-10 text-center bg-white/[0.02] border border-white/10 rounded-3xl space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                <Swords className="w-7 h-7 text-white/30" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">No Scheduled Matches Found</h4>
                <p className="text-xs text-white/50 max-w-md mx-auto mt-1">
                  {activePlayer 
                    ? `No matches scheduled yet for ${activePlayer.fcName || activePlayer.name}. Once the admin adds your fixtures, your opponent conversation rooms will show up here.`
                    : 'Please select which player you are in the dropdown above to view only your matches and opponent chats.'}
                </p>
              </div>
              {!activePlayer && registrations.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs text-[#00ff85] font-bold mr-2">Quick Select:</span>
                  <div className="inline-flex flex-wrap gap-2 justify-center max-w-xl mx-auto">
                    {registrations.slice(0, 5).map(r => (
                      <button
                        key={r.id}
                        onClick={() => handleSelectPlayer(r.id)}
                        className="px-3 py-1.5 bg-white/10 hover:bg-[#00ff85]/20 text-white hover:text-[#00ff85] rounded-xl text-xs font-bold transition-all border border-white/10"
                      >
                        {r.fcName || r.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                const { opponent, opponentName, isHome } = getOpponentInfo(match);

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
                    {/* Opponent Banner Bar */}
                    <div className="px-4 py-2 bg-white/[0.03] border-b border-white/5 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-[#00ff85]/15 text-[#00ff85] font-black text-[9px] uppercase tracking-wider border border-[#00ff85]/30">
                          Opponent
                        </span>
                        <span className="font-bold text-white">
                          {opponentName} ({opponent.name || opponent.fullName})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-white/50 text-[10px] font-mono">
                        <span>Match #{match.matchNumber}</span>
                        <span>·</span>
                        <span>{match.date || 'Scheduled'}</span>
                      </div>
                    </div>

                    {/* Match Card Row */}
                    <div 
                      onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      {/* Left: Match Number & Status */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs ${
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
                            {match.matchday ? `Matchday ${match.matchday}` : 'Tournament Fixture'}
                          </p>
                        </div>
                      </div>

                      {/* Center: Confrontation */}
                      <div className="flex items-center justify-between sm:justify-center gap-4 flex-1 max-w-md mx-auto">
                        {/* Home Team */}
                        <div className="flex items-center gap-2.5 flex-1 justify-end min-w-0">
                          <div className="text-right min-w-0">
                            <div className="flex items-center justify-end gap-1.5">
                              {isHome && (
                                <span className="px-1.5 py-0.2 bg-[#00ff85]/20 text-[#00ff85] font-black text-[8px] rounded uppercase">YOU</span>
                              )}
                              <p className="font-bold text-sm text-white truncate">{home.fullName || home.name}</p>
                            </div>
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
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-sm text-white truncate">{away.fullName || away.name}</p>
                              {!isHome && (
                                <span className="px-1.5 py-0.2 bg-[#00ff85]/20 text-[#00ff85] font-black text-[8px] rounded uppercase">YOU</span>
                              )}
                            </div>
                            <p className="text-[10px] text-[#00ff85] truncate font-mono">{away.fcName}</p>
                          </div>
                        </div>
                      </div>

                      {/* Right: Messages count & Toggle */}
                      <div className="flex items-center justify-end gap-3 shrink-0">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                          matchChatList.length > 0
                            ? 'bg-[#00ff85]/20 text-[#00ff85] border border-[#00ff85]/30'
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

                    {/* Expandable Chat Drawer with Opponent */}
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
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white/90">
                                  Conversation with {opponentName}
                                </span>
                                <span className="text-white/40 font-mono">
                                  ({opponent.country || opponent.name})
                                </span>
                              </div>
                              {isFinished ? (
                                <span className="text-red-400 font-bold flex items-center gap-1">
                                  <Lock className="w-3.5 h-3.5" />
                                  Match concluded · Input locked
                                </span>
                              ) : (
                                <span className="text-[#00ff85] font-bold flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-[#00ff85] animate-ping" />
                                  Chat Open
                                </span>
                              )}
                            </div>

                            {/* Chat Messages Log */}
                            <div className="max-h-[360px] overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-white/20">
                              {matchChatList.length === 0 ? (
                                <div className="py-12 text-center text-white/30 text-xs">
                                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                  <p>No messages with {opponentName} yet.</p>
                                  {!isFinished && (
                                    <p className="text-[11px] text-[#00ff85] mt-1 font-sans">
                                      Send a message to coordinate your match time or say hello!
                                    </p>
                                  )}
                                </div>
                              ) : (
                                matchChatList.map((msg) => {
                                  const isMyMessage = currentUser?.uid === msg.senderId || 
                                    activePlayer?.userId === msg.senderId ||
                                    activePlayer?.id === msg.senderId ||
                                    (guestSenderName && msg.senderName === guestSenderName);

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
                                  <strong>Match Concluded:</strong> Chat is faded and archived. No further messages can be sent.
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {/* Quick reaction chips */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                                  {['⚽ Ready when you are!', '🔥 Good luck!', '🎮 Inviting you now', '🏆 GG bro', '🤝 Well played', '🕒 What time works for you?'].map((quick) => (
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
                                    placeholder={`Message ${opponentName}...`}
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
