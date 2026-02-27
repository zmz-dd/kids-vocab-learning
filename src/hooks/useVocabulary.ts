
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/UserContext';
import { nanoid } from 'nanoid';
import builtinBooks from '@/assets/builtin_books.json';

// --- Data Structures ---

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
  stage: number; // 0-7 Ebbinghaus stage
  nextReview: number; // Timestamp
  lastReview: number; // Timestamp
  firstLearnedAt: number; // Timestamp when first learned (status changed from new)
  errorCount: number; // Cumulative error count (Learn + Review + Test)
}

export interface ProgressMap { 
    [wordKey: string]: UserProgress; 
}

export interface PlanSettings {
  id: string; // Plan ID to track versions
  createdAt: number;
  selectedBooks: string[];
  planMode: 'count' | 'days';
  dailyLimit: number; // Words per day
  daysTarget?: number;
  learnOrder: 'alphabetical' | 'random';
}

export interface PlanState {
    todayDate: string;
    todayLearnedCount: number; // Count of words learned today (for daily goal)
    todayMistakes: string[]; // List of word keys
}

export interface TestRecord {
    id: string;
    timestamp: number;
    scope: string;
    count: number;
    score: number;
    mistakes: string[];
}

export interface VocabBook {
  id: string;
  title: string;
  description?: string;
  words: Word[];
  isBuiltIn?: boolean;
}

// Ebbinghaus Intervals (minutes)
const INTERVALS = [5, 30, 12 * 60, 24 * 60, 2 * 24 * 60, 4 * 24 * 60, 7 * 24 * 60, 15 * 24 * 60];

const STORAGE_KEY_CUSTOM_BOOKS = 'kids_vocab_custom_books_v3';
const STORAGE_KEY_WORD_OVERRIDES = 'kids_vocab_word_overrides_v1';

export function useVocabulary() {
  const { user } = useAuth();
  
  // --- Global State (Shared across users in browser, but independent logic) ---
  const [customBooks, setCustomBooks] = useState<VocabBook[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CUSTOM_BOOKS);
    return saved ? JSON.parse(saved) : [];
  });
  const [wordOverrides, setWordOverrides] = useState<Record<string, WordDetails>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_WORD_OVERRIDES);
    return saved ? JSON.parse(saved) : {};
  });

  // --- User Specific State ---
  const [plan, setPlan] = useState<PlanSettings | null>(null);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [planState, setPlanState] = useState<PlanState>({ todayDate: new Date().toDateString(), todayLearnedCount: 0, todayMistakes: [] });
  const [testHistory, setTestHistory] = useState<TestRecord[]>([]);

  // Keys
  const progressKey = user ? `kids_vocab_progress_v5_${user.id}` : null;
  const planKey = user ? `kids_vocab_plan_v5_${user.id}` : null;
  const historyKey = user ? `kids_vocab_test_history_v5_${user.id}` : null;

  // --- Load Data ---
  useEffect(() => {
    if (!user) return;
    
    const savedPlan = localStorage.getItem(planKey!);
    if (savedPlan) {
        const p = JSON.parse(savedPlan);
        // Migration check if needed, else set
        setPlan(p);
        
        // Load plan state (embedded in plan or separate? Requirement says separate logic for "Today")
        // Let's store daily state in localStorage too for persistence
        const savedState = localStorage.getItem(`${planKey}_state`);
        if (savedState) {
            const s = JSON.parse(savedState);
            if (s.todayDate !== new Date().toDateString()) {
                // New Day -> Reset counters but keep mistakes? No, Today Mistakes should be reset.
                setPlanState({ todayDate: new Date().toDateString(), todayLearnedCount: 0, todayMistakes: [] });
            } else {
                setPlanState(s);
            }
        } else {
            setPlanState({ todayDate: new Date().toDateString(), todayLearnedCount: 0, todayMistakes: [] });
        }
    } else {
        setPlan(null); // No plan yet
    }

    const savedProgress = localStorage.getItem(progressKey!);
    setProgress(savedProgress ? JSON.parse(savedProgress) : {});

    const savedHistory = localStorage.getItem(historyKey!);
    setTestHistory(savedHistory ? JSON.parse(savedHistory) : []);

  }, [user, planKey, progressKey, historyKey]);

  // --- Save Data ---
  useEffect(() => { if (user && plan) localStorage.setItem(planKey!, JSON.stringify(plan)); }, [plan, planKey, user]);
  useEffect(() => { if (user && plan) localStorage.setItem(`${planKey}_state`, JSON.stringify(planState)); }, [planState, planKey, user, plan]);
  useEffect(() => { if (user) localStorage.setItem(progressKey!, JSON.stringify(progress)); }, [progress, progressKey, user]);
  useEffect(() => { if (user) localStorage.setItem(historyKey!, JSON.stringify(testHistory)); }, [testHistory, historyKey, user]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_CUSTOM_BOOKS, JSON.stringify(customBooks)); }, [customBooks]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_WORD_OVERRIDES, JSON.stringify(wordOverrides)); }, [wordOverrides]);

  // --- Derived Data ---
  const allBooks = useMemo(() => [...(builtinBooks as VocabBook[]), ...customBooks], [customBooks]);
  
  const allWords = useMemo(() => {
    return allBooks.flatMap(b => b.words.map(w => {
      const base = {...w, bookId: b.id};
      const override = wordOverrides[w.word.toLowerCase()];
      if (override) {
        return { ...base, ...override, meaning: base.meaning || override.phonetic } as Word; 
      }
      return base as Word;
    }));
  }, [allBooks, wordOverrides]);

  // Helper: Get active words for current plan
  const planWords = useMemo(() => {
      if (!plan) return [];
      return allWords.filter(w => plan.selectedBooks.includes(w.bookId || ''));
  }, [allWords, plan]);

  const stats = useMemo(() => {
      if (!plan) return null;
      
      const learnedUnique = planWords.filter(w => progress[w.word]?.status && progress[w.word].status !== 'new').length;
      const totalWords = planWords.length;
      const remaining = totalWords - learnedUnique;
      
      // Calculate effective daily goal
      let dailyGoal = plan.dailyLimit;
      if (plan.planMode === 'days' && plan.daysTarget && plan.daysTarget > 0) {
          // Recalculate daily goal based on remaining words and days? 
          // Or just static? Requirement 3-4 says "auto calculate".
          // Let's stick to the stored dailyLimit which should be calculated at set time, 
          // OR recalculate dynamically if we want "adaptive". 
          // Simple approach: Use stored dailyLimit.
      }

      // Check if plan finished
      const isFinished = remaining === 0;

      // Calculate days progress
      const daysSinceStart = Math.max(1, Math.ceil((Date.now() - plan.createdAt) / (1000 * 60 * 60 * 24)));
      const daysTarget = plan.planMode === 'days' ? plan.daysTarget : Math.ceil(totalWords / (plan.dailyLimit || 1));

      return {
          totalWords,
          learnedUnique,
          remaining,
          dailyGoal,
          todayLearned: planState.todayLearnedCount,
          isFinished,
          daysSinceStart,
          daysTarget: daysTarget || 1
      };
  }, [plan, planWords, progress, planState.todayLearnedCount]);

  // --- Actions ---

  const savePlan = (settings: Omit<PlanSettings, 'id' | 'createdAt'>) => {
      if (!user) return;
      
      const newBookSet = new Set(settings.selectedBooks);
      const oldBookSet = new Set(plan?.selectedBooks || []);
      
      // Check if book scope changed (Removed any? Swapped?)
      // If new is strict superset or same -> Modify
      // If any old book is missing in new -> Reset
      let isReset = false;
      if (plan) {
          for (const book of oldBookSet) {
              if (!newBookSet.has(book)) {
                  isReset = true;
                  break;
              }
          }
      } else {
          isReset = true; // First plan
      }

      if (isReset) {
          // New Plan ID, Clear Data?
          // Req 3-4: "Clear original plan's learning data... confirm dialog".
          // The confirmation UI should handle the prompt. Here we execute.
          const newId = nanoid();
          setPlan({
              ...settings,
              id: newId,
              createdAt: Date.now()
          });
          // Clear progress for current user? 
          // Req: "Clear original plan's learning data". 
          // This implies clearing 'progress' map entirely or filtering it?
          // Since progress is keyed by word, and we might select new books with same words...
          // If we reset, we usually expect to start fresh.
          // Let's clear progress map.
          setProgress({});
          setPlanState({ todayDate: new Date().toDateString(), todayLearnedCount: 0, todayMistakes: [] });
          setTestHistory([]); // Clear history? Req doesn't specify, but implies "Clear all data".
      } else {
          // Modify Mode
          // Keep ID, Keep Progress.
          // Update settings (e.g. daily limit, order, added books)
          if (plan) {
              setPlan({
                  ...plan,
                  ...settings
              });
              // Reset today count? Req 3-4: "Plan modified -> Recalculate... effective immediately".
              // "Today Learned" is factual. Should we reset it? 
              // Req 3-4: "Reset 'Today Learned' to 0" on modification? 
              // Re-read 3-4: "If modified... plan number remains... reserve record... re-plan remaining".
              // Only if "Reset Books" (Reset Mode) it says "Clear data".
              // For modification: "Retain current book learned records". 
              // Does not explicitly say reset Today count. But usually changing daily limit implies new day start?
              // Let's NOT reset today count for minor mods, only for full reset.
          }
      }
  };

  const getTodayTask = useCallback(() => {
      if (!plan) return [];
      
      // 1. Filter unlearned words from selected books
      // "Strict adherence" - logic in planWords already does this.
      let unlearned = planWords.filter(w => !progress[w.word] || progress[w.word].status === 'new');
      
      // 2. Sort
      if (plan.learnOrder === 'random') {
          unlearned = unlearned.sort(() => Math.random() - 0.5);
      } else {
          unlearned = unlearned.sort((a, b) => a.word.localeCompare(b.word));
      }
      
      // 3. Limit?
      // Req 4-3: "Click Start -> Load ALL words for the day... e.g. 99".
      // "If quit at 8, resume at 9".
      // So we need to return (DailyGoal - TodayLearned) words.
      const remainingQuota = Math.max(0, plan.dailyLimit - planState.todayLearnedCount);
      
      // If user requested "Append", bonus words are handled by just increasing quota?
      // Req 4-3: "Append 10... today learned increases...".
      // We should probably just ask for N words.
      // But the "Task" is technically the remaining quota.
      
      return unlearned.slice(0, remainingQuota);
  }, [plan, planWords, progress, planState.todayLearnedCount]);

  const recordLearnResult = (word: string, result: 'know' | 'dont-know') => {
      const today = new Date().toDateString();
      
      // Update Progress
      setProgress(prev => {
          const current = prev[word] || { 
              status: 'new', 
              stage: 0, 
              nextReview: 0, 
              lastReview: 0, 
              firstLearnedAt: 0, 
              errorCount: 0 
          };
          
          let newState = { ...current };
          
          // First time learning?
          if (newState.status === 'new') {
              newState.status = 'learning';
              newState.firstLearnedAt = Date.now();
              // Increment Today Learned Count immediately (Req 4-1)
              setPlanState(ps => ({
                  ...ps,
                  todayLearnedCount: ps.todayLearnedCount + 1
              }));
          }
          
          newState.lastReview = Date.now();
          
          if (result === 'dont-know') {
              // Error
              newState.errorCount += 1;
              newState.stage = 0; // Reset stage
              newState.nextReview = Date.now() + 5 * 60 * 1000; // 5 min review
              
              // Add to Today Mistakes (Req 4-1)
              setPlanState(ps => ({
                  ...ps,
                  todayMistakes: ps.todayMistakes.includes(word) ? ps.todayMistakes : [...ps.todayMistakes, word]
              }));
          } else {
              // Know
              // Advance stage
              newState.stage = Math.min(newState.stage + 1, INTERVALS.length - 1);
              newState.nextReview = Date.now() + INTERVALS[newState.stage] * 60 * 1000;
              if (newState.stage >= 5) newState.status = 'mastered'; // Simple mastery rule
          }
          
          return { ...prev, [word]: newState };
      });
  };

  const addBonusQuota = (count: number) => {
      // Just modify plan limit temporarily? Or handle in component?
      // Req 4-3: "Plan goal 99... append 10... goal remains 99...".
      // But "Today Learned" increases.
      // The `getTodayTask` relies on (Limit - Learned). If Limit is 99 and Learned is 99, returns 0.
      // To get 10 more, we must trick it? 
      // No, let's just expose a function `fetchMore(count)` that ignores the daily limit.
  };
  
  const fetchRawNewWords = useCallback((count: number) => {
      if (!plan) return [];
      let unlearned = planWords.filter(w => !progress[w.word] || progress[w.word].status === 'new');
      if (plan.learnOrder === 'random') {
          // create copy to sort
          unlearned = [...unlearned].sort(() => Math.random() - 0.5);
      } else {
          unlearned = [...unlearned].sort((a, b) => a.word.localeCompare(b.word));
      }
      return unlearned.slice(0, count);
  }, [plan, planWords, progress]);

  const getReviewTask = useCallback((mode: 'today' | 'scientific') => {
      const todayStart = new Date(new Date().toDateString()).getTime();
      
      if (mode === 'today') {
          // Req 6: "Today's learned words"
          // Words where lastReview >= todayStart
          return planWords.filter(w => {
              const p = progress[w.word];
              return p && p.lastReview >= todayStart;
          });
      } else {
          // Scientific
          return planWords.filter(w => {
              const p = progress[w.word];
              return p && p.status !== 'new' && p.nextReview <= Date.now();
          });
      }
  }, [planWords, progress]);

  const recordReviewResult = useCallback((word: string, result: 'know' | 'dont-know', mode: 'today' | 'scientific') => {
      // Req 6: "Don't know -> Today Mistakes"
      // "Know -> Remove from today's review task" (This is UI logic mainly, but state update helps)
      
      setProgress(prev => {
          const current = prev[word];
          if (!current) return prev; // Should not happen
          
          let newState = { ...current };
          newState.lastReview = Date.now();
          
          if (result === 'dont-know') {
              newState.errorCount += 1;
              newState.stage = 0; // Reset stage on fail
              newState.nextReview = Date.now() + 5 * 60 * 1000;
              setPlanState(ps => ({
                  ...ps,
                  todayMistakes: ps.todayMistakes.includes(word) ? ps.todayMistakes : [...ps.todayMistakes, word]
              }));
          } else {
              // Scientific mode: Success advances stage
              if (mode === 'scientific') {
                  newState.stage = Math.min(newState.stage + 1, INTERVALS.length - 1);
                  newState.nextReview = Date.now() + INTERVALS[newState.stage] * 60 * 1000;
              }
              // Today mode: Just verification, maybe don't advance stage? 
              // Req 6: "Remove from today's review".
          }
          
          return { ...prev, [word]: newState };
      });
  }, []);

  const getMistakesList = useCallback((filter: 'all' | 'today' | 'high-freq') => {
      const todayStart = new Date(new Date().toDateString()).getTime();
      const list = planWords.filter(w => {
          const p = progress[w.word];
          if (!p || p.errorCount === 0) return false;
          if (filter === 'today') {
              // Check if in todayMistakes list OR lastFailDate is today?
              // planState.todayMistakes is source of truth for "Added today".
              return planState.todayMistakes.includes(w.word);
          }
          if (filter === 'high-freq') {
              return p.errorCount >= 2;
          }
          return true; // all
      });
      
      // Sort
      if (filter === 'high-freq' || filter === 'all') {
          return list.sort((a, b) => (progress[b.word]?.errorCount || 0) - (progress[a.word]?.errorCount || 0));
      }
      return list;
  }, [planWords, progress, planState.todayMistakes]);

  return {
      plan,
      stats,
      savePlan,
      getTodayTask,
      fetchRawNewWords,
      recordLearnResult,
      getReviewTask,
      recordReviewResult,
      getMistakesList,
      allBooks,
      customBooks,
      progress // exposed for Leaderboard
  };
}
