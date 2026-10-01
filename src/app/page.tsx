'use client';

import { LoginForm } from '@/components/LoginForm';
import { motion } from 'framer-motion';

export default function LoginPage() {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background">
      {/* Animated gradient background */}
      <motion.div 
        className="absolute inset-0 z-0 opacity-20"
        animate={{
          background: [
            'radial-gradient(circle at 0% 0%, #3b82f6 0%, transparent 50%)',
            'radial-gradient(circle at 100% 100%, #8b5cf6 0%, transparent 50%)',
            'radial-gradient(circle at 0% 100%, #3b82f6 0%, transparent 50%)',
            'radial-gradient(circle at 100% 0%, #8b5cf6 0%, transparent 50%)',
            'radial-gradient(circle at 0% 0%, #3b82f6 0%, transparent 50%)'
          ]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      />
      
      <main className="z-10 flex-1 flex flex-col items-center justify-center w-full px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Welcome Back</h1>
            <p className="text-muted-foreground">Sign in to manage your Telegram bots</p>
          </div>
          <LoginForm />
        </motion.div>
      </main>

      <footer className="z-10 py-6 text-center text-sm text-muted-foreground">
        Telegram Automation System v1.0
      </footer>
    </div>
  );
}
