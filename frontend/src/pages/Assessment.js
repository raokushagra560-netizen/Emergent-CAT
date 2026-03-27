import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ArrowRight, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';

export default function Assessment() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('genres');
  const [currentRound, setCurrentRound] = useState(1);
  const [genres, setGenres] = useState([]);
  const [selectedGenres, setSelectedGenres] = useState({ strongest: '', intermediate: '', weakest: '' });
  const [assessmentId, setAssessmentId] = useState('');
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(false);
  const [readingStartTime, setReadingStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [timerVisible, setTimerVisible] = useState(true);
  const [answers, setAnswers] = useState({ what: '', why: '', structure: '' });
  const [answerStartTime, setAnswerStartTime] = useState(0);
  const [evaluation, setEvaluation] = useState(null);
  const [roundEvals, setRoundEvals] = useState([]);
  const [overallScore, setOverallScore] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    api.get('/config/genres').then(res => setGenres(res.data.genres)).catch(() => {});
  }, []);

  useEffect(() => {
    if (phase === 'reading' && readingStartTime > 0) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - readingStartTime) / 1000));
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase, readingStartTime]);

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const generateRound = async (aid, round) => {
    setLoading(true);
    try {
      const res = await api.post('/assessment/generate-round', { assessment_id: aid, round_number: round });
      setArticle(res.data.article);
      setPhase('reading');
      setReadingStartTime(Date.now());
      setElapsed(0);
    } catch {
      toast.error('Failed to generate article. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startAssessment = async () => {
    const { strongest, intermediate, weakest } = selectedGenres;
    if (!strongest || !intermediate || !weakest) {
      toast.error('Please select all three genres');
      return;
    }
    if (new Set([strongest, intermediate, weakest]).size < 3) {
      toast.error('Please select three different genres');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/assessment/start', {
        strongest_genre: strongest, intermediate_genre: intermediate, weakest_genre: weakest
      });
      setAssessmentId(res.data.assessment_id);
      await generateRound(res.data.assessment_id, 1);
    } catch {
      toast.error('Failed to start assessment');
      setLoading(false);
    }
  };

  const finishReading = () => {
    clearInterval(timerRef.current);
    setPhase('answering');
    setAnswerStartTime(Date.now());
    setAnswers({ what: '', why: '', structure: '' });
  };

  const submitAnswers = async () => {
    setLoading(true);
    try {
      const res = await api.post('/assessment/submit-round', {
        assessment_id: assessmentId, round_number: currentRound,
        reading_time_seconds: elapsed,
        answer_time_seconds: Math.floor((Date.now() - answerStartTime) / 1000),
        user_what: answers.what, user_why: answers.why, user_structure: answers.structure
      });
      setEvaluation(res.data.evaluation);
      setRoundEvals(prev => [...prev, { round: currentRound, eval: res.data.evaluation }]);
      if (res.data.is_final_round) {
        setOverallScore(res.data.overall_score);
        setPhase('final');
      } else {
        setPhase('result');
      }
    } catch {
      toast.error('Failed to evaluate answers');
    } finally {
      setLoading(false);
    }
  };

  const nextRound = () => {
    const next = currentRound + 1;
    setCurrentRound(next);
    setEvaluation(null);
    setArticle(null);
    generateRound(assessmentId, next);
  };

  const roundLabel = currentRound === 1 ? 'Strongest Genre' : currentRound === 2 ? 'Intermediate Genre' : 'Weakest Genre';
  const progressValue = phase === 'genres' ? 0 : ((currentRound - 1) * 33.3 + (phase === 'result' || phase === 'final' ? 33.3 : phase === 'answering' ? 22 : 11));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-12">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs uppercase tracking-[0.2em] font-mono text-muted-foreground">Assessment</span>
            {phase !== 'genres' && (
              <Badge variant="secondary" className="rounded-sm text-xs">Round {currentRound}/3</Badge>
            )}
          </div>
          <Progress value={progressValue} className="h-1" />
        </div>

        {/* Genre Selection */}
        {phase === 'genres' && (
          <div data-testid="genre-selection">
            <h1 className="text-3xl md:text-4xl tracking-tight font-medium font-serif mb-4">Reading Assessment</h1>
            <p className="text-base text-muted-foreground mb-8 max-w-lg">
              Select three genres to assess your reading comprehension. You'll read one article per genre and answer questions about it.
            </p>
            <div className="space-y-6">
              {[
                { key: 'strongest', label: 'Strongest Genre', desc: 'A topic you read frequently and feel most confident about' },
                { key: 'intermediate', label: 'Intermediate Genre', desc: 'A topic you have moderate familiarity with' },
                { key: 'weakest', label: 'Weakest Genre', desc: 'A topic you rarely read or find challenging' },
              ].map(({ key, label, desc }) => (
                <div key={key}>
                  <label className="text-sm font-medium font-sans block mb-1">{label}</label>
                  <p className="text-xs text-muted-foreground mb-2">{desc}</p>
                  <Select value={selectedGenres[key]} onValueChange={v => setSelectedGenres(prev => ({ ...prev, [key]: v }))}>
                    <SelectTrigger className="rounded-sm" data-testid={`genre-select-${key}`}>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.filter(g => {
                        const used = Object.entries(selectedGenres).filter(([k]) => k !== key).map(([, v]) => v);
                        return !used.includes(g);
                      }).map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Button onClick={startAssessment} disabled={loading} data-testid="begin-assessment-btn"
              className="mt-8 rounded-sm bg-[#002FA7] hover:bg-[#002482] text-white px-8">
              {loading ? <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Preparing...</> : <>Begin Assessment <ArrowRight className="ml-2 w-4 h-4" /></>}
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && phase !== 'genres' && (
          <div className="flex flex-col items-center justify-center py-20" data-testid="loading-indicator">
            <Loader2 className="w-8 h-8 animate-spin text-[#002FA7] mb-4" />
            <p className="text-sm text-muted-foreground font-mono">Generating article for {roundLabel}...</p>
          </div>
        )}

        {/* Reading */}
        {phase === 'reading' && !loading && article && (
          <div data-testid="reading-phase">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold font-sans">Round {currentRound}: {roundLabel}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setTimerVisible(!timerVisible)} data-testid="timer-toggle"
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                  {timerVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                {timerVisible && (
                  <span className={`font-mono text-lg tabular-nums px-3 py-1 rounded-sm border
                    ${elapsed > 300 ? 'text-red-500 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950' : 'bg-zinc-100 dark:bg-zinc-800'}`}
                    data-testid="timer-display">
                    {formatTime(elapsed)}
                  </span>
                )}
              </div>
            </div>
            <Card className="rounded-sm border-zinc-200 dark:border-zinc-800">
              <CardContent className="p-8 md:p-12">
                <h3 className="text-2xl md:text-3xl font-medium font-serif mb-6 tracking-tight">{article.title}</h3>
                {article.content.split('\n\n').map((para, i) => (
                  <p key={i} className="text-lg leading-loose text-zinc-800 dark:text-zinc-200 font-serif mb-4">{para}</p>
                ))}
              </CardContent>
            </Card>
            <div className="mt-6 flex justify-end">
              <Button onClick={finishReading} data-testid="finished-reading-btn" size="lg"
                className="rounded-sm bg-[#002FA7] hover:bg-[#002482] text-white px-8">
                I've Read It <CheckCircle className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Answering */}
        {phase === 'answering' && (
          <div data-testid="answering-phase">
            <h2 className="text-xl font-semibold font-sans mb-2">Answer These Questions</h2>
            <p className="text-sm text-muted-foreground mb-6">Based on what you just read:</p>
            <div className="space-y-6">
              {[
                { key: 'what', label: 'What is the passage about?', placeholder: 'Summarize the main topic and content...' },
                { key: 'why', label: 'Why has the author written it?', placeholder: "What is the author's purpose..." },
                { key: 'structure', label: 'What is the structure of the passage?', placeholder: 'Describe paragraph-by-paragraph...' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium font-sans block mb-2">{label}</label>
                  <Textarea value={answers[key]} onChange={e => setAnswers(prev => ({ ...prev, [key]: e.target.value }))}
                    placeholder={placeholder} className="rounded-sm min-h-[100px]" data-testid={`answer-${key}`} />
                </div>
              ))}
            </div>
            <Button onClick={submitAnswers} disabled={loading || (!answers.what && !answers.why && !answers.structure)}
              data-testid="submit-answers-btn" className="mt-6 rounded-sm bg-[#002FA7] hover:bg-[#002482] text-white px-8">
              {loading ? <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Evaluating...</> : 'Submit Answers'}
            </Button>
          </div>
        )}

        {/* Round Result */}
        {phase === 'result' && evaluation && (
          <div data-testid="result-phase">
            <h2 className="text-xl font-semibold font-sans mb-6">Round {currentRound} Results</h2>
            <Card className="rounded-sm border-zinc-200 dark:border-zinc-800 mb-6">
              <CardContent className="p-6">
                <div className="text-center mb-6">
                  <p className="text-5xl font-serif font-medium text-[#002FA7]" data-testid="round-score">{evaluation.total_score}</p>
                  <p className="text-sm text-muted-foreground mt-1">out of 100</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Reading Speed', score: evaluation.reading_speed_score, max: 30 },
                    { label: 'What', score: evaluation.what_score, max: 25 },
                    { label: 'Why', score: evaluation.why_score, max: 25 },
                    { label: 'Structure', score: evaluation.structure_score, max: 20 },
                  ].map(({ label, score, max }) => (
                    <div key={label} className="text-center">
                      <p className="text-2xl font-mono font-medium">{score}<span className="text-sm text-muted-foreground">/{max}</span></p>
                      <p className="text-xs text-muted-foreground mt-1">{label}</p>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <p className="text-sm text-muted-foreground">{evaluation.overall_feedback}</p>
              </CardContent>
            </Card>
            <Button onClick={nextRound} data-testid="next-round-btn"
              className="rounded-sm bg-[#002FA7] hover:bg-[#002482] text-white px-8">
              Next Round <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Final Results */}
        {phase === 'final' && (
          <div data-testid="final-results">
            <h1 className="text-3xl md:text-4xl tracking-tight font-medium font-serif mb-6">Assessment Complete</h1>
            <Card className="rounded-sm border-zinc-200 dark:border-zinc-800 mb-6">
              <CardContent className="p-8 text-center">
                <p className="text-6xl font-serif font-medium text-[#002FA7]" data-testid="overall-score">
                  {Math.round(overallScore)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">Overall Score (out of 100)</p>
              </CardContent>
            </Card>
            <div className="space-y-3 mb-8">
              {roundEvals.map(({ round, eval: ev }) => (
                <Card key={round} className="rounded-sm border-zinc-200 dark:border-zinc-800">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold font-sans">
                        Round {round}: {round === 1 ? selectedGenres.strongest : round === 2 ? selectedGenres.intermediate : selectedGenres.weakest}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{ev.overall_feedback}</p>
                    </div>
                    <span className="text-xl font-mono font-medium shrink-0 ml-4">{ev.total_score}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button onClick={() => navigate('/dashboard')} data-testid="go-to-dashboard-btn"
              className="rounded-sm bg-[#002FA7] hover:bg-[#002482] text-white px-8">
              Go to Dashboard <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
