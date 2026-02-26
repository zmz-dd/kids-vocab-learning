
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useVocabulary } from "@/hooks/useVocabulary";
import { useAuth } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Settings as SettingsIcon, BookOpen, Trophy, BarChart3, Play, XCircle, LogOut, Crown, BookPlus, PlusCircle, AlertTriangle, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import mascot from "@/assets/mascot.png";
import { toast } from "sonner";

// Import avatars
import red from "@/assets/avatars/red.png";
import yellow from "@/assets/avatars/yellow.png";
import blue from "@/assets/avatars/blue.png";
import black from "@/assets/avatars/black.png";
import green from "@/assets/avatars/green.png";
import white from "@/assets/avatars/white.png";

const AVATAR_MAP: Record<string, string> = { red, yellow, blue, black, green, white };

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { 
    stats, 
    settings, 
    setSettings, 
    getReviewQueue,
    allBooks,
    planStats,
    addBonusWords,
    resetTodayProgress,
    todayState
  } = useVocabulary();

  const [reviewCount, setReviewCount] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingSettings, setPendingSettings] = useState(settings);

  useEffect(() => {
    if (!user) {
      setLocation("/login");
      return;
    }
    setReviewCount(getReviewQueue().length);
  }, [user, settings.selectedBooks]);

  if (!user) return null;

  const handleSettingsSave = () => {
      // Check if critical plan details changed
      const hasChanged = JSON.stringify(pendingSettings) !== JSON.stringify(settings);
      if (hasChanged) {
          setIsConfirmOpen(true);
      } else {
          setIsSettingsOpen(false);
      }
  };

  const confirmSettings = () => {
      setSettings(pendingSettings);
      resetTodayProgress(); // Important: Reset daily progress for the new plan
      setIsConfirmOpen(false);
      setIsSettingsOpen(false);
      toast.success("Learning plan updated! Daily task reset.");
  };

  const handleAddMore = () => {
      if (planStats.remaining <= 0) {
          return toast.error("No more words in the selected books!");
      }
      const addCount = 10;
      if (confirm(`You've finished today's task. Learn ${addCount} more words?`)) {
          addBonusWords(addCount);
          toast.success(`Added ${addCount} words to today's goal!`);
          setLocation('/learn');
      }
  };

  const userAvatar = user.avatarId && AVATAR_MAP[user.avatarId] ? AVATAR_MAP[user.avatarId] : null;
  const isGoalReached = planStats.learned >= planStats.effectiveDailyQuota;

  return (
    <div className="min-h-screen bg-background p-6 flex flex-col max-w-md mx-auto relative overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 z-10">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-md border-2 border-white overflow-hidden bg-white"
            style={!userAvatar ? { backgroundColor: user.avatarColor } : {}}
          >
            {userAvatar ? (
                <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
                user.username[0].toUpperCase()
            )}
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-foreground">Hi, {user.username}!</h1>
            <p className="text-xs text-muted-foreground font-medium cursor-pointer hover:underline" onClick={logout}>
              Log out <span className="text-[10px] opacity-70">退出登录</span>
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
            {!user.isAdmin && (
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setLocation('/leaderboard')}>
                    <Crown className="w-6 h-6 text-yellow-500 fill-current" />
                </Button>
            )}
            
            {user.isAdmin && (
                <Button variant="outline" size="sm" className="rounded-full bg-primary/10 text-primary border-primary/20 shadow-sm" onClick={() => setLocation('/vocab')}>
                    <BookPlus className="w-4 h-4 mr-1" /> Admin
                </Button>
            )}
            
            <Dialog open={isSettingsOpen} onOpenChange={(open) => { if (open) setPendingSettings(settings); setIsSettingsOpen(open); }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-full shadow-sm">
                  <SettingsIcon className="w-5 h-5 text-muted-foreground" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black">Plan Settings</DialogTitle>
                  <DialogDescription>Customize your learning journey / 学习计划设置</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                        <Label className="text-base font-black">1. Choose Books</Label>
                        <span className="text-xs text-muted-foreground">选择词书</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                        {allBooks.map(b => (
                            <div key={b.id} className="flex items-center space-x-2 bg-white p-2 rounded-xl border">
                                <Checkbox 
                                    id={`book-${b.id}`}
                                    checked={pendingSettings.selectedBooks.includes(b.id)}
                                    onCheckedChange={(checked) => {
                                        setPendingSettings(prev => ({
                                            ...prev,
                                            selectedBooks: checked 
                                                ? [...prev.selectedBooks, b.id]
                                                : prev.selectedBooks.filter(id => id !== b.id)
                                        }));
                                    }}
                                />
                                <label htmlFor={`book-${b.id}`} className="text-sm font-bold flex-1 truncate cursor-pointer">
                                    {b.title}
                                </label>
                                <span className="text-[10px] text-muted-foreground">{b.words.length} words</span>
                            </div>
                        ))}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                      <div className="flex items-baseline gap-2">
                        <Label className="text-base font-black">2. Learning Target</Label>
                        <span className="text-xs text-muted-foreground">学习目标</span>
                      </div>
                      <Tabs value={pendingSettings.planMode} onValueChange={(v) => setPendingSettings(prev => ({...prev, planMode: v as any}))}>
                          <TabsList className="grid w-full grid-cols-2 rounded-xl bg-gray-100 p-1">
                              <TabsTrigger value="count" className="rounded-lg text-xs font-bold">Daily Count<br/><span className="scale-90 font-normal">每日词数</span></TabsTrigger>
                              <TabsTrigger value="days" className="rounded-lg text-xs font-bold">Target Days<br/><span className="scale-90 font-normal">计划天数</span></TabsTrigger>
                          </TabsList>
                          <TabsContent value="count" className="pt-2">
                              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border">
                                  <span className="text-sm font-bold">Words Per Day</span>
                                  <Input 
                                      type="number" 
                                      value={pendingSettings.dailyNewLimit}
                                      onChange={(e) => setPendingSettings({...pendingSettings, dailyNewLimit: parseInt(e.target.value) || 5})}
                                      className="w-20 text-center font-black rounded-xl"
                                  />
                              </div>
                          </TabsContent>
                          <TabsContent value="days" className="pt-2">
                              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border">
                                  <span className="text-sm font-bold">Total Days</span>
                                  <Input 
                                      type="number" 
                                      value={pendingSettings.planDaysTarget || 30}
                                      onChange={(e) => setPendingSettings({...pendingSettings, planDaysTarget: parseInt(e.target.value) || 30})}
                                      className="w-20 text-center font-black rounded-xl"
                                  />
                              </div>
                          </TabsContent>
                      </Tabs>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                        <Label className="text-base font-black">3. Order</Label>
                        <span className="text-xs text-muted-foreground">学习顺序</span>
                    </div>
                    <Select 
                        value={pendingSettings.learnOrder || 'alpha'} 
                        onValueChange={(v) => setPendingSettings({...pendingSettings, learnOrder: v as any})}
                    >
                        <SelectTrigger className="h-12 rounded-xl font-bold bg-gray-50 border-none">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="alpha">Alphabetical / 字母顺序</SelectItem>
                            <SelectItem value="random">Random / 随机顺序</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="sm:justify-start">
                    <Button onClick={handleSettingsSave} className="w-full h-12 text-lg font-black rounded-2xl shadow-lg">Save Plan</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <DialogContent className="max-w-xs rounded-3xl">
              <div className="p-4 text-center space-y-4">
                  <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto">
                      <AlertTriangle className="w-10 h-10" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black leading-none">Update Plan?</h3>
                    <p className="text-sm font-bold text-muted-foreground opacity-80">确认更新计划？</p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                      Changing your plan will reset today's word list. Your overall progress and review history will be kept.
                      <br/><span className="text-xs opacity-70">更新计划将重置今日任务。您的总进度和复习记录会被保留。</span>
                  </p>
                  <div className="flex flex-col gap-2">
                      <Button onClick={confirmSettings} className="h-12 rounded-2xl font-black text-lg flex flex-col items-center justify-center leading-none">
                        <span>Yes, Update It!</span>
                        <span className="text-[10px] font-normal opacity-70">确认更新</span>
                      </Button>
                      <Button variant="ghost" onClick={() => setIsConfirmOpen(false)} className="rounded-2xl flex flex-col items-center justify-center leading-none text-muted-foreground">
                        <span>Cancel</span>
                        <span className="text-[10px] font-normal opacity-70">取消</span>
                      </Button>
                  </div>
              </div>
          </DialogContent>
      </Dialog>

      {/* Stats Hero */}
      <div className="flex-1 flex flex-col items-center justify-center -mt-4 mb-4 z-0">
        <div className="relative w-56 h-56 mb-6">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <img src={mascot} alt="Mascot" className="relative w-full h-full object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500" />
          
          <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
             <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary/10" />
             <circle 
                cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="2" 
                className="text-primary transition-all duration-1000"
                strokeDasharray="301.6"
                strokeDashoffset={301.6 * (1 - (planStats.learned / Math.max(1, planStats.total)))}
                strokeLinecap="round"
             />
          </svg>
        </div>
        
        <div className="grid grid-cols-2 gap-4 w-full mb-8">
          <Card className="p-4 bg-white/50 backdrop-blur border-none shadow-sm flex flex-col items-center rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-secondary/30">
                <div className="h-full bg-secondary" style={{width: `${(planStats.learnedSelected / (planStats.totalSelected || 1)) * 100}%`}}></div>
            </div>
            <div className="flex flex-col items-center justify-center h-full">
                <div className="text-3xl font-black text-secondary leading-none">{planStats.learnedSelected} <span className="text-xs text-muted-foreground font-medium">/ {planStats.totalSelected}</span></div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex flex-col items-center leading-none gap-0.5 mt-1">
                    <span>Total Progress</span><span>累计学习</span>
                </div>
                {planStats.totalDays > 0 && (
                    <div className="mt-2 text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold">
                        Day {planStats.currentDay} / {planStats.totalDays}
                    </div>
                )}
            </div>
          </Card>
          <Card className="p-4 bg-white/50 backdrop-blur border-none shadow-sm flex flex-col items-center rounded-3xl relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-accent/30">
                <div className="h-full bg-accent" style={{width: `${(planStats.effectiveDailyQuota > 0 ? (todayState.learnedCount / planStats.effectiveDailyQuota) * 100 : 0)}%`}}></div>
             </div>
             <div className="flex flex-col items-center justify-center h-full">
                <div className="flex items-baseline gap-1 leading-none">
                    <span className="text-3xl font-black text-accent">{todayState.learnedCount}</span>
                    <span className="text-sm font-bold text-muted-foreground">/ {planStats.effectiveDailyQuota}</span>
                </div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex flex-col items-center leading-none gap-0.5 mt-1">
                    <span>Today's Goal</span><span>今日目标</span>
                </div>
             </div>
          </Card>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-4 z-10 mb-8">
        {!isGoalReached ? (
            <Button 
                className="w-full h-20 text-2xl font-black rounded-3xl shadow-xl shadow-primary/30 flex items-center justify-between px-8 hover:scale-105 transition-transform"
                onClick={() => setLocation('/learn')}
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                        <Play className="w-8 h-8 fill-current ml-1" />
                    </div>
                    <div className="flex flex-col items-start leading-none gap-1">
                        <span>Start Learning</span>
                        <span className="text-sm font-medium opacity-80">开始学习</span>
                    </div>
                </div>
                {reviewCount > 0 && (
                    <span className="bg-destructive text-white text-[10px] px-2 py-1 rounded-full animate-bounce">
                        {reviewCount} reviews
                    </span>
                )}
            </Button>
        ) : (
            <Button 
                className="w-full h-20 text-2xl font-black rounded-3xl shadow-xl bg-secondary hover:bg-secondary/90 text-white flex items-center justify-between px-8 hover:scale-105 transition-transform"
                onClick={handleAddMore}
            >
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                        <PlusCircle className="w-8 h-8" />
                    </div>
                    <div className="flex flex-col items-start leading-none gap-1">
                        <span>Append Learning</span>
                        <span className="text-sm font-medium opacity-80">追加学习</span>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <div className="text-[10px] bg-white/20 px-2 py-1 rounded-full mb-0.5">Finished!</div>
                    <div className="text-[9px] opacity-80">目标达成</div>
                </div>
            </Button>
        )}

        <div className="grid grid-cols-4 gap-2">
          <Button variant="outline" className="h-16 rounded-2xl border-2 hover:bg-secondary/10 font-bold flex flex-col gap-0 shadow-sm px-0" onClick={() => setLocation('/test')}>
            <Trophy className="w-5 h-5 text-secondary mb-1" />
            <span className="text-[10px] leading-none">Quiz</span>
            <span className="text-[9px] text-muted-foreground leading-none mt-0.5">测试</span>
          </Button>
          <Button variant="outline" className="h-16 rounded-2xl border-2 hover:bg-green-100/50 font-bold flex flex-col gap-0 shadow-sm px-0" onClick={() => setLocation('/review')}>
            <History className="w-5 h-5 text-green-600 mb-1" />
            <span className="text-[10px] leading-none">Review</span>
            <span className="text-[9px] text-muted-foreground leading-none mt-0.5">复习</span>
          </Button>
          <Button variant="outline" className="h-16 rounded-2xl border-2 hover:bg-accent/10 font-bold flex flex-col gap-0 shadow-sm px-0" onClick={() => setLocation('/stats')}>
            <BarChart3 className="w-5 h-5 text-accent mb-1" />
            <span className="text-[10px] leading-none">Stats</span>
            <span className="text-[9px] text-muted-foreground leading-none mt-0.5">统计</span>
          </Button>
          <Button variant="outline" className="h-16 rounded-2xl border-2 hover:bg-destructive/10 font-bold flex flex-col gap-0 shadow-sm relative px-0" onClick={() => setLocation('/mistakes')}>
            <XCircle className="w-5 h-5 text-destructive mb-1" />
            <span className="text-[10px] leading-none">Errors</span>
            <span className="text-[9px] text-muted-foreground leading-none mt-0.5">错题</span>
            {stats.mistakeCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                {stats.mistakeCount}
              </span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
