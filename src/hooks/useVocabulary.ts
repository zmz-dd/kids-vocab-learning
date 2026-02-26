
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/UserContext';
import { nanoid } from 'nanoid';
import builtinBooks from '@/assets/builtin_books.json';

// Types
export interface Word {
  word: string;
  pos: string;
  meaning: string;
  level: string; 
  bookId?: string; 
  initial?: string;
  phonetic?: string;
  audioUrl?: string;
  example?: string;
  exampleAudioUrl?: string;
}

export interface WordDetails {
  example?: string;
  exampleAudioUrl?: string;
  phonetic?: string;
  audioUrl?: string;
}

export interface UserProgress {
  status: 'new' | 'learning' | 'mastered';
  stage: number; 
  nextReview: number; 
  lastReview: number;
  learnFailCount: number; 
  testFailCount: number;  
  lastFailDate?: string;
}

export interface ProgressMap { [wordKey: string]: UserProgress; }

export interface Settings {
  dailyNewLimit: number; 
  planMode: 'days' | 'count'; 
  planDaysTarget?: number; 
  selectedBooks: string[];
  planStartDate?: number; 
  learnOrder?: 'random' | 'alphabetical';
}

export interface VocabBook {
  id: string;
  title: string;
  description?: string;
  words: Word[];
  isBuiltIn?: boolean;
}

const INTERVALS = [5, 30, 12 * 60, 24 * 60, 2 * 24 * 60, 4 * 24 * 60, 7 * 24 * 60, 15 * 24 * 60];
const STORAGE_KEY_CUSTOM_BOOKS_V3 = 'kids_vocab_custom_books_v3';
const STORAGE_KEY_WORD_OVERRIDES = 'kids_vocab_word_overrides_v1';

export function useVocabulary() {
  const { user } = useAuth();
  const [customBooks, setCustomBooks] = useState<VocabBook[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_BOOKS_V3);
    return saved ? JSON.parse(saved) : [];
  });
  // Store enriched details for builtin words (keyed by word)
  const [wordOverrides, setWordOverrides] = useState<Record<string, WordDetails>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_WORD_OVERRIDES);
    return saved ? JSON.parse(saved) : {};
  });
  const [progress, setProgress] = useState<ProgressMap>({});
  const [settings, setSettings] = useState<Settings>({ dailyNewLimit: 10, planMode: 'count', selectedBooks: [] });
  
  // v4.5: Added 'bonusWordsCount' to track user's manual "Add More" requests for today
  const [todayState, setTodayState] = useState<{ date: string; learnedCount: number; bonusWordsCount: number }>({ 
    date: new Date().toDateString(), 
    learnedCount: 0,
    bonusWordsCount: 0 
  });

  const progressKey = user ? `kids_vocab_progress_v4_${user.id}` : null;
  const settingsKey = user ? `kids_vocab_settings_v4_${user.id}` : null;
  const todayKey = user ? `kids_vocab_today_v4_${user.id}` : null;

  useEffect(() => {
    if (!progressKey || !settingsKey || !todayKey) return;
    const sP = localStorage.getItem(progressKey), sS = localStorage.getItem(settingsKey), sT = localStorage.getItem(todayKey);
    setProgress(sP ? JSON.parse(sP) : {});
    const defSettings: Settings = { dailyNewLimit: 10, planMode: 'count', selectedBooks: ['ket_level_1'], planStartDate: Date.now(), learnOrder: 'alphabetical' };
    setSettings(sS ? { ...defSettings, ...JSON.parse(sS) } : defSettings);
    const tP = sT ? JSON.parse(sT) : { date: new Date().toDateString(), learnedCount: 0, bonusWordsCount: 0 };
    if (tP.date !== new Date().toDateString()) setTodayState({ date: new Date().toDateString(), learnedCount: 0, bonusWordsCount: 0 });
    else setTodayState(tP);
  }, [user?.id]);

  useEffect(() => { if (progressKey) localStorage.setItem(progressKey, JSON.stringify(progress)); }, [progress, progressKey]);
  useEffect(() => { if (settingsKey) localStorage.setItem(settingsKey, JSON.stringify(settings)); }, [settings, settingsKey]);
  useEffect(() => { if (todayKey) localStorage.setItem(todayKey, JSON.stringify(todayState)); }, [todayState, todayKey]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_CUSTOM_BOOKS_V3, JSON.stringify(customBooks)); }, [customBooks]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_WORD_OVERRIDES, JSON.stringify(wordOverrides)); }, [wordOverrides]);

  const allBooks = useMemo(() => [...(builtinBooks as VocabBook[]), ...customBooks], [customBooks]);
  const allWords = useMemo(() => {
    return allBooks.flatMap(b => b.words.map(w => {
      const base = {...w, bookId: b.id};
      // Apply overrides if available (mainly for builtin books)
      const override = wordOverrides[w.word.toLowerCase()]; // Key by lowercase to match
      if (override) {
        return { ...base, ...override, meaning: base.meaning || override.phonetic } as Word; 
      }
      return base as Word;
    }));
  }, [allBooks, wordOverrides]);

  const planStats = useMemo(() => {
    let targetWords = allWords; if (settings.selectedBooks.length > 0) targetWords = allWords.filter(w => settings.selectedBooks.includes(w.bookId || ''));
    let total = targetWords.length, learned = 0, mastered = 0;
    targetWords.forEach(w => { 
        const p = progress[w.word]; 
        // Definition of "Learned" for Stats: anything NOT 'new'.
        if (p && p.status !== 'new') learned++; 
        if (p && p.status === 'mastered') mastered++; 
    });
    
    // Stats specifically for Selected Books
    const totalSelected = targetWords.length;
    const learnedSelected = learned;
    
    let remaining = Math.max(0, total - learned);
    let dailyQuota = settings.dailyNewLimit || 0;
    let dR = 0;
    
    if (settings.planMode === 'days' && settings.planDaysTarget && settings.planDaysTarget > 0) { 
      dailyQuota = Math.ceil(remaining / settings.planDaysTarget) || 0; 
      dR = settings.planDaysTarget; 
    } else { 
      if (dailyQuota > 0) dR = Math.ceil(remaining / dailyQuota) || 0; 
    }
    
    // Ensure numbers are valid
    dailyQuota = isNaN(dailyQuota) ? 0 : dailyQuota;
    dR = isNaN(dR) ? 0 : dR;
    
    // Final effective quota for today = calculated base quota + manual bonus
    const effectiveDailyQuota = (dailyQuota || 0) + (todayState.bonusWordsCount || 0);
    
    // Day calculation
    const currentDay = dailyQuota > 0 ? Math.floor(learnedSelected / dailyQuota) + 1 : 1;
    const totalDays = dR > 0 ? dR : (dailyQuota > 0 ? Math.ceil(totalSelected / dailyQuota) : 0);

    return { 
      total: total || 0, 
      learned: learned || 0, 
      mastered: mastered || 0, 
      remaining: remaining || 0, 
      dailyQuota, 
      effectiveDailyQuota, 
      daysRemaining: dR, 
      targetWords,
      totalSelected,
      learnedSelected,
      currentDay,
      totalDays
    };
  }, [allWords, settings, progress, todayState.bonusWordsCount]);

  const stats = useMemo(() => {
    let learned = 0, mastered = 0; const byBook: Record<string, any> = {};
    allBooks.forEach(b => { byBook[b.id] = { title: b.title, total: 0, learned: 0, mastered: 0 }; });
    allWords.forEach(w => { if (byBook[w.bookId || '']) byBook[w.bookId || ''].total++; });
    Object.entries(progress).forEach(([key, p]) => {
      if (p.status !== 'new') learned++; if (p.status === 'mastered') mastered++;
      const word = allWords.find(w => w.word === key); if (word && byBook[word.bookId || '']) { if (p.status !== 'new') byBook[word.bookId || ''].learned++; if (p.status === 'mastered') byBook[word.bookId || ''].mastered++; }
    });
    const today = new Date().toDateString(), mAll = Object.values(progress).filter(p => (p.learnFailCount + p.testFailCount) > 0);
    return { total: allWords.length, learned, mastered, byBookDetailed: byBook, mistakeCount: mAll.length, mistakeTodayCount: mAll.filter(p => p.lastFailDate === today).length };
  }, [progress, allWords, allBooks]);

  const addCustomBook = (title: string, words: Word[], description?: string) => { 
    const id = nanoid(); 
    setCustomBooks(p => [...p, { id, title, words, description, isBuiltIn: false }]); 
    return id; 
  };
  const updateBookWords = (bId: string, nW: Word[]) => { 
    setCustomBooks(p => p.map(b => b.id === bId ? { ...b, words: nW } : b)); 
  };
  const deleteCustomBook = (id: string) => { 
    setCustomBooks(p => p.filter(b => b.id !== id)); 
  };
  const resetTodayProgress = () => {
    setTodayState(prev => ({ ...prev, learnedCount: 0, bonusWordsCount: 0 }));
  };
  
  const updateWordDetails = (detailsMap: Record<string, WordDetails>) => {
    setWordOverrides(prev => ({ ...prev, ...detailsMap }));
  };

  const getReviewQueue = () => planStats.targetWords.filter(w => { const p = progress[w.word]; return p && p.status === 'learning' && p.nextReview <= Date.now(); });
  
  const getNewWords = (count: number) => { 
    // Strict Source: Only unlearned words from targetWords (which is already filtered by selectedBooks)
    // No fallback to learned words.
    
    if (count <= 0) return []; 

    const shuffle = (array: Word[]) => array.sort(() => Math.random() - 0.5);
    const alphaSort = (array: Word[]) => array.sort((a, b) => a.word.localeCompare(b.word));

    // 1. Priority: Unlearned (New) words from selected books
    let unlearned = planStats.targetWords.filter(w => !progress[w.word]);
    
    if (settings.learnOrder === 'random') {
        unlearned = shuffle(unlearned);
    } else {
        // Default to Alphabetical
        unlearned = alphaSort(unlearned);
    }

    // STRICT: Only return unlearned words. 
    // If book is finished, return empty. Learn.tsx will handle "Session Complete".
    return unlearned.slice(0, count);
  };

  const addBonusWords = (count: number) => {
    setTodayState(prev => ({ ...prev, bonusWordsCount: prev.bonusWordsCount + count }));
  };

  const getMistakes = (filter: 'all' | 'today' | 'learn' | 'test') => {
    const today = new Date().toDateString();
    return allWords.filter(w => {
      const p = progress[w.word]; if (!p) return false;
      if (filter === 'today') return p.lastFailDate === today;
      if (filter === 'learn') return p.learnFailCount > 0;
      if (filter === 'test') return p.testFailCount > 0;
      return (p.learnFailCount + p.testFailCount) > 0;
    }).sort((a, b) => { const pA = progress[a.word], pB = progress[b.word]; return (pB.learnFailCount + pB.testFailCount) - (pA.learnFailCount + pA.testFailCount); });
  };

  const submitWordResult = (word: string, res: 'easy' | 'good' | 'hard' | 'skip') => {
    if (!user) return; const today = new Date().toDateString();
    setProgress(p => {
      const cur = p[word] || { status: 'new', stage: 0, nextReview: 0, lastReview: 0, learnFailCount: 0, testFailCount: 0 };
      
      if (res === 'skip') {
          // Skip means "I know this". Mark as mastered immediately.
          if (cur.status === 'new') setTodayState(prev => ({ ...prev, learnedCount: prev.learnedCount + 1 }));
          return { ...p, [word]: { ...cur, status: 'mastered', stage: INTERVALS.length, nextReview: Date.now() + 30 * 24 * 60 * 60 * 1000, lastReview: Date.now() } };
      }

      let nS = cur.stage, nR = Date.now(), status: UserProgress['status'] = 'learning', lF = cur.learnFailCount, lFD = cur.lastFailDate;
      if (res === 'hard') { nS = 0; nR += 5 * 60 * 1000; lF += 1; lFD = today; }
      else if (res === 'good') { nS += 1; nR += INTERVALS[Math.min(nS, INTERVALS.length - 1)] * 60 * 1000; }
      else if (res === 'easy') { nS += 2; nR += INTERVALS[Math.min(nS, INTERVALS.length - 1)] * 60 * 1000; }
      
      if (nS >= INTERVALS.length) status = 'mastered';
      
      // Update learned count if it was new
      if (cur.status === 'new') setTodayState(prev => ({ ...prev, learnedCount: prev.learnedCount + 1 }));
      
      return { ...p, [word]: { ...cur, status, stage: nS, nextReview: nR, lastReview: Date.now(), learnFailCount: lF, lastFailDate: lFD } };
    });
  };

  const submitTestResult = (word: string, correct: boolean) => {
    if (!user) return; const today = new Date().toDateString();
    setProgress(p => {
        const cur = p[word] || { status: 'new', stage: 0, nextReview: 0, lastReview: 0, learnFailCount: 0, testFailCount: 0 };
        let tF = cur.testFailCount, lFD = cur.lastFailDate; if (!correct) { tF += 1; lFD = today; }
        return { ...p, [word]: { ...cur, testFailCount: tF, lastFailDate: lFD } };
    });
  };

  const getQuizPool = (range: string, targetBookId?: string) => {
    const today = new Date().toDateString(), todayStart = new Date(today).getTime();
    switch (range) {
      case 'all-learned': return allWords.filter(w => progress[w.word]?.status !== 'new');
      case 'today-learned': return allWords.filter(w => progress[w.word]?.status !== 'new' && progress[w.word]?.lastReview >= todayStart);
      case 'book': return targetBookId ? allWords.filter(w => w.bookId === targetBookId) : [];
      case 'all-mistakes': return getMistakes('all');
      case 'today-mistakes': return getMistakes('today');
      default: return allWords;
    }
  };

  const getGlobalLeaderboard = () => {
    // User requested: Mastered = Passed Test OR Known in Learn OR Known in Mistakes.
    // Count "Learned" (status != new) as the score.
    
    const uS = localStorage.getItem('kids_vocab_users_v2'), users = uS ? JSON.parse(uS) : [];
    return users.filter((u: any) => !u.isAdmin).map((u: any) => {
        const pS = localStorage.getItem(`kids_vocab_progress_v4_${u.id}`), pM = pS ? JSON.parse(pS) : {};
        // Count all non-new words
        let m = 0; Object.values(pM).forEach((v: any) => { if (v.status !== 'new') m++; });
        return { id: u.id, username: u.username, avatarColor: u.avatarColor, avatarId: u.avatarId, mastered: m };
    }).sort((a: any, b: any) => b.mastered - a.mastered);
  };

  return { user, settings, setSettings, stats, planStats, progress, todayState, customBooks, allBooks, addCustomBook, updateBookWords, deleteCustomBook, resetTodayProgress, updateWordDetails, getReviewQueue, getNewWords, addBonusWords, getMistakes, submitWordResult, submitTestResult, allWords, getGlobalLeaderboard, getQuizPool };
}
