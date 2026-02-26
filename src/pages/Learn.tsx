
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useVocabulary, type Word } from "@/hooks/useVocabulary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Volume2, ArrowRight, X, Check, SkipForward, ChevronLeft, Headphones } from "lucide-react";

export default function Learn() {
  const [location, setLocation] = useLocation();
  const { getReviewQueue, getNewWords, submitWordResult, planStats, todayState, addBonusWords } = useVocabulary();
  const [queue, setQueue] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [addedMore, setAddedMore] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  
  // Calculate batch
  useEffect(() => {
    // 1. Get Reviews (Priority)
    const reviews = getReviewQueue();
    
    // 2. Calculate remaining quota for "New Words" today
    const remainingForToday = Math.max(0, planStats.effectiveDailyQuota - todayState.learnedCount);
    
    // 3. Batch Logic: Default 10 max per session, unless reviews take up space?
    // User requirement: Default batch 10. If daily goal 23, split 10, 10, 3.
    // If we have 5 reviews, do we add 10 new words? Or fill up to 10 total?
    // Usually "Learning" implies new words primarily, reviews are extra or separate.
    // However, if we mix them:
    // Let's fetch up to 10 NEW words, capped by remaining daily quota.
    const BATCH_SIZE = 10;
    const fetchCount = Math.min(BATCH_SIZE, remainingForToday);
    
    const newWords = getNewWords(fetchCount); 
    
    const initialQueue = [...reviews, ...newWords];
    setQueue(initialQueue);
    
    if (initialQueue.length === 0) {
        setSessionComplete(true);
    }
  }, [addedMore]);

  const currentWord = queue[currentIndex];
  
  const playAudio = (text: string, url?: string) => {
    if (url && url !== '') {
        const audio = new Audio(url);
        audio.play().catch(() => playTTS(text));
    } else {
        playTTS(text);
    }
  };
  
  const playTTS = (text: string) => {
    const u = new SpeechSynthesisUtterance(text); 
    u.lang = 'en-US'; 
    u.rate = 0.8;
    window.speechSynthesis.speak(u);
  };

  useEffect(() => { 
    if (currentWord) { 
        playAudio(currentWord.word, currentWord.audioUrl); 
        setShowAnswer(false); 
    } 
  }, [currentWord]);

  const handleInteraction = (type: 'know' | 'dont-know' | 'skip') => {
    if (type === 'skip') { advance(); return; }
    submitWordResult(currentWord.word, type === 'know' ? 'good' : 'hard');
    setShowAnswer(true);
    // Auto-play example audio on reveal if it exists
    if (type === 'know' && currentWord.example) {
        // playAudio(currentWord.example, currentWord.exampleAudioUrl);
    }
  };
  
  const advance = () => {
    if (currentIndex < queue.length - 1) { 
        setCurrentIndex(prev => prev + 1); 
        setShowAnswer(false); 
    } else { 
        setSessionComplete(true); 
    }
  };

  if (sessionComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-background animate-in fade-in duration-500">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-4 border-primary text-center max-w-md w-full">
          <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto mb-6" />
          <h1 className="text-4xl font-black text-primary mb-2">Great Job!</h1><p className="text-lg font-bold text-primary/70 mb-1">太棒了！</p>
          <p className="text-muted-foreground mb-10 font-bold">You've finished your current session!<br/><span className="text-sm font-normal opacity-80">本轮学习已完成！</span></p>
          <div className="space-y-4">
            <Button className="w-full h-16 text-xl font-black rounded-2xl bg-secondary hover:bg-secondary/90 shadow-lg shadow-blue-100 flex flex-col items-center justify-center leading-none" onClick={() => {
                addBonusWords(10); // Standard batch size
                setAddedMore(true); // Triggers useEffect to fetch next batch
                setSessionComplete(false); 
                setCurrentIndex(0);
            }}>
                <span>Continue / Append</span>
                <span className="text-[10px] opacity-70">继续学习 (追加10个)</span>
            </Button>
            <Button variant="outline" className="w-full h-16 text-xl font-bold rounded-2xl border-2 flex flex-col items-center justify-center leading-none" onClick={() => setLocation('/')}>
                <span>Finish Today</span>
                <span className="text-[10px] opacity-50">结束今日学习</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentWord) return <div className="min-h-screen flex items-center justify-center font-black animate-pulse">Checking words... / 正在加载...</div>;
  
  const progressPercent = queue.length > 0 ? ((currentIndex) / queue.length) * 100 : 100;

  return (
    <div className="min-h-screen flex flex-col p-4 bg-background max-w-md mx-auto relative overflow-hidden">
      <div className="flex items-center justify-between mb-4 pt-4 px-2">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/')}><ChevronLeft /></Button>
        <div className="text-[10px] font-black text-muted-foreground bg-white px-4 py-1 rounded-full shadow-sm border uppercase tracking-widest">
            SESSION: {currentIndex + 1} / {queue.length} (进度)
        </div>
        <div className="w-10" />
      </div>
      <Progress value={progressPercent} className="h-2 rounded-full mb-8 bg-secondary/10 mx-2" />

      <div className="flex-1 flex flex-col items-center justify-center mb-10">
        <Card className="w-full aspect-[3/4] flex flex-col items-center justify-center p-10 shadow-2xl border-none relative bg-white rounded-[3rem] overflow-hidden">
          <div className="absolute top-8 left-8 text-[10px] font-black text-primary/30 uppercase tracking-tighter max-w-[150px] truncate">
            {currentWord.level}
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <h2 className="text-6xl font-black text-primary mb-2 text-center tracking-tight break-words max-w-full leading-none">{currentWord.word}</h2>
            {currentWord.phonetic && <div className="text-lg text-muted-foreground font-mono mb-6 bg-gray-50 px-3 py-1 rounded-full">{currentWord.phonetic}</div>}
            
            <Button variant="ghost" size="icon" className="rounded-full w-14 h-14 mb-8 text-primary bg-primary/5 hover:bg-primary/10 transition-colors" onClick={() => playAudio(currentWord.word, currentWord.audioUrl)}>
              <Volume2 className="w-8 h-8" />
            </Button>

            {showAnswer && (
              <div className="animate-in fade-in slide-in-from-bottom-6 duration-500 text-center w-full space-y-6">
                <div className="bg-sky-50 p-6 rounded-[2rem] border-2 border-sky-100 shadow-inner">
                    <p className="text-xl text-secondary font-black mb-1 opacity-50 uppercase text-[10px] tracking-widest">{currentWord.pos || 'unknown'}</p>
                    <p className="text-3xl text-foreground font-black leading-tight">{currentWord.meaning || 'Think again!'}</p>
                </div>
                
                {/* Example Sentence Section - Always Visible if Available */}
                {currentWord.example && (
                    <div className="w-full flex flex-col gap-2">
                        <div className="flex items-start gap-3 text-left bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 shrink-0 rounded-full bg-primary/10 text-primary mt-1"
                                onClick={(e) => { e.stopPropagation(); playAudio(currentWord.example!, currentWord.exampleAudioUrl); }}
                            >
                                <Volume2 className="w-4 h-4" />
                            </Button>
                            <div className="flex-1">
                                <p className="text-sm text-gray-700 font-medium leading-relaxed">"{currentWord.example}"</p>
                                <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase tracking-wider">Example / 例句</p>
                            </div>
                        </div>
                    </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="w-full pb-8 px-2">
        {!showAnswer ? (
          <div className="grid grid-cols-3 gap-4">
            <Button variant="outline" className="h-20 flex flex-col gap-0 rounded-3xl border-2 border-gray-100 text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-all active:scale-95" onClick={() => handleInteraction('skip')}>
              <SkipForward className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-black uppercase leading-none">Skip</span>
              <span className="text-[9px] font-medium leading-none mt-0.5">跳过</span>
            </Button>
            <Button className="h-20 flex flex-col gap-0 rounded-3xl bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-100 transition-all active:scale-95" onClick={() => handleInteraction('dont-know')}>
              <X className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-black uppercase leading-none">Forgot</span>
              <span className="text-[9px] font-medium leading-none mt-0.5">不认识</span>
            </Button>
            <Button className="h-20 flex flex-col gap-0 rounded-3xl bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-100 transition-all active:scale-95" onClick={() => handleInteraction('know')}>
              <Check className="w-6 h-6 mb-1" />
              <span className="text-[10px] font-black uppercase leading-none">Know</span>
              <span className="text-[9px] font-medium leading-none mt-0.5">认识</span>
            </Button>
          </div>
        ) : (
          <Button className="w-full h-20 text-2xl font-black rounded-[2rem] bg-primary hover:bg-primary/90 text-primary-foreground border-b-8 border-yellow-600 shadow-xl active:border-b-0 active:translate-y-2 transition-all flex flex-col items-center justify-center leading-none" onClick={advance}>
            <div className="flex items-center gap-2">
                <span>NEXT WORD</span>
                <ArrowRight className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium opacity-80 mt-1">下一个</span>
          </Button>
        )}
      </div>
    </div>
  );
}
