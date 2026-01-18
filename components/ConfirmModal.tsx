import React from 'react';
import { AlertTriangle, Info, AlertCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
  isAlert?: boolean; // If true, hide cancel button
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  type = 'danger',
  confirmText,
  cancelText = 'Cancel',
  isAlert = false
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger': return <AlertCircle className="h-6 w-6 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-6 w-6 text-amber-600" />;
      case 'info': return <Info className="h-6 w-6 text-blue-600" />;
      default: return <AlertCircle className="h-6 w-6 text-red-600" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'danger': return 'bg-red-100';
      case 'warning': return 'bg-amber-100';
      case 'info': return 'bg-blue-100';
      default: return 'bg-red-100';
    }
  };

  const getConfirmBtnClass = () => {
    switch (type) {
      case 'danger': return 'bg-red-600 hover:bg-red-700';
      case 'warning': return 'bg-amber-600 hover:bg-amber-700';
      case 'info': return 'bg-blue-600 hover:bg-blue-700';
      default: return 'bg-red-600 hover:bg-red-700';
    }
  };

  const defaultConfirmText = isAlert ? 'OK' : (type === 'danger' ? 'Delete' : 'Confirm');
  const finalConfirmText = confirmText || defaultConfirmText;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div 
        className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 text-center">
          <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${getIconBg()} mb-4`}>
            {getIcon()}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 mb-6">{message}</p>
          <div className="flex gap-3 justify-center">
            {!isAlert && (
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition font-bold text-sm"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-4 py-2.5 text-white ${getConfirmBtnClass()} rounded-lg transition font-bold shadow-sm text-sm`}
            >
              {finalConfirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
