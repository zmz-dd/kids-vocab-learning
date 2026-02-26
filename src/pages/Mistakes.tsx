
import { useState } from "react";
import { useLocation } from "wouter";
import { useVocabulary } from "@/hooks/useVocabulary";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Volume2, History, ChevronLeft, Headphones } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Mistakes() {
  const [, setLocation] = useLocation();
  const { getMistakes, progress } = useVocabulary();
  
  const [filter, setFilter] = useState<'all' | 'today' | 'learn' | 'test'>('all');
  const mistakes = getMistakes(filter);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);

  const current = mistakes[reviewIndex];
  
  const playTTS = (text: string) => {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.8;
    window.speechSynthesis.speak(u);
  };
  
  const playAudio = (text: string, url?: string) => {
    if (url) new Audio(url).play().catch(() => playTTS(text));
    else playTTS(text);
  };

  return (
    <div className="min-h-screen p-4 flex flex-col max-w-md mx-auto bg-red-50/30">
      <div className="flex justify-between items-center mb-4 pt-4 px-2">
        <Button variant="ghost" size="icon" onClick={() => setLocation('/')}><ChevronLeft /></Button>
        <h1 className="font-black text-destructive tracking-tight">Mistake Book</h1>
        <div className="w-10" />
      </div>
      
      <Tabs value={filter} onValueChange={(v) => { setFilter(v as any); setReviewIndex(0); setShowMeaning(false); }} className="w-full mb-6">
          <TabsList className="grid w-full grid-cols-4 h-12 bg-white/50 p-1 rounded-2xl">
              <TabsTrigger value="all" className="text-[10px] rounded-xl flex flex-col items-center leading-none gap-0.5"><span>All</span><span className="scale-75 opacity-70">全部</span></TabsTrigger>
              <TabsTrigger value="today" className="text-[10px] rounded-xl flex flex-col items-center leading-none gap-0.5"><span>Today</span><span className="scale-75 opacity-70">今日</span></TabsTrigger>
              <TabsTrigger value="learn" className="text-[10px] rounded-xl flex flex-col items-center leading-none gap-0.5"><span>Learn</span><span className="scale-75 opacity-70">学习</span></TabsTrigger>
              <TabsTrigger value="test" className="text-[10px] rounded-xl flex flex-col items-center leading-none gap-0.5"><span>Quiz</span><span className="scale-75 opacity-70">测试</span></TabsTrigger>
          </TabsList>
      </Tabs>

      {mistakes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-white/50 rounded-[3rem] border-2 border-dashed border-gray-200 mx-2">
            <CheckCircle2 className="w-20 h-20 text-green-400 mb-6" />
            <h2 className="text-2xl font-black text-gray-400">Perfect Score!</h2>
            <p className="text-muted-foreground font-medium">No mistakes found here.</p>
        </div>
      ) : (
        <>
          <div className="text-center text-[10px] font-black text-muted-foreground mb-4 uppercase tracking-widest bg-white/50 w-fit mx-auto px-4 py-1 rounded-full shadow-sm">
              REVIEW: {reviewIndex + 1} / {mistakes.length}
          </div>
          
          <div className="flex-1 flex flex-col justify-center items-center px-2">
            <Card className="w-full aspect-[3/4] flex flex-col items-center justify-center p-10 shadow-2xl border-none relative bg-white rounded-[3rem] overflow-hidden transition-all duration-300">
              <div className="absolute top-8 right-8 flex flex-col items-end gap-1">
                 <div className="bg-destructive text-white text-[10px] px-3 py-1 rounded-full font-black flex items-center gap-1 shadow-md">
                    <History className="w-3 h-3" /> Fails: {(progress[current.word]?.learnFailCount || 0) + (progress[current.word]?.testFailCount || 0)}
                 </div>
                 <div className="text-[9px] font-bold text-muted-foreground/40 uppercase mr-1">
                    L: {progress[current.word]?.learnFailCount} | Q: {progress[current.word]?.testFailCount}
                 </div>
              </div>
              
              <div className="flex-1 flex flex-col items-center justify-center w-full">
                <h2 className="text-5xl font-black text-primary mb-2 text-center tracking-tight">{current.word}</h2>
                <div className="text-sm font-mono text-muted-foreground mb-8 bg-gray-50 px-3 py-1 rounded-full">{current.phonetic}</div>
                
                <Button variant="ghost" size="icon" className="rounded-full w-14 h-14 bg-primary/5 text-primary mb-10" onClick={() => playAudio(current.word, current.audioUrl)}>
                  <Volume2 className="w-8 h-8" />
                </Button>

                {showMeaning ? (
                  <div className="animate-in fade-in zoom-in duration-500 text-center space-y-6 px-2 w-full">
                    <div className="bg-red-50/50 p-6 rounded-[2rem] border border-red-100 shadow-inner">
                        <p className="text-2xl text-foreground font-black">{current.meaning}</p>
                    </div>
                    {current.example && (
                        <div className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
                           <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 rounded-full bg-primary/10 text-primary mt-0.5" onClick={() => playAudio(current.example!, current.exampleAudioUrl)}>
                              <Volume2 className="w-3 h-3" />
                           </Button>
                           <div className="flex-1">
                               <p className="text-sm font-medium text-gray-800 leading-tight">"{current.example}"</p>
                               <p className="text-[9px] text-muted-foreground mt-1 font-bold uppercase">Example / 例句</p>
                           </div>
                        </div>
                    )}
                  </div>
                ) : (
                  <Button variant="outline" className="rounded-2xl border-2 border-primary/20 text-primary font-black px-10 h-14 hover:bg-primary/5 transition-all" onClick={() => setShowMeaning(true)}>
                    REVEAL ANSWER
                  </Button>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 mt-10 pb-6 px-2">
            <Button className="h-20 text-2xl font-black rounded-[2rem] bg-primary hover:bg-primary/90 shadow-xl shadow-yellow-100 text-primary-foreground border-b-8 border-yellow-600 active:border-b-0 active:translate-y-2 transition-all" onClick={() => { setShowMeaning(false); setReviewIndex((reviewIndex + 1) % mistakes.length); }}>
              NEXT MISTAKE
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
