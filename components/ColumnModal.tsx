import React, { useState, useEffect } from 'react';
import { Column } from '../types';
import { X } from 'lucide-react';

interface ColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (column: Column) => void;
  initialColumn?: Column | null;
}

const PRESET_COLORS = [
  '#94a3b8', // Gray
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#84cc16', // Lime
  '#22c55e', // Green
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#f43f5e', // Rose
];

const ColumnModal: React.FC<ColumnModalProps> = ({ isOpen, onClose, onSave, initialColumn }) => {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('#94a3b8');

  useEffect(() => {
    if (initialColumn) {
      setTitle(initialColumn.title);
      setColor(initialColumn.color);
    } else {
      setTitle('');
      setColor('#94a3b8');
    }
  }, [initialColumn, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: initialColumn ? initialColumn.id : crypto.randomUUID(),
      title,
      color,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="column-modal fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="column-modal-container bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="column-modal-header flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">{initialColumn ? 'Edit Column' : 'New Column'}</h2>
          <button onClick={onClose} className="btn-close p-1 hover:bg-gray-100 rounded-full text-gray-500 transition">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="column-modal-form p-6 space-y-4">
          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 mb-1">Column Name</label>
            <input
              required
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-title w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., In Review"
            />
          </div>

          <div className="form-group">
            <label className="block text-sm font-medium text-gray-700 mb-2">Color Label</label>
            <div className="color-presets flex flex-wrap gap-2 mb-3">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`color-swatch w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-gray-600 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="custom-color flex items-center gap-2">
               <span className="text-xs text-gray-500">Custom:</span>
               <input 
                  type="color" 
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="input-color-picker w-full h-8 rounded cursor-pointer border-gray-200 border"
               />
            </div>
          </div>

          <div className="column-modal-footer flex justify-end pt-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-cancel px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-save px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ColumnModal;