'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { ThemeToggle } from '@/components/ThemeToggle';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          router.replace('/whatsapp');
        }
      })
      .catch(() => {});
  }, [router]);
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[#F4F1EB] dark:bg-[#111215] transition-colors duration-200">
      {/* Top right Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Subtle ambient glow */}
      <div 
        className="absolute inset-0 z-0 opacity-40 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 30% 20%, rgba(22, 78, 67, 0.08) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(22, 78, 67, 0.06) 0%, transparent 50%)'
        }}
      />
      
      <main className="z-10 flex-1 flex flex-col items-center justify-center w-full px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="w-full max-w-[400px]"
        >
          <LoginForm />
        </motion.div>
      </main>
    </div>
  );
}
