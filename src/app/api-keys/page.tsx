'use client';

import { useState, useEffect } from 'react';
import { ApiKeyList } from '@/components/ApiKeyList';
import { ApiKeyForm } from '@/components/ApiKeyForm';
import { Key, Plus, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<any>(null);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/api-keys');
      const data = await res.json();
      setKeys(data.keys || []);
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
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingKey(null);
  };

  const handleSubmit = async (formData: any) => {
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
      }
    } catch (error) {
      console.error('Failed to save API key:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key? Bots using it will fallback to another active key.')) return;
    try {
      await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
      fetchKeys();
    } catch (error) {
      console.error('Failed to delete API key:', error);
    }
  };

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2 flex items-center gap-3">
            <Key className="text-amber-500" /> API Key Management
          </h1>
          <p className="text-muted-foreground">Manage your Google AI Studio API keys across multiple accounts.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
        >
          <Plus size={18} /> Add New Key
        </button>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-4">
        <AlertCircle className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-200">
          <p className="font-medium text-blue-400 mb-1">Smart Key Rotation System</p>
          <p>Each API key is tagged with its Gmail account so you always know where it came from. When a key's quota is exhausted, the system automatically rotates to the next available key.</p>
        </div>
      </div>

      <div className="bg-card border border-border/50 rounded-xl overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-card/80 border border-border/30 rounded-lg" />
            ))}
          </div>
        ) : (
          <ApiKeyList 
            apiKeys={keys} 
            onEdit={handleOpenModal} 
            onDelete={handleDelete} 
          />
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
              onClick={handleCloseModal}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-border/50">
                <h3 className="text-lg font-semibold text-white">
                  {editingKey ? 'Edit API Key' : 'Add New API Key'}
                </h3>
                <button 
                  onClick={handleCloseModal}
                  className="text-muted-foreground hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6">
                <ApiKeyForm 
                  apiKey={editingKey} 
                  onSubmit={handleSubmit} 
                  loading={submitting}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
