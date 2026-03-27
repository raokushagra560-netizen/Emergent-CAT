import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Target, BookMarked, ArrowRight, TrendingUp, Brain } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(res => setStats(res.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted rounded-sm" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-[0.2em] font-mono text-zinc-500 mb-2">Dashboard</p>
          <h1 className="text-3xl md:text-4xl tracking-tight font-medium font-serif" data-testid="dashboard-title">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
        </div>

        {/* Assessment CTA */}
        {!stats?.assessment_completed && (
          <Card className="mb-8 border-[#002FA7]/20 bg-[#002FA7]/5 dark:bg-[#002FA7]/10 rounded-sm" data-testid="assessment-cta">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 gap-4">
              <div>
                <h3 className="text-lg font-semibold font-sans">Take Your Reading Assessment</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete a 3-round diagnostic to calibrate your personalized reading level.
                </p>
              </div>
              <Button onClick={() => navigate('/assessment')} data-testid="start-assessment-btn"
                className="rounded-sm bg-[#002FA7] hover:bg-[#002482] text-white shrink-0">
                Start Assessment <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10">
          {[
            { icon: Target, label: 'Avg Score', value: stats?.average_score || 0, sub: 'out of 100', tid: 'stat-score' },
            { icon: BookOpen, label: 'Sessions', value: stats?.completed_sessions || 0, sub: 'completed', tid: 'stat-sessions' },
            { icon: TrendingUp, label: 'Level', value: stats?.difficulty_level || 3, sub: 'of 5', tid: 'stat-difficulty' },
            { icon: BookMarked, label: 'Vocabulary', value: stats?.vocabulary_count || 0, sub: 'words saved', tid: 'stat-vocab' },
          ].map(({ icon: Icon, label, value, sub, tid }) => (
            <Card key={tid} className="rounded-sm border-zinc-200 dark:border-zinc-800" data-testid={tid}>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-4 h-4 text-[#002FA7]" />
                  <span className="text-xs uppercase tracking-[0.15em] font-mono text-muted-foreground">{label}</span>
                </div>
                <p className="text-3xl font-serif font-medium">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-10">
          <Card className="rounded-sm border-zinc-200 dark:border-zinc-800 hover:border-[#002FA7]/30 transition-colors cursor-pointer"
            onClick={() => navigate('/read')} data-testid="quick-read-btn">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-sm bg-[#002FA7]/10 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-[#002FA7]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold font-sans text-sm">Start Reading</h3>
                <p className="text-xs text-muted-foreground">Generate a new article to practice</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
          <Card className="rounded-sm border-zinc-200 dark:border-zinc-800 hover:border-[#002FA7]/30 transition-colors cursor-pointer"
            onClick={() => navigate('/vocabulary')} data-testid="quick-vocab-btn">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-sm bg-[#002FA7]/10 flex items-center justify-center shrink-0">
                <Brain className="w-5 h-5 text-[#002FA7]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold font-sans text-sm">Review Vocabulary</h3>
                <p className="text-xs text-muted-foreground">Practice with your saved flashcards</p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        </div>

        {/* Genre Performance */}
        {stats?.genre_stats && Object.keys(stats.genre_stats).length > 0 && (
          <Card className="rounded-sm border-zinc-200 dark:border-zinc-800 mb-10" data-testid="genre-performance">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-sans">Genre Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats.genre_stats).map(([genre, data]) => (
                  <div key={genre} className="flex items-center gap-4">
                    <span className="text-sm font-sans w-40 truncate shrink-0">{genre}</span>
                    <Progress value={data.avg_score} className="flex-1 h-2" />
                    <span className="text-sm font-mono w-14 text-right shrink-0">{data.avg_score}/100</span>
                    <Badge variant="secondary" className="rounded-sm text-xs shrink-0">{data.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Sessions */}
        {stats?.recent_sessions?.length > 0 && (
          <Card className="rounded-sm border-zinc-200 dark:border-zinc-800" data-testid="recent-sessions">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-sans">Recent Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.recent_sessions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-sans font-medium truncate">{s.article?.title || 'Untitled'}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {s.settings?.genre} · {new Date(s.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {s.evaluation && <span className="text-sm font-mono font-medium">{s.evaluation.total_score}/100</span>}
                      <Badge variant={s.status === 'completed' ? 'default' : 'secondary'} className="rounded-sm text-xs capitalize">
                        {s.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
