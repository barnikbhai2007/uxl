import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Send, Smile, Shield, Check, CheckCheck, Clock, 
  MessageSquare, User, Trophy, Calendar, Sparkles, AlertCircle, History, Info, Lock
} from 'lucide-react';
import { Team, Match, DirectChatMessage, Registration } from '../types';
import { soundService } from '../utils/notificationSound';
import { getClubLogo } from '../App';
import { getClubManager } from '../constants';

interface OpponentDirectChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  match?: Match | null;
  currentUserRegistration?: Registration | null;
  opponentRegistration?: Registration | null;
  opponentTeam?: Team | null;
  myTeam?: Team | null;
  messages: DirectChatMessage[];
  onSendMessage: (text: string) => Promise<void>;
  isScored?: boolean;
}

const QUICK_EMOJIS = ['⚽', '🏆', '🔥', '👍', '🤝', '😂', '🥅', '⏱️', '👏', '🎮', '🥊', '🥇', '⚡', '🎯', '🚀', '🥶'];

const EMOJI_CATEGORIES = {
  'Football & Sport': ['⚽', '🥅', '👟', '🎮', '🕹️', '🏆', '🥇', '🥈', '🥉', '🥊', '🎯', '⏱️'],
  'Reactions & Banter': ['🔥', '⚡', '🚀', '💥', '💯', '🥶', '💀', '👑', '🪄', '🛡️', '⚔️', '😎'],
  'Smileys & Gestures': ['😄', '😂', '🤣', '🤩', '😤', '🤯', '🥳', '🤝', '👍', '👏', '👋', '👀']
};

const QUICK_PHRASES = [
  'Ready to play! Join my room 🎮',
  "What's your FC 25 / EA ID? 🆔",
  'Sending invite now, check notifications 📩',
  'Good game, well played! 🤝',
  'Score submitted to admin, please confirm ✅',
  'Need 2 minutes to warm up ⏱️',
  'Connection check / lag test? 📶'
];

export const OpponentDirectChatModal: React.FC<OpponentDirectChatModalProps> = ({
  isOpen,
  onClose,
  match,
  currentUserRegistration,
  opponentRegistration,
  opponentTeam,
  myTeam,
  messages,
  onSendMessage,
  isScored
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPhrases, setShowPhrases] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const text = inputText.trim();
    setInputText('');
    setIsSending(true);
    setShowEmojiPicker(false);
    setShowPhrases(false);

    try {
      await onSendMessage(text);
      soundService.playMessageChime();
    } catch (err) {
      console.error('Failed to send direct message:', err);
      alert('Failed to send message. Please retry.');
      setInputText(text);
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleAddEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleSelectPhrase = (phrase: string) => {
    setInputText(phrase);
    setShowPhrases(false);
    inputRef.current?.focus();
  };

  // Club / Manager info
  const myClubName = currentUserRegistration?.country || myTeam?.country || myTeam?.name || 'My Club';
  const myManager = currentUserRegistration?.managerName || getClubManager(myClubName)?.manager || 'Manager';
  const myLogo = currentUserRegistration?.logoUrl || getClubLogo(myClubName) || getClubLogo(myTeam?.country);

  const oppClubName = opponentRegistration?.country || opponentTeam?.country || opponentTeam?.name || 'Opponent Club';
  const oppManager = opponentRegistration?.managerName || getClubManager(oppClubName)?.manager || 'Manager';
  const oppPhoto = opponentRegistration?.managerPhoto || getClubManager(oppClubName)?.managerPhoto;
  const oppLogo = opponentRegistration?.logoUrl || getClubLogo(oppClubName) || getClubLogo(opponentTeam?.country) || getClubLogo(opponentTeam?.name);
  const oppPlayerName = opponentRegistration?.name || opponentTeam?.name || 'Opponent';

  const matchFinished = isScored || match?.status === 'finished' || (match?.homeScore !== undefined && match?.awayScore !== undefined);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen && typeof document !== 'undefined') {
      const orig = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = orig;
      };
    }
  }, [isOpen]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[99990] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 25 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 25 }}
        className="w-full max-w-xl bg-zinc-950 border-t sm:border border-white/15 rounded-t-[2rem] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh] sm:h-[85vh] max-h-[720px]"
      >
        {/* Mobile Pull Handle */}
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* Header with Opponent Details */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-fc-purple-dark via-zinc-950 to-zinc-900 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Opponent Club Crest Logo (Not Manager Photo) */}
            <div className="relative w-12 h-12 rounded-2xl bg-black/40 border-2 border-fc-neon-green/40 p-1.5 flex items-center justify-center shadow-lg shrink-0 overflow-hidden">
              {oppLogo ? (
                <img
                  src={oppLogo}
                  alt={oppClubName}
                  className="w-full h-full object-contain filter drop-shadow-sm"
                />
              ) : oppPhoto ? (
                <img
                  src={oppPhoto}
                  alt={oppManager}
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <div className="text-white/50 font-bold text-lg">
                  {oppClubName?.[0] || '⚽'}
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-base truncate font-display">
                  {oppPlayerName}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-fc-neon-green/20 text-fc-neon-green border border-fc-neon-green/30">
                  Opponent
                </span>
              </div>
              <p className="text-xs text-white/60 truncate flex items-center gap-1.5 mt-0.5">
                <span className="text-fc-neon-green font-semibold">{oppClubName}</span>
                {oppManager && (
                  <>
                    <span className="text-white/30">•</span>
                    <span className="text-white/70 text-[11px]">Mgr: {oppManager}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {match && (
              <div className="hidden sm:flex flex-col items-end text-right">
                <span className="text-[10px] uppercase font-bold text-white/40">
                  {match.leg || `Match #${match.matchNumber || 1}`}
                </span>
                <span className="text-xs font-bold text-fc-neon-green">
                  {match.date || 'Scheduled'}
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 text-white/40 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              title="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Match Scored Notice (Stored & Archived) */}
        {matchFinished && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-[11px] text-amber-300">
            <span className="flex items-center gap-1.5 font-bold">
              <History className="w-3.5 h-3.5 text-amber-400" />
              Score Updated ({match?.homeScore ?? '-'} - {match?.awayScore ?? '-'}). Chat history is preserved for future matches.
            </span>
            <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Archived</span>
          </div>
        )}

        {/* Quick Emojis Bar */}
        <div className="bg-white/[0.02] border-b border-white/5 px-4 py-2 flex items-center gap-1 overflow-x-auto hide-scrollbar">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 mr-1.5 shrink-0">
            Quick:
          </span>
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleAddEmoji(emoji)}
              className="p-1 text-base hover:scale-125 active:scale-95 transition-transform rounded-lg hover:bg-white/10 shrink-0"
              title={`Add ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowPhrases(!showPhrases)}
            className="ml-auto text-[10px] font-bold text-fc-neon-green hover:underline px-2 py-0.5 rounded-lg bg-fc-neon-green/10 border border-fc-neon-green/20 shrink-0 whitespace-nowrap"
          >
            Presets 💬
          </button>
        </div>

        {/* Preset Football Phrases Dropdown */}
        <AnimatePresence>
          {showPhrases && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-zinc-900 border-b border-white/10 p-3 overflow-hidden"
            >
              <p className="text-[10px] font-bold uppercase text-white/40 mb-2">
                Quick Match Communications
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {QUICK_PHRASES.map((phrase, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPhrase(phrase)}
                    className="text-left px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-white/80 hover:text-fc-neon-green border border-white/5 hover:border-fc-neon-green/30 transition-all truncate"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900/60">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/40 space-y-3">
              <div className="p-4 rounded-3xl bg-white/5 border border-white/10">
                <MessageSquare className="w-8 h-8 text-fc-neon-green/50 mx-auto" />
              </div>
              <div className="max-w-xs space-y-1">
                <h4 className="font-bold text-white text-sm">Direct Match Channel</h4>
                <p className="text-xs text-white/50 leading-relaxed">
                  Coordinate your match time, exchange EA room invites, and banter with {oppPlayerName}.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleSelectPhrase('Ready to play! Join my room 🎮')}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-xs text-white font-medium hover:border-fc-neon-green/40 transition-all"
                >
                  Say "Ready to play! 🎮"
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === currentUserRegistration?.userId || msg.senderId === currentUserRegistration?.id;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[82%] sm:max-w-[75%] rounded-2xl p-3 shadow-md ${
                      isMe
                        ? 'bg-fc-neon-green text-black rounded-tr-sm font-medium'
                        : 'bg-zinc-900 border border-white/10 text-white rounded-tl-sm'
                    }`}
                  >
                    {!isMe && (
                      <div className="text-[10px] font-bold text-fc-neon-green/90 mb-0.5 flex items-center gap-1">
                        <span>{msg.senderName}</span>
                        {msg.senderClub && (
                          <span className="text-white/40 font-normal">({msg.senderClub})</span>
                        )}
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {msg.text}
                    </p>
                    <div
                      className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${
                        isMe ? 'text-black/60 font-semibold' : 'text-white/40'
                      }`}
                    >
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMe && <CheckCheck className="w-3 h-3 text-black/70 inline" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Expandable Emoji Picker Modal/Tray */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-zinc-900 border-t border-white/10 p-3 max-h-48 overflow-y-auto"
            >
              <div className="space-y-2">
                {Object.entries(EMOJI_CATEGORIES).map(([cat, emojis]) => (
                  <div key={cat}>
                    <p className="text-[9px] font-bold uppercase text-white/40 mb-1">{cat}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {emojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleAddEmoji(emoji)}
                          className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-lg hover:scale-125 transition-transform"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message Input Footer: Active for upcoming matches, locked when match is done */}
        {matchFinished ? (
          <div className="p-4 border-t border-white/10 bg-zinc-950/90 flex items-center justify-center gap-2 text-white/50 text-xs font-semibold">
            <Lock className="w-4 h-4 text-amber-400" />
            <span>Match finished — chat is closed and archived (read-only)</span>
          </div>
        ) : (
          <form
            onSubmit={handleSend}
            className="p-3 border-t border-white/10 bg-zinc-950 flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2.5 rounded-xl border transition-all ${
                showEmojiPicker
                  ? 'bg-fc-neon-green/20 text-fc-neon-green border-fc-neon-green/40'
                  : 'bg-white/5 text-white/60 hover:text-white border-white/10 hover:bg-white/10'
              }`}
              title="Emoji Picker"
            >
              <Smile className="w-5 h-5" />
            </button>

            <input
              ref={inputRef}
              type="text"
              placeholder="Message your opponent..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-fc-neon-green transition-all"
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="p-2.5 bg-fc-neon-green text-black font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none shadow-md shadow-fc-neon-green/20 cursor-pointer"
              title="Send Message"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        )}
      </motion.div>
    </div>,
    document.body
  );
};
