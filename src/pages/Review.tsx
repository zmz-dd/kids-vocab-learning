
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useVocabulary, type Word } from "@/hooks/useVocabulary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ChevronLeft, Volume2, X, Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Review() {
  const [location, setLocation] = useLocation();
  const { getReviewTask, recordReviewResult } = useVocabulary();
  
  const [mode, setMode] = useState<'scientific' | 'today'>('today');
  
  const [queue, setQueue] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<'reveal' | 'feedback'>('reveal');
  const [sessionComplete, setSessionComplete] = useState(false);

  // Load queue based on mode
  useEffect(() => {
    const q = getReviewTask(mode);
    setQueue(q);
    setCurrentIndex(0);
    setSessionComplete(q.length === 0);
    setStep('reveal');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const currentWord = queue[currentIndex];

  const playTTS = (text: string) => {
    const u = new SpeechSynthesisUtterance(text); 
    u.lang = 'en-US'; u.rate = 0.8;
    window.speechSynthesis.speak(u);
  };
  
  const playAudio = (text: string, url?: string) => {
    if (url && url !== '') {
        const audio = new Audio(url);
        audio.play().catch(() => playTTS(text));
    } else {
        playTTS(text);
    }
  };

  // Auto-play audio on mount/change
  useEffect(() => {
      if (currentWord) {
          playAudio(currentWord.word, currentWord.audioUrl);
          setStep('reveal');
      }
  }, [currentWord]);

  const handleReveal = () => {
      setStep('feedback');
  };

  const handleFeedback = (type: 'know' | 'dont-know') => {
    recordReviewResult(currentWord.word, type, mode);
    // Auto advance
    if (currentIndex < queue.length - 1) {
        setCurrentIndex(p => p + 1);
        setStep('reveal');
    } else {
        setSessionComplete(true);
    }
  };

  if (sessionComplete) {
      return (
        <div className="min-h-screen p-6 flex flex-col items-center justify-center max-w-md mx-auto bg-background text-center">
            <CheckCircle2 className="w-20 h-20 text-green-500 mb-4" />
            <h1 className="text-3xl font-black text-primary mb-2">Review Complete!</h1>
            <p className="text-muted-foreground mb-8">You've reviewed all words for this session.<br/><span className="text-sm">本轮复习完成！</span></p>
            <Button className="w-full h-14 text-xl font-bold rounded-2xl" onClick={() => setLocation('/')}>Back Home</Button>
        </div>
      );
  }
  
  if (!currentWord) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const progressPercent = ((currentIndex) / queue.length) * 100;

  return (
    <div className="min-h-screen p-4 flex flex-col max-w-md mx-auto bg-background">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/')}><ChevronLeft /></Button>
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-[200px]">
            <TabsList className="grid w-full grid-cols-2 h-8">
                <TabsTrigger value="today" className="text-xs">Today</TabsTrigger>
                <TabsTrigger value="scientific" className="text-xs">Scientific</TabsTrigger>
            </TabsList>
        </Tabs>
        <div className="w-10" />
      </div>

      <div className="text-center mb-2">
         <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            {mode === 'today' ? 'IMMEDIATE REVIEW / 立即复习' : 'EBBINGHAUS REVIEW / 科学复习'}
         </span>
      </div>
      
      <Progress value={progressPercent} className="h-2 rounded-full mb-6 bg-secondary/10" />

      <div className="flex-1 flex flex-col items-center justify-center mb-8">
        <Card className="w-full aspect-[3/4] flex flex-col items-center justify-center p-8 shadow-xl border-none relative bg-white rounded-[2.5rem]">
            <h2 className="text-5xl font-black text-primary mb-4 text-center leading-none">{currentWord.word}</h2>
            
            {/* Phonetic on Front now */}
            {currentWord.phonetic && <div className="text-lg text-muted-foreground font-mono mb-6 bg-gray-50 px-3 py-1 rounded-full">{currentWord.phonetic}</div>}

            <Button variant="ghost" size="icon" className="rounded-full w-12 h-12 mb-6 text-primary bg-primary/5" onClick={() => playAudio(currentWord.word, currentWord.audioUrl)}>
              <Volume2 className="w-6 h-6" />
            </Button>
            
            {step === 'feedback' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 text-center w-full space-y-4">
                    <div className="bg-sky-50 p-4 rounded-2xl border border-sky-100">
                        <p className="text-lg text-secondary font-black mb-1 opacity-50 uppercase text-[10px]">{currentWord.pos || 'unknown'}</p>
                        <p className="text-2xl text-foreground font-black">{currentWord.meaning}</p>
                    </div>
                </div>
            )}
        </Card>
      </div>
      
      <div className="w-full pb-8">
        {step === 'reveal' ? (
             <Button className="w-full h-16 rounded-2xl bg-primary text-primary-foreground font-black text-xl shadow-xl" onClick={handleReveal}>
                View Meaning / 查看释义
            </Button>
        ) : (
            <div className="grid grid-cols-2 gap-4">
                <Button className="h-16 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-lg shadow-lg shadow-red-100" onClick={() => handleFeedback('dont-know')}>
                    <X className="mr-2 w-5 h-5" /> Forgot / 不认识
                </Button>
                <Button className="h-16 rounded-2xl bg-green-500 hover:bg-green-600 text-white font-bold text-lg shadow-lg shadow-green-100" onClick={() => handleFeedback('know')}>
                    <Check className="mr-2 w-5 h-5" /> Know / 认识
                </Button>
            </div>
        )}
      </div>
    </div>
  );
}
