'use client';

import { LoginForm } from '@/components/LoginForm';
import { ThemeToggle } from '@/components/ThemeToggle';
import { motion } from 'framer-motion';

export default function LoginPage() {
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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-2">Welcome Back</h1>
            <p className="text-sm text-[#4B5563] dark:text-[#9CA3AF]">Sign in to manage your Telegram bots</p>
          </div>
          <LoginForm />
        </motion.div>
      </main>

      <footer className="z-10 py-6 text-center text-xs text-gray-400 dark:text-gray-600">
        Telegram Automation System v1.0
      </footer>
    </div>
  );
}
