import React, { useState } from 'react';
import { Priority, PrioritySettings } from '../types';
import { X, RefreshCw } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PrioritySettings;
  onSave: (settings: PrioritySettings) => void;
  onReset: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave, onReset }) => {
  const [localSettings, setLocalSettings] = useState<PrioritySettings>(settings);

  if (!isOpen) return null;

  const handleChange = (priority: Priority, type: 'bg' | 'text', value: string) => {
    setLocalSettings(prev => ({
      ...prev,
      [priority]: {
        ...prev[priority],
        [type]: value
      }
    }));
  };

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  const handleReset = () => {
     onReset();
     onClose();
  };

  return (
    <div className="settings-modal fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="settings-modal-container bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="settings-modal-header flex justify-between items-center p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Settings</h2>
          <button onClick={onClose} className="btn-close p-1 hover:bg-gray-100 rounded-full text-gray-500 transition">
            <X size={20} />
          </button>
        </div>

        <div className="settings-modal-body p-6 space-y-6">
          <h3 className="font-semibold text-gray-700">Priority Colors</h3>
          <div className="space-y-4">
            {Object.values(Priority).map((priority) => (
              <div key={priority} className="setting-item flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                <span className="font-medium text-gray-700 w-20">{priority}</span>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <label className="text-xs text-gray-500">Background</label>
                    <input 
                      type="color" 
                      value={localSettings[priority].bg}
                      onChange={(e) => handleChange(priority, 'bg', e.target.value)}
                      className="input-color-bg w-12 h-8 rounded cursor-pointer border-0 p-0"
                    />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <label className="text-xs text-gray-500">Text</label>
                    <input 
                      type="color" 
                      value={localSettings[priority].text}
                      onChange={(e) => handleChange(priority, 'text', e.target.value)}
                      className="input-color-text w-12 h-8 rounded cursor-pointer border-0 p-0"
                    />
                  </div>
                </div>
                {/* Preview */}
                <div 
                  className="preview-badge px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border shadow-sm"
                  style={{ backgroundColor: localSettings[priority].bg, color: localSettings[priority].text, borderColor: localSettings[priority].bg }}
                >
                  Preview
                </div>
              </div>
            ))}
          </div>

          <div className="settings-modal-footer flex justify-between pt-4">
             <button
              onClick={handleReset}
              className="btn-reset px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
            >
              <RefreshCw size={16} /> Reset Defaults
            </button>
            <div className="flex gap-2">
                <button
                onClick={onClose}
                className="btn-cancel px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                Cancel
                </button>
                <button
                onClick={handleSave}
                className="btn-save px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm"
                >
                Save Changes
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;