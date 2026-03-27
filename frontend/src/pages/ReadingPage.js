import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { BookOpen, Eye, EyeOff, CheckCircle, SkipForward, Loader2, Shuffle, BookMarked, Lightbulb, ArrowRight } from 'lucide-react';

const WORD_LIMIT_LABELS = { 1: '~200', 2: '~500', 3: '~800', 4: '~1200', 5: '~2000' };

export default function ReadingPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState('settings');
  const [genres, setGenres] = useState([]);
  const [tones, setTones] = useState([]);
  const [structures, setStructures] = useState([]);
  const [settings, setSettings] = useState({
    genre: '', difficulty: user?.difficulty_level || 3, word_limit_level: 3,
    tone: 'Random', structure: 'random'
  });
  const [article, setArticle] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [readingStartTime, setReadingStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [timerVisible, setTimerVisible] = useState(true);
  const [answers, setAnswers] = useState({ what: '', why: '', structure: '' });
  const [evaluation, setEvaluation] = useState(null);
  const [correctAnswers, setCorrectAnswers] = useState(null);
  const [selectedWords, setSelectedWords] = useState([]);
  const [wordMeanings, setWordMeanings] = useState([]);
  const [vocabLoading, setVocabLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get('/config/genres'),
      api.get('/config/tones'),
      api.get('/config/structures'),
      api.get('/dashboard/settings').catch(() => ({ data: {} }))
    ]).then(([g, t, s, sets]) => {
      setGenres(g.data.genres);
      setTones(t.data.tones);
      setStructures(s.data.structures);
      if (sets.data?.preferred_genre && sets.data.preferred_genre !== 'Random') {
        setSettings(prev => ({ ...prev, genre: sets.data.preferred_genre, difficulty: sets.data.difficulty || prev.difficulty }));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (phase === 'reading' && readingStartTime > 0) {
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - readingStartTime) / 1000)), 1000);
      return () => clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [phase, readingStartTime]);

  const formatTime = (s) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const generateArticle = async () => {
    if (!settings.genre) { toast.error('Please select a genre'); return; }
    setLoading(true);
    setPhase('loading');
    try {
      const res = await api.post('/reading/generate', settings);
      setArticle(res.data.article);
      setSessionId(res.data.session_id);
      setPhase('reading');
      setReadingStartTime(Date.now());
      setElapsed(0);
      setSelectedWords([]);
      setWordMeanings([]);
      setEvaluation(null);
      setCorrectAnswers(null);
    } catch {
      toast.error('Failed to generate article');
      setPhase('settings');
    } finally {
      setLoading(false);
    }
  };

  const finishReading = async () => {
    clearInterval(timerRef.current);
    try { await api.post('/reading/complete', { session_id: sessionId, reading_time_seconds: elapsed }); } catch {}
    setPhase('answering');
    setAnswers({ what: '', why: '', structure: '' });
  };

  const submitAnswers = async () => {
    setLoading(true);
    try {
      const res = await api.post('/reading/submit-answers', {
        session_id: sessionId, user_what: answers.what, user_why: answers.why, user_structure: answers.structure
      });
      setEvaluation(res.data.evaluation);
      setCorrectAnswers(res.data.correct_answers);
      setPhase('results');
    } catch { toast.error('Failed to evaluate'); }
    finally { setLoading(false); }
  };

  const skipAnswers = async () => {
    try {
      const res = await api.post('/reading/skip-answers', { session_id: sessionId });
      setCorrectAnswers(res.data.correct_answers);
      setPhase('results');
    } catch { toast.error('Failed to skip'); }
  };

  const toggleWord = (word) => {
    const clean = word.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
    if (!clean || clean.length < 2) return;
    setSelectedWords(prev => prev.includes(clean) ? prev.filter(w => w !== clean) : [...prev, clean]);
  };

  const revealMeanings = async () => {
    if (selectedWords.length === 0) { toast.error('Select some words first'); return; }
    setVocabLoading(true);
    try {
      const res = await api.post('/vocabulary/meanings', { words: selectedWords, article_content: article.content });
      setWordMeanings(res.data.words || []);
      setPhase('vocabulary');
    } catch { toast.error('Failed to fetch meanings'); }
    finally { setVocabLoading(false); }
  };

  const bookmarkWord = async (w) => {
    try {
      await api.post('/vocabulary/bookmark', w);
      toast.success(`"${w.word}" bookmarked`);
    } catch { toast.error('Failed to bookmark'); }
  };

  const resetForNewArticle = (keepSettings = true) => {
    if (!keepSettings) setPhase('settings');
    else generateArticle();
    setArticle(null);
    setSessionId('');
    setEvaluation(null);
    setCorrectAnswers(null);
    setSelectedWords([]);
    setWordMeanings([]);
  };

  const renderArticleWords = () => {
    if (!article) return null;
    return article.content.split('\n\n').map((para, pi) => (
      <p key={pi} className="text-lg leading-loose font-serif mb-4 text-zinc-800 dark:text-zinc-200">
        {para.split(/(\s+)/).map((token, ti) => {
          const clean = token.replace(/[^a-zA-Z'-]/g, '').toLowerCase();
          const isSelected = selectedWords.includes(clean);
          const isDifficult = article.difficult_words?.some(dw => dw.toLowerCase() === clean);
          if (!clean || clean.length < 2) return <span key={ti}>{token}</span>;
          return (
            <span key={ti} onClick={() => toggleWord(token)}
              className={`cursor-pointer transition-colors rounded-sm px-0.5
                ${isSelected ? 'bg-[#002FA7]/20 text-[#002FA7] dark:text-blue-300 font-medium' : ''}
                ${isDifficult && !isSelected ? 'underline decoration-dotted decoration-zinc-400 underline-offset-4' : ''}
                hover:bg-[#002FA7]/10`}
              data-testid={`vocab-word-${clean}`}>{token}</span>
          );
        })}
      </p>
    ));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-12">

        {/* Settings */}
        {phase === 'settings' && (
          <div data-testid="reading-settings">
            <p className="text-xs uppercase tracking-[0.2em] font-mono text-zinc-500 mb-2">Practice</p>
            <h1 className="text-3xl md:text-4xl tracking-tight font-medium font-serif mb-8">Set Up Your Reading</h1>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-medium font-sans block mb-2">Genre</label>
                <div className="flex gap-2">
                  <Select value={settings.genre} onValueChange={v => setSettings(p => ({ ...p, genre: v }))}>
                    <SelectTrigger className="rounded-sm flex-1" data-testid="setting-genre">
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      {genres.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" className="rounded-sm shrink-0" data-testid="random-genre-btn"
                    onClick={() => setSettings(p => ({ ...p, genre: genres[Math.floor(Math.random() * genres.length)] }))}>
                    <Shuffle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium font-sans block mb-2">
                  Difficulty Level: <span className="font-mono text-[#002FA7]">{settings.difficulty}</span>/5
                </label>
                <Slider value={[settings.difficulty]} onValueChange={([v]) => setSettings(p => ({ ...p, difficulty: v }))}
                  min={1} max={5} step={1} className="py-2" data-testid="setting-difficulty" />
              </div>
              <div>
                <label className="text-sm font-medium font-sans block mb-2">
                  Word Limit: <span className="font-mono text-[#002FA7]">{WORD_LIMIT_LABELS[settings.word_limit_level]}</span> words
                </label>
                <Slider value={[settings.word_limit_level]} onValueChange={([v]) => setSettings(p => ({ ...p, word_limit_level: v }))}
                  min={1} max={5} step={1} className="py-2" data-testid="setting-word-limit" />
              </div>
              <div>
                <label className="text-sm font-medium font-sans block mb-2">Tone</label>
                <Select value={settings.tone} onValueChange={v => setSettings(p => ({ ...p, tone: v }))}>
                  <SelectTrigger className="rounded-sm" data-testid="setting-tone"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Random">Random</SelectItem>
                    {tones.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium font-sans block mb-2">Structure</label>
                <Select value={settings.structure} onValueChange={v => setSettings(p => ({ ...p, structure: v }))}>
                  <SelectTrigger className="rounded-sm" data-testid="setting-structure"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Random</SelectItem>
                    {structures.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={generateArticle} data-testid="generate-article-btn" size="lg"
              className="mt-8 rounded-sm bg-[#002FA7] hover:bg-[#002482] text-white px-8">
              Generate Article <BookOpen className="ml-2 w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Loading */}
        {phase === 'loading' && (
          <div className="flex flex-col items-center justify-center py-20" data-testid="reading-loading">
            <Loader2 className="w-8 h-8 animate-spin text-[#002FA7] mb-4" />
            <p className="text-sm text-muted-foreground font-mono">Generating your article...</p>
          </div>
        )}

        {/* Reading */}
        {phase === 'reading' && article && (
          <div data-testid="reading-interface">
            <div className="flex items-center justify-between mb-6">
              <Badge variant="secondary" className="rounded-sm text-xs font-mono">{article.genre} · Level {article.difficulty}/5</Badge>
              <div className="flex items-center gap-2">
                <button onClick={() => setTimerVisible(!timerVisible)} data-testid="timer-toggle"
                  className="p-1 text-muted-foreground hover:text-foreground"><Eye className={`w-4 h-4 ${!timerVisible ? 'hidden' : ''}`} /><EyeOff className={`w-4 h-4 ${timerVisible ? 'hidden' : ''}`} /></button>
                {timerVisible && (
                  <span className={`font-mono text-lg tabular-nums px-3 py-1 rounded-sm border
                    ${elapsed > 300 ? 'text-red-500 border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950' : 'bg-zinc-100 dark:bg-zinc-800'}`}
                    data-testid="timer-display">{formatTime(elapsed)}</span>
                )}
              </div>
            </div>
            <Card className="rounded-sm border-zinc-200 dark:border-zinc-800">
              <CardContent className="p-8 md:p-12">
                <h2 className="text-2xl md:text-3xl font-medium font-serif mb-8 tracking-tight">{article.title}</h2>
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
            <h2 className="text-xl font-semibold font-sans mb-2">Comprehension Check</h2>
            <p className="text-sm text-muted-foreground mb-6">Answer based on your reading. You can also skip this.</p>
            {[
              { key: 'what', label: 'What is the passage about?', ph: 'Summarize the main topic...' },
              { key: 'why', label: 'Why has the author written it?', ph: "Author's purpose..." },
              { key: 'structure', label: 'Structure of the passage?', ph: 'Paragraph-by-paragraph...' },
            ].map(({ key, label, ph }) => (
              <div key={key} className="mb-5">
                <label className="text-sm font-medium font-sans block mb-2">{label}</label>
                <Textarea value={answers[key]} onChange={e => setAnswers(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={ph} className="rounded-sm min-h-[80px]" data-testid={`answer-${key}`} />
              </div>
            ))}
            <div className="flex gap-3">
              <Button onClick={submitAnswers} disabled={loading} data-testid="submit-answers-btn"
                className="rounded-sm bg-[#002FA7] hover:bg-[#002482] text-white">
                {loading ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null} Submit
              </Button>
              <Button variant="outline" onClick={skipAnswers} data-testid="skip-answers-btn" className="rounded-sm">
                <SkipForward className="mr-2 w-4 h-4" /> Skip
              </Button>
            </div>
          </div>
        )}

        {/* Results */}
        {phase === 'results' && (
          <div data-testid="results-phase">
            <h2 className="text-xl font-semibold font-sans mb-6">Results</h2>
            {evaluation && (
              <Card className="rounded-sm border-zinc-200 dark:border-zinc-800 mb-6">
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <p className="text-5xl font-serif font-medium text-[#002FA7]" data-testid="reading-score">{evaluation.total_score}</p>
                    <p className="text-sm text-muted-foreground mt-1">out of 100</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {[
                      { l: 'Speed', s: evaluation.reading_speed_score, m: 30 },
                      { l: 'What', s: evaluation.what_score, m: 25 },
                      { l: 'Why', s: evaluation.why_score, m: 25 },
                      { l: 'Structure', s: evaluation.structure_score, m: 20 },
                    ].map(({ l, s, m }) => (
                      <div key={l} className="text-center">
                        <p className="text-2xl font-mono">{s}<span className="text-sm text-muted-foreground">/{m}</span></p>
                        <p className="text-xs text-muted-foreground">{l}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">{evaluation.overall_feedback}</p>
                </CardContent>
              </Card>
            )}
            {correctAnswers && (
              <Card className="rounded-sm border-zinc-200 dark:border-zinc-800 mb-6">
                <CardHeader className="pb-3"><CardTitle className="text-base font-sans">Correct Answers</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'What', val: correctAnswers.what },
                    { label: 'Why', val: correctAnswers.why },
                    { label: 'Structure', val: correctAnswers.structure },
                  ].map(({ label, val }, i) => (
                    <div key={label}>
                      {i > 0 && <Separator className="mb-3" />}
                      <p className="text-xs uppercase tracking-[0.15em] font-mono text-muted-foreground mb-1">{label}</p>
                      <p className="text-sm">{val}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Vocabulary Builder */}
            {article && (
              <Card className="rounded-sm border-zinc-200 dark:border-zinc-800 mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-sans flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-[#002FA7]" /> Vocabulary Builder
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">Click on words below to select them. Dotted underlines indicate difficult words.</p>
                  <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-sm border mb-4 max-h-72 overflow-y-auto">
                    {renderArticleWords()}
                  </div>
                  {selectedWords.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mb-4">
                      <span className="text-xs text-muted-foreground">Selected:</span>
                      {selectedWords.map(w => (
                        <Badge key={w} variant="secondary" className="rounded-sm text-xs cursor-pointer"
                          onClick={() => toggleWord(w)} data-testid={`selected-word-${w}`}>{w} x</Badge>
                      ))}
                    </div>
                  )}
                  <Button onClick={revealMeanings} disabled={vocabLoading || selectedWords.length === 0}
                    data-testid="reveal-meanings-btn" className="rounded-sm bg-[#002FA7] hover:bg-[#002482] text-white">
                    {vocabLoading ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null} Reveal Meanings
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-3">
              <Button onClick={() => resetForNewArticle(true)} data-testid="continue-same-btn"
                className="rounded-sm bg-[#002FA7] hover:bg-[#002482] text-white">
                Continue Reading <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={() => { setPhase('settings'); setArticle(null); }} data-testid="change-settings-btn" className="rounded-sm">
                Change Settings
              </Button>
            </div>
          </div>
        )}

        {/* Vocabulary */}
        {phase === 'vocabulary' && (
          <div data-testid="vocabulary-phase">
            <Button variant="ghost" onClick={() => setPhase('results')} className="mb-4 rounded-sm text-sm" data-testid="back-to-results-btn">
              Back to Results
            </Button>
            <h2 className="text-xl font-semibold font-sans mb-6">Word Meanings</h2>
            <div className="space-y-4">
              {wordMeanings.map((w, i) => (
                <Card key={i} className="rounded-sm border-zinc-200 dark:border-zinc-800" data-testid={`word-meaning-${w.word}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-serif font-medium capitalize">{w.word}</h3>
                      <Button variant="outline" size="sm" className="rounded-sm text-xs shrink-0"
                        data-testid={`bookmark-${w.word}`} onClick={() => bookmarkWord(w)}>
                        <BookMarked className="w-3 h-3 mr-1" /> Bookmark
                      </Button>
                    </div>
                    <p className="text-sm font-semibold mb-2">{w.meaning}</p>
                    {w.article_sentence && (
                      <div className="mb-2">
                        <p className="text-xs uppercase tracking-[0.1em] font-mono text-muted-foreground mb-1">In the passage</p>
                        <p className="text-sm italic text-zinc-600 dark:text-zinc-400">"{w.article_sentence}"</p>
                      </div>
                    )}
                    {w.example_sentence && (
                      <div className="mb-2">
                        <p className="text-xs uppercase tracking-[0.1em] font-mono text-muted-foreground mb-1">Example</p>
                        <p className="text-sm italic text-zinc-600 dark:text-zinc-400">"{w.example_sentence}"</p>
                      </div>
                    )}
                    {w.memory_trick && (
                      <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded-sm border mt-2">
                        <p className="text-xs uppercase tracking-[0.1em] font-mono text-muted-foreground mb-1">Memory Trick</p>
                        <p className="text-sm">{w.memory_trick}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <Button onClick={() => resetForNewArticle(true)} data-testid="vocab-continue-btn"
                className="rounded-sm bg-[#002FA7] hover:bg-[#002482] text-white">
                Continue Reading <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={() => { setPhase('settings'); setArticle(null); }} className="rounded-sm">
                Change Settings
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
