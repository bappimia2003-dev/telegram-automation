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
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-2.5">
            <Key className="text-amber-500 w-7 h-7" /> API Key Management
          </h1>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-2 bg-[#164E43] hover:bg-[#124238] text-white px-5 py-2.5 rounded-xl transition-all font-bold text-sm shadow-sm shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Plus size={18} /> Add New Key
        </button>
      </div>

      {/* Summary KPI Cards - Styled like 5th picture */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-5 rounded-2xl border transition-all shadow-sm bg-[#FBF9F4] dark:bg-[#0B2820] border-[#E6E2D8] dark:border-[#13382E] flex items-center justify-between gap-3.5">
          <div>
            <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">Active Keys / Total</p>
            <p className="text-2xl sm:text-3xl font-black tracking-tight text-[#164E43] dark:text-white">{activeKeysCount} / {keys.length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-[#164E43] text-white dark:bg-[#3D341B] dark:text-[#F59E0B]">
            <Key size={20} />
          </div>
        </div>

        <div className="p-5 rounded-2xl border transition-all shadow-sm bg-[#FBF9F4] dark:bg-[#0B2820] border-[#E6E2D8] dark:border-[#13382E] flex items-center justify-between gap-3.5">
          <div>
            <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">Active AI Bots Running</p>
            <p className="text-2xl sm:text-3xl font-black tracking-tight text-[#164E43] dark:text-white">{totalBotsRunning} Bots Live</p>
          </div>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-[#164E43] text-white dark:bg-[#3D341B] dark:text-[#F59E0B]">
            <Bot size={20} />
          </div>
        </div>

        <div className="p-5 rounded-2xl border transition-all shadow-sm bg-[#FBF9F4] dark:bg-[#0B2820] border-[#E6E2D8] dark:border-[#13382E] flex items-center justify-between gap-3.5">
          <div>
            <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">Total Requests Today</p>
            <p className="text-2xl sm:text-3xl font-black tracking-tight text-[#164E43] dark:text-white">{totalRequestsToday}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-[#164E43] text-white dark:bg-[#3D341B] dark:text-[#F59E0B]">
            <Zap size={20} />
          </div>
        </div>
      </div>

      {/* Main Keys List Container - matching Picture 5 */}
      <div className="bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] rounded-2xl p-4 sm:p-6 shadow-sm min-h-[300px]">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-xl" />
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            {/* Backdrop click to close */}
            <div className="fixed inset-0" onClick={handleCloseModal} />
            
            {/* Centered Modal Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-[#FBF9F4] dark:bg-[#181A1F] border border-[#E6E2D8] dark:border-[#262930] rounded-2xl shadow-2xl z-10 overflow-hidden my-auto"
            >
              <div className="flex items-center justify-between p-5 border-b border-[#E6E2D8] dark:border-[#262930]">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Key size={18} className="text-amber-500" />
                  {editingKey ? 'Edit API Key' : 'Add New Gemini API Key'}
                </h3>
                <button 
                  type="button"
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {actionError && (
                <div className="mx-5 mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs">
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
