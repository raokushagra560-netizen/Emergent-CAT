import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

export default function AuthCallback() {
  const hasProcessed = useRef(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = window.location.hash;
    const sessionId = new URLSearchParams(hash.substring(1)).get('session_id');

    if (!sessionId) {
      navigate('/');
      return;
    }

    const processSession = async () => {
      try {
        const res = await api.post('/auth/session', { session_id: sessionId });
        setUser(res.data);
        navigate('/dashboard', { replace: true, state: { user: res.data } });
      } catch (err) {
        console.error('Auth failed:', err);
        navigate('/');
      }
    };
    processSession();
  }, [navigate, setUser]);

  return null;
}
