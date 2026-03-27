import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { BookMarked, Trash2, Search, Layers } from 'lucide-react';

export default function VocabularyPage() {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    api.get('/vocabulary/bookmarks')
      .then(res => setBookmarks(res.data))
      .catch(() => toast.error('Failed to load vocabulary'))
      .finally(() => setLoading(false));
  }, []);

  const deleteBookmark = async (vocabId) => {
    try {
      await api.delete(`/vocabulary/bookmark/${vocabId}`);
      setBookmarks(prev => prev.filter(b => b.vocab_id !== vocabId));
      toast.success('Removed');
    } catch { toast.error('Failed to remove'); }
  };

  const filtered = bookmarks.filter(b => b.word.toLowerCase().includes(search.toLowerCase()));

  const nextCard = () => { setFlipped(false); setCurrentCard(prev => (prev + 1) % filtered.length); };
  const prevCard = () => { setFlipped(false); setCurrentCard(prev => (prev - 1 + filtered.length) % filtered.length); };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] font-mono text-zinc-500 mb-2">Vocabulary</p>
            <h1 className="text-3xl md:text-4xl tracking-tight font-medium font-serif" data-testid="vocab-title">
              Your Flashcards
            </h1>
          </div>
          {bookmarks.length > 0 && (
            <Button variant={flashcardMode ? 'default' : 'outline'}
              onClick={() => { setFlashcardMode(!flashcardMode); setCurrentCard(0); setFlipped(false); }}
              data-testid="flashcard-mode-btn"
              className={`rounded-sm ${flashcardMode ? 'bg-[#002FA7] hover:bg-[#002482] text-white' : ''}`}>
              <Layers className="w-4 h-4 mr-2" /> {flashcardMode ? 'List View' : 'Flashcard Mode'}
            </Button>
          )}
        </div>

        {bookmarks.length > 0 && (
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search words..."
              className="pl-9 rounded-sm" data-testid="vocab-search" />
          </div>
        )}

        {loading && (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-sm" />)}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16" data-testid="vocab-empty">
            <BookMarked className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-sans">
              {bookmarks.length === 0
                ? 'No words bookmarked yet. Start reading to build your vocabulary!'
                : 'No words match your search.'}
            </p>
          </div>
        )}

        {/* Flashcard Mode */}
        {!loading && flashcardMode && filtered.length > 0 && (
          <div className="flex flex-col items-center" data-testid="flashcard-view">
            <div className="w-full max-w-md" style={{ perspective: '1000px' }}>
              <div className="relative w-full min-h-[280px] cursor-pointer"
                style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)', transition: 'transform 0.5s' }}
                onClick={() => setFlipped(!flipped)} data-testid="flashcard">
                {/* Front */}
                <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
                  <Card className="rounded-sm border-zinc-200 dark:border-zinc-800 h-full flex items-center justify-center min-h-[280px]">
                    <CardContent className="p-8 text-center">
                      <p className="text-3xl font-serif font-medium capitalize mb-2">{filtered[currentCard]?.word}</p>
                      <p className="text-sm text-muted-foreground font-mono">Click to reveal meaning</p>
                    </CardContent>
                  </Card>
                </div>
                {/* Back */}
                <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  <Card className="rounded-sm border-[#002FA7]/30 bg-[#002FA7]/5 dark:bg-[#002FA7]/10 h-full min-h-[280px]">
                    <CardContent className="p-6">
                      <p className="text-lg font-serif font-medium capitalize mb-3">{filtered[currentCard]?.word}</p>
                      <p className="text-sm font-semibold mb-2">{filtered[currentCard]?.meaning}</p>
                      {filtered[currentCard]?.example_sentence && (
                        <p className="text-sm italic text-muted-foreground mb-2">"{filtered[currentCard]?.example_sentence}"</p>
                      )}
                      {filtered[currentCard]?.memory_trick && (
                        <div className="bg-background p-2 rounded-sm border mt-2">
                          <p className="text-xs font-mono text-muted-foreground">Trick: {filtered[currentCard]?.memory_trick}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-6">
              <Button variant="outline" onClick={prevCard} className="rounded-sm" data-testid="prev-card-btn">Previous</Button>
              <span className="text-sm font-mono text-muted-foreground">{currentCard + 1} / {filtered.length}</span>
              <Button variant="outline" onClick={nextCard} className="rounded-sm" data-testid="next-card-btn">Next</Button>
            </div>
          </div>
        )}

        {/* List Mode */}
        {!loading && !flashcardMode && filtered.length > 0 && (
          <div className="space-y-3" data-testid="vocab-list">
            {filtered.map(b => (
              <Card key={b.vocab_id} className="rounded-sm border-zinc-200 dark:border-zinc-800">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-serif font-medium capitalize">{b.word}</h3>
                      <span className="text-xs text-muted-foreground font-mono">{new Date(b.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm mb-1">{b.meaning}</p>
                    {b.memory_trick && <p className="text-xs text-muted-foreground">Trick: {b.memory_trick}</p>}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteBookmark(b.vocab_id)}
                    data-testid={`delete-vocab-${b.vocab_id}`} className="text-muted-foreground hover:text-red-500 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground font-mono">{bookmarks.length} words in your collection</p>
        </div>
      </main>
    </div>
  );
}
