'use client';

import { useState, useEffect } from 'react';
import { ApiKeyList } from '@/components/ApiKeyList';
import { ApiKeyForm } from '@/components/ApiKeyForm';
import { Key, Plus, AlertCircle, X, Bot, Activity, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<any>(null);
  const [actionError, setActionError] = useState('');

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/api-keys');
      const data = await res.json();
      setKeys(Array.isArray(data) ? data : data.keys || []);
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleOpenModal = (keyToEdit: any = null) => {
    setEditingKey(keyToEdit);
    setIsModalOpen(true);
    setActionError('');
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingKey(null);
    setActionError('');
  };

  const handleSubmit = async (formData: any) => {
    setSubmitting(true);
    setActionError('');
    try {
      const url = editingKey ? `/api/api-keys/${editingKey.id}` : '/api/api-keys';
      const method = editingKey ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (res.ok) {
        handleCloseModal();
        fetchKeys();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError(err.error || 'Failed to save API key');
      }
    } catch (error: any) {
      console.error('Failed to save API key:', error);
      setActionError(error?.message || 'Error saving API key');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/api-keys/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchKeys();
      }
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchKeys();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to delete API key. Check if it is currently in use by bots.');
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
    }
  };

  // Quick summary counts
  const totalBotsRunning = keys.reduce((acc, k) => acc + (k.activeBotsCount || 0), 0);
  const totalRequestsToday = keys.reduce((acc, k) => acc + (k.requestsToday || 0), 0);
  const activeKeysCount = keys.filter(k => (k.status || 'active').toLowerCase() === 'active').length;

  return (
    <div className="space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1.5 flex items-center gap-2.5">
            <Key className="text-amber-500 w-7 h-7" /> API Key Management
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage your Google AI Studio keys, track which Gmail key is active, and monitor running bots.
          </p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm shadow-sm shrink-0 self-start sm:self-auto"
        >
          <Plus size={18} /> Add New Key
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
            <Key size={18} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active Keys / Total</p>
            <p className="text-lg font-bold text-foreground">{activeKeysCount} / {keys.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 shrink-0">
            <Bot size={18} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active AI Bots Running</p>
            <p className="text-lg font-bold text-foreground">{totalBotsRunning} Bots Live</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border/60 bg-card/60 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
            <Zap size={18} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Requests Today</p>
            <p className="text-lg font-bold text-foreground">{totalRequestsToday}</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 sm:p-4 flex items-start gap-3">
        <AlertCircle className="text-blue-400 shrink-0 mt-0.5 w-4 h-4 sm:w-5 sm:h-5" />
        <div className="text-xs sm:text-sm text-blue-200">
          <p className="font-semibold text-blue-300 mb-0.5">Automatic Quota Rotation</p>
          <p className="text-xs opacity-90 leading-relaxed">
            Each key is tagged with its Gmail account so you always know where it came from. When a key reaches Google AI Studio quota limits, the system auto-rotates models (2.0 Flash ➔ Flash-Lite ➔ 1.5 Flash ➔ 8B) and switches to the next available Gmail key.
          </p>
        </div>
      </div>

      {/* Main Keys List Container */}
      <div className="bg-card/40 border border-border/50 rounded-xl p-4 sm:p-6 min-h-[300px]">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-card/80 border border-border/30 rounded-xl" />
            ))}
          </div>
        ) : (
          <ApiKeyList 
            apiKeys={keys} 
            onEdit={handleOpenModal} 
            onDelete={handleDelete}
            onToggleStatus={handleToggleStatus}
          />
        )}
      </div>

      {/* Centered, Responsive Modal Dialog */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
            {/* Backdrop click to close */}
            <div className="fixed inset-0" onClick={handleCloseModal} />
            
            {/* Centered Modal Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-card border border-border rounded-xl shadow-2xl z-10 overflow-hidden my-auto"
            >
              <div className="flex items-center justify-between p-5 border-b border-border/50">
                <h3 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                  <Key size={18} className="text-amber-500" />
                  {editingKey ? 'Edit API Key' : 'Add New Gemini API Key'}
                </h3>
                <button 
                  type="button"
                  onClick={handleCloseModal}
                  className="text-muted-foreground hover:text-white transition-colors p-1.5 rounded-lg hover:bg-secondary"
                >
                  <X size={18} />
                </button>
              </div>

              {actionError && (
                <div className="mx-5 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  {actionError}
                </div>
              )}

              <div className="p-5">
                <ApiKeyForm 
                  apiKey={editingKey} 
                  onSubmit={handleSubmit} 
                  loading={submitting}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
