import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { BookOpen, Target, Brain, Sparkles, ArrowRight, Sun, Moon } from 'lucide-react';

export default function LandingPage() {
  const { user, login, register, loading } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [showAuth, setShowAuth] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/dashboard');
  }, [user, loading, navigate]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setAuthLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-xl bg-white/70 dark:bg-zinc-950/60 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#002FA7]" />
            <span className="font-serif text-xl font-semibold tracking-tight">ComprehendCAT</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-sm w-8 h-8"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button onClick={() => setShowAuth(true)} data-testid="nav-login-btn"
              className="rounded-sm bg-[#002FA7] hover:bg-[#002482] text-white">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] font-mono text-zinc-500 mb-6">
              CAT Reading Comprehension
            </p>
            <h1 className="text-5xl md:text-6xl tracking-tighter leading-tight font-medium font-serif text-foreground">
              Master the Art of Reading
            </h1>
            <p className="mt-6 text-base md:text-lg text-zinc-600 dark:text-zinc-400 max-w-lg leading-relaxed font-sans">
              AI-powered reading comprehension training designed for CAT aspirants. Personalized articles, real-time assessment, and vocabulary mastery -- all calibrated to your level.
            </p>
            <div className="mt-10 flex gap-4">
              <Button onClick={() => setShowAuth(true)} data-testid="hero-cta-btn" size="lg"
                className="rounded-sm bg-[#002FA7] hover:bg-[#002482] text-white px-8 h-12 text-base">
                Start Training <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <img
              src="https://images.unsplash.com/photo-1595494702547-a45e577e2764?w=800&q=80"
              alt="Focused reading"
              className="rounded-sm w-full aspect-[4/3] object-cover border border-zinc-200 dark:border-zinc-800"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs uppercase tracking-[0.2em] font-mono text-zinc-500 mb-4">Features</p>
          <h2 className="text-3xl md:text-4xl tracking-tight leading-snug font-medium font-serif">
            Everything You Need to Excel
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Target, title: "Adaptive Assessment", desc: "3-round diagnostic that calibrates your reading level across genres. Measures speed, comprehension, and structural analysis." },
              { icon: Brain, title: "AI-Curated Articles", desc: "Articles styled after CAT, GMAT, GRE patterns. Difficulty, tone, word count, and structure personalized to your level." },
              { icon: Sparkles, title: "Vocabulary Mastery", desc: "Click any word for instant definitions, usage examples, and memory tricks. Build your personal flashcard deck." },
            ].map((f, i) => (
              <div key={i} className="p-6 bg-background border border-zinc-200 dark:border-zinc-800 rounded-sm">
                <f.icon className="w-8 h-8 text-[#002FA7] mb-4" />
                <h3 className="text-xl font-semibold font-sans mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs uppercase tracking-[0.2em] font-mono text-zinc-500 mb-4">Process</p>
          <h2 className="text-3xl md:text-4xl tracking-tight leading-snug font-medium font-serif">
            How It Works
          </h2>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Assess", desc: "Take a 3-round diagnostic across your strongest and weakest genres." },
              { step: "02", title: "Calibrate", desc: "We analyze your speed and comprehension to set your difficulty level." },
              { step: "03", title: "Practice", desc: "Read AI-generated articles tailored to your level. Answer comprehension questions." },
              { step: "04", title: "Master", desc: "Track progress, build vocabulary, and level up your reading ability." },
            ].map((s, i) => (
              <div key={i} className="relative">
                <span className="text-6xl font-serif font-light text-zinc-100 dark:text-zinc-800 absolute -top-2 -left-2">{s.step}</span>
                <div className="relative pt-12">
                  <h3 className="text-lg font-semibold font-sans mb-2">{s.title}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-sm text-zinc-500 font-mono">ComprehendCAT</span>
          <span className="text-xs text-zinc-400">Built for CAT aspirants</span>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="relative bg-background border border-zinc-200 dark:border-zinc-800 rounded-sm p-8 w-full max-w-md">
            <h2 className="text-2xl font-serif font-semibold mb-6">
              {isLogin ? 'Welcome back' : 'Create account'}
            </h2>
            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <input type="text" placeholder="Your name" value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-zinc-200 dark:border-zinc-700 rounded-sm px-4 py-2 bg-background text-sm"
                  required />
              )}
              <input type="email" placeholder="Email" value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-sm px-4 py-2 bg-background text-sm"
                required />
              <input type="password" placeholder="Password" value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-zinc-200 dark:border-zinc-700 rounded-sm px-4 py-2 bg-background text-sm"
                required />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button type="submit" disabled={authLoading}
                className="w-full rounded-sm bg-[#002FA7] hover:bg-[#002482] text-white h-10">
                {authLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
              </Button>
            </form>
            <p className="text-sm text-center mt-4 text-zinc-500">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => setIsLogin(!isLogin)} className="text-[#002FA7] underline">
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>
            <button onClick={() => setShowAuth(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 text-lg">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
