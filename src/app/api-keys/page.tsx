'use client';

import { useState, useEffect } from 'react';
import { ApiKeyList } from '@/components/ApiKeyList';
import { ApiKeyForm } from '@/components/ApiKeyForm';
import { StatsCard } from '@/components/StatsCard';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useLanguage } from '@/components/LanguageProvider';
import { Key, Plus, X, Bot, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ApiKeysPage() {
  const { t } = useLanguage();
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<any>(null);
  const [actionError, setActionError] = useState('');
  const [confirmDeleteKeyId, setConfirmDeleteKeyId] = useState<string | null>(null);

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

  const executeDeleteKey = async (id: string) => {
    setKeys(prev => prev.filter(k => k.id !== id));
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchKeys();
      } else {
        fetchKeys();
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
    }
  };

  const totalBotsRunning = keys.reduce((acc, k) => acc + (k.activeBotsCount || 0), 0);
  const totalRequestsToday = keys.reduce((acc, k) => acc + (k.requestsToday || 0), 0);
  const activeKeysCount = keys.filter(k => (k.status || 'active').toLowerCase() === 'active').length;

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-card border border-border p-4 sm:px-5 day-box-shadow">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#0088CC]/12 dark:bg-[#229ED9]/15 text-[#0088CC] dark:text-[#229ED9] flex items-center justify-center shrink-0">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
              {t('AI API Key Management', 'এআই এপিআই কী ম্যানেজমেন্ট')}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(
                'Manage circular failover keys for automated bot response generation',
                'স্বয়ংক্রিয় বট রিপ্লাই এবং ফেইলওভার রোটেশনের জন্য এপিআই কী পরিচালনা করুন'
              )}
            </p>
          </div>
        </div>
        <button 
          type="button"
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center gap-1.5 bg-[#0088CC] hover:bg-[#0077B5] dark:bg-[#229ED9] dark:hover:bg-[#1E8CC0] text-white px-4 h-9 rounded-xl transition-transform active:scale-95 font-bold text-xs day-box-shadow shrink-0 cursor-pointer"
        >
          <Plus size={16} />
          <span>{t('Add New Key', 'নতুন কী যুক্ত করুন')}</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <StatsCard 
          title={t('Active Keys / Total', 'সচল কী / মোট')} 
          value={`${activeKeysCount} / ${keys.length}`} 
          icon={Key} 
        />
        <StatsCard 
          title={t('Active Bots', 'সচল বট')} 
          value={`${totalBotsRunning} ${t('Bots Live', 'টি সচল')}`} 
          icon={Bot} 
        />
        <StatsCard 
          title={t('Requests Today', 'আজকের রিকোয়েস্ট')} 
          value={totalRequestsToday.toString()} 
          icon={Zap} 
        />
      </div>

      {/* Main Keys List Container */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 day-box-shadow min-h-[260px]">
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-secondary rounded-xl" />
            ))}
          </div>
        ) : (
          <ApiKeyList 
            apiKeys={keys} 
            onEdit={handleOpenModal} 
            onDelete={(id: string) => setConfirmDeleteKeyId(id)}
            onToggleStatus={handleToggleStatus}
          />
        )}
      </div>

      {/* Confirm Delete API Key Modal (OK / Cancel) */}
      <ConfirmDialog
        open={Boolean(confirmDeleteKeyId)}
        title={t('Delete API Key?', 'এপিআই কী মুছে ফেলবেন?')}
        description={t(
          'Are you sure you want to delete this API key? Click OK to confirm or Cancel to keep it.',
          'আপনি কি নিশ্চিতভাবে এই এপিআই কী মুছে ফেলতে চান? নিশ্চিত করতে OK এবং না চাইলে Cancel চাপুন।'
        )}
        confirmLabel={t('OK, Delete', 'ওকে (OK)')}
        cancelLabel={t('Cancel', 'বাতিল (Cancel)')}
        variant="danger"
        onConfirm={async () => {
          if (!confirmDeleteKeyId) return;
          const id = confirmDeleteKeyId;
          setConfirmDeleteKeyId(null);
          await executeDeleteKey(id);
        }}
        onCancel={() => setConfirmDeleteKeyId(null)}
      />

      {/* Centered, Responsive Modal Dialog */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="fixed inset-0" onClick={handleCloseModal} />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl day-box-shadow z-10 overflow-hidden my-auto"
            >
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Key size={18} className="text-[#0088CC] dark:text-[#229ED9]" />
                  <span>{editingKey ? t('Edit API Key', 'এপিআই কী এডিট করুন') : t('Add New API Key', 'নতুন এপিআই কী যুক্ত করুন')}</span>
                </h3>
                <button 
                  type="button"
                  onClick={handleCloseModal}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-xl hover:bg-secondary cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {actionError && (
                <div className="mx-5 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
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
