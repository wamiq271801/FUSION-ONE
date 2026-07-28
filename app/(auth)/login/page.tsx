'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/platform/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import Image from 'next/image';
import { Mail, Lock } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { error, success } = useToast();
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        success('Account created!', 'You can now sign in.');
        setIsSignUp(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        // Navigate to dashboard — middleware validates the cookie and either
        // allows access, redirects to /onboarding (if setup not done), or
        // rejects the session.
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      error('Authentication Error', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Decorative background elements */}
      <div className="absolute top-[-10rem] left-[-10rem] w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10rem] right-[-10rem] w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <Card className="w-full max-w-md relative z-10 p-2 shadow-xl border-slate-100">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-14 h-14 mb-3 relative">
            <Image
              src="/Logo_Rounded.png"
              alt="FUSION ONE Logo"
              width={56}
              height={56}
              className="w-14 h-14 rounded-xl object-contain shadow-md"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent tracking-tight">
            FUSION ONE
          </CardTitle>
          <CardDescription className="text-slate-500 text-sm mt-2">
            {isSignUp ? 'Create a new owner account.' : 'Sign in to access your business.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4 pt-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider pl-1">
                Email Address
              </label>
              <Input
                type="email"
                placeholder="owner@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                icon={<Mail className="h-4 w-4" />}
                className="h-11"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider pl-1">
                Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                icon={<Lock className="h-4 w-4" />}
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base shadow-indigo-600/20 shadow-lg hover:shadow-indigo-600/30 transition-all mt-6"
              isLoading={isLoading}
            >
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Button>

            <div className="text-center mt-6">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-slate-500 hover:text-indigo-600 font-medium transition-colors"
                disabled={isLoading}
              >
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : 'Need to deploy for a new store? Sign Up'}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
