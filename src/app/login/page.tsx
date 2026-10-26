'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageProvider';
import {
  Eye,
  EyeOff,
  ArrowRight,
  Lock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) {
      setError(
        t(
          'Please enter your password',
          'অনুগ্রহ করে আপনার পাসওয়ার্ড লিখুন'
        )
      );
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmed }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {}

      if (!res.ok || !data.success) {
        setError(
          t(
            'Invalid password. Please try again.',
            'ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।'
          )
        );
        setLoading(false);
        return;
      }

      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('jalabot_logged_out');
          localStorage.setItem(
            'jalabot_session_meta',
            JSON.stringify({
              authenticated: true,
              role: data.role || 'admin',
              clientId: data.clientId || 'admin',
              clientName: data.clientName || 'Admin',
            })
          );
        } catch {}

        if (data.token) {
          const isHttps = window.location.protocol === 'https:';
          const cookieAttributes = isHttps
            ? 'path=/; max-age=604800; SameSite=None; Secure; Partitioned'
            : 'path=/; max-age=604800; SameSite=Lax';
          document.cookie = `tg-auto-session=${data.token}; ${cookieAttributes}`;
        }
      }

      setSuccessMsg(
        data.role === 'admin'
          ? t('Admin access granted', 'অ্যাডমিন লগইন সফল')
          : t(`Welcome, ${data.clientName || 'Client'}`, `স্বাগতম, ${data.clientName || 'ক্লায়েন্ট'}`)
      );

      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.assign('/whatsapp');
        } else {
          router.push('/whatsapp');
        }
      }, 150);
    } catch {
      setError(
        t(
          'Connection error. Please try again.',
          'সংযোগে সমস্যা হয়েছে। আবার চেষ্টা করুন।'
        )
      );
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center px-6 select-none"
      style={{
        background:
          'radial-gradient(circle at 48% 38%, #132A2E 0%, #0B191D 52%, #071114 100%)',
      }}
    >
      {/* Top-Left Organic Curved Emerald Shape (matches reference image) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-[28vw] -left-[22vw] w-[52vw] h-[52vw] min-w-[360px] min-h-[360px] rounded-full"
        style={{
          background:
            'linear-gradient(145deg, rgba(24, 78, 68, 0.55) 0%, rgba(17, 54, 49, 0.38) 100%)',
        }}
      />

      {/* Bottom-Right Organic Curved Emerald Shape (matches reference image) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -bottom-[34vw] -right-[20vw] w-[58vw] h-[58vw] min-w-[400px] min-h-[400px] rounded-full"
        style={{
          background:
            'linear-gradient(315deg, rgba(22, 74, 63, 0.48) 0%, rgba(14, 46, 42, 0.3) 100%)',
        }}
      />

      {/* Centered Minimal Login Stack */}
      <main className="relative z-10 w-full max-w-[430px] flex flex-col items-center">
        {/* JalaBot Squircle Icon */}
        <div className="mb-10 flex items-center justify-center">
          <div className="relative group">
            <div
              aria-hidden="true"
              className="absolute -inset-3 rounded-[30px] bg-[#00C48C]/15 blur-xl opacity-80 group-hover:opacity-100 transition-opacity"
            />
            <img
              src="/jalabot-logo.svg"
              alt="JalaBot"
              className="relative w-[88px] h-[88px] rounded-[24px] shadow-[0_18px_40px_-10px_rgba(0,0,0,0.65)]"
            />
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="w-full space-y-5">
          {/* Pill Password Input */}
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-6 text-[#B0BEC5]">
              <Lock className="w-[19px] h-[19px] stroke-[1.9]" />
            </div>

            <input
              id="access-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              placeholder={t('Enter password', 'পাসওয়ার্ড লিখুন')}
              autoFocus
              autoComplete="current-password"
              className="w-full h-[56px] pl-14 pr-14 rounded-full bg-[#16232B]/90 border border-[#344650] hover:border-[#435965] focus:border-[#00C48C] text-[15px] font-normal text-[#E2E8F0] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#00C48C]/20 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]"
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center pr-6 text-[#B0BEC5] hover:text-white transition-colors cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-[19px] h-[19px] stroke-[1.9]" />
              ) : (
                <Eye className="w-[19px] h-[19px] stroke-[1.9]" />
              )}
            </button>
          </div>

          {/* Pill Emerald Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-[54px] rounded-full font-semibold text-[16px] text-white flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer shadow-[0_10px_28px_-6px_rgba(0,200,133,0.4)] hover:brightness-105"
            style={{
              background: 'linear-gradient(90deg, #00CC88 0%, #00B377 100%)',
            }}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{t('Enter', 'প্রবেশ করুন')}</span>
                <ArrowRight className="w-[18px] h-[18px] stroke-[2.2]" />
              </>
            )}
          </button>

          {/* Compact Feedback Message (Only shown on error or login success) */}
          {error && (
            <div className="flex items-center justify-center gap-2 pt-1 text-red-400 text-xs font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center justify-center gap-2 pt-1 text-[#00D084] text-xs font-medium animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
