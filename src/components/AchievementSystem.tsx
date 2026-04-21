import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Star, Shield, Award, X, Sparkles, Target, Zap, Heart, Ghost, Skull, Smile } from 'lucide-react';
import { Achievement, UserAchievement } from '../types';
import { ACHIEVEMENTS } from '../achievements';

const CATEGORY_ICONS: Record<string, any> = {
  'Match': Trophy,
  'Goal': Target,
  'Tournament': Award,
  'Cursed': Ghost,
  'Tragic': Skull,
  'Unhinged': Zap,
  'Glove Story': Shield
};

const CATEGORY_COLORS: Record<string, string> = {
  'Match': 'blue',
  'Goal': 'green',
  'Tournament': 'yellow',
  'Cursed': 'purple',
  'Tragic': 'red',
  'Unhinged': 'orange',
  'Glove Story': 'cyan'
};

export const AchievementBadge: React.FC<{ achievement: Achievement, unlockedAt?: any, isLocked: boolean }> = ({ achievement, unlockedAt, isLocked }) => {
  const Icon = CATEGORY_ICONS[achievement.category] || Star;
  const color = CATEGORY_COLORS[achievement.category] || 'blue';

  return (
    <motion.div
      whileHover={!isLocked ? { scale: 1.05, y: -5 } : {}}
      className={`relative p-6 rounded-[2rem] border transition-all duration-500 overflow-hidden group ${
        isLocked 
          ? 'bg-white/[0.02] border-white/5 opacity-40 grayscale blur-[0.5px]' 
          : 'bg-[#000040] border-white/10 shadow-2xl hover:shadow-blue-500/20'
      }`}
    >
      {!isLocked && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent pointer-events-none" />
      )}
      
      <div className="relative z-10 flex flex-col items-center text-center gap-4">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg relative ${
          isLocked ? 'bg-white/5 border border-white/10' : `bg-${color}-500/20 border border-${color}-500/30`
        }`}>
          {isLocked ? (
            <div className="relative">
              <span className="opacity-50">{achievement.icon}</span>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 bg-black/60 rounded-full flex items-center justify-center border border-white/20">
                  <Skull className="w-3 h-3 text-white/40" />
                </div>
              </div>
            </div>
          ) : (
            <span className="drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{achievement.icon}</span>
          )}
          
          {!isLocked && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-2 opacity-20"
            >
              <Sparkles className="w-full h-full text-blue-400" />
            </motion.div>
          )}
        </div>

        <div>
          <h4 className={`text-sm font-black uppercase italic tracking-tight mb-1 ${isLocked ? 'text-white/40' : 'text-white'}`}>
            {achievement.title}
          </h4>
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest line-clamp-2 min-h-[32px]">
            {achievement.description}
          </p>
        </div>

        {unlockedAt && (
          <div className="pt-4 mt-auto border-t border-white/5 w-full">
            <span className="text-[9px] font-black text-blue-400/60 uppercase tracking-widest">
              Unlocked {new Date(unlockedAt).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const AchievementPopup = ({ achievement, onClose }: { achievement: Achievement, onClose: () => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 50 }}
      className="fixed bottom-8 right-8 z-[200] w-full max-w-sm"
    >
      <div className="bg-[#000040] border-2 border-yellow-500/50 rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 via-transparent to-blue-500/10 pointer-events-none" />
        
        {/* Particle Effects */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
          {Array.from({ length: 15 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: 200, x: Math.random() * 300, opacity: 0 }}
              animate={{ y: -100, opacity: [0, 1, 0] }}
              transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
              className="absolute w-1 h-1 bg-yellow-400 rounded-full"
            />
          ))}
        </div>

        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/30 hover:text-white transition-colors z-20"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="relative z-10 flex flex-col items-center text-center gap-6">
          <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-3xl flex items-center justify-center text-5xl shadow-[0_0_30px_rgba(234,179,8,0.4)] relative">
            <span className="animate-bounce">{achievement.icon}</span>
            <motion.div
              animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-4 -right-4"
            >
              <Sparkles className="w-8 h-8 text-white drop-shadow-2xl" />
            </motion.div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-black text-yellow-500 uppercase tracking-[0.4em] mb-1">New Achievement</div>
            <h3 className="text-2xl font-display font-black text-white uppercase italic tracking-tighter leadning-none">
              {achievement.title}
            </h3>
            <p className="text-sm font-medium text-white/60 tracking-tight italic">
              "{achievement.description}"
            </p>
          </div>

          <div className="w-full h-px bg-white/10" />

          <button 
            onClick={onClose}
            className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-[#000040] font-black uppercase text-xs tracking-[0.3em] rounded-2xl transition-all shadow-xl shadow-yellow-500/20"
          >
            Claim Glory
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export const AchievementsList = ({ userAchievements }: { userAchievements: UserAchievement[] }) => {
  const categories = Array.from(new Set(ACHIEVEMENTS.map(a => a.category)));

  return (
    <div className="space-y-16">
      {categories.map(category => {
        const categoryAchievements = ACHIEVEMENTS.filter(a => a.category === category);
        const unlockedCount = categoryAchievements.filter(a => userAchievements.some(ua => ua.achievementId === a.id)).length;

        return (
          <div key={category} className="space-y-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl bg-${CATEGORY_COLORS[category]}-500/10 border border-${CATEGORY_COLORS[category]}-500/20`}>
                  {React.createElement(CATEGORY_ICONS[category] || Star, { className: `w-6 h-6 text-${CATEGORY_COLORS[category]}-400` })}
                </div>
                <div>
                  <h3 className="text-2xl font-display font-black text-white uppercase italic tracking-tight">{category}</h3>
                  <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mt-1">Unlocked {unlockedCount}/{categoryAchievements.length}</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {categoryAchievements.map(achievement => {
                const unlocked = userAchievements.find(ua => ua.achievementId === achievement.id);
                return (
                  <AchievementBadge 
                    key={achievement.id}
                    achievement={achievement}
                    isLocked={!unlocked}
                    unlockedAt={unlocked?.unlockedAt}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
