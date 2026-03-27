import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { BookOpen, Sun, Moon, User, LogOut, LayoutDashboard, BookMarked } from 'lucide-react';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/read', label: 'Read' },
    { path: '/vocabulary', label: 'Vocabulary' },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-zinc-950/60 border-b border-zinc-200/50 dark:border-zinc-800/50"
      data-testid="app-header">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2" data-testid="header-logo">
            <BookOpen className="w-5 h-5 text-[#002FA7]" />
            <span className="font-serif text-lg font-semibold tracking-tight hidden sm:inline">ComprehendCAT</span>
          </button>
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ path, label }) => (
              <button key={path} onClick={() => navigate(path)}
                className={`px-3 py-1.5 text-sm font-sans rounded-sm transition-colors
                  ${location.pathname === path ? 'text-foreground bg-zinc-100 dark:bg-zinc-800' : 'text-muted-foreground hover:text-foreground'}`}
                data-testid={`nav-${label.toLowerCase()}`}>
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="rounded-sm w-8 h-8"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} data-testid="theme-toggle">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-sm w-8 h-8" data-testid="user-menu-btn">
                {user?.picture ? (
                  <img src={user.picture} alt="" className="w-6 h-6 rounded-full" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-sm w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/dashboard')} data-testid="menu-dashboard">
                <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/vocabulary')} data-testid="menu-vocabulary">
                <BookMarked className="w-4 h-4 mr-2" /> Vocabulary
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                <LogOut className="w-4 h-4 mr-2" /> Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
