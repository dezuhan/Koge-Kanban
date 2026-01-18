import React from 'react';
import { X, Loader2, RefreshCw, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  content: string;
  onRefresh: () => void;
  projectName: string;
}

const SummaryModal: React.FC<SummaryModalProps> = ({ 
  isOpen, 
  onClose, 
  loading, 
  content, 
  onRefresh,
  projectName 
}) => {
  if (!isOpen) return null;

  const handleDownload = () => {
    if (!cleanContent) return;
    const blob = new Blob([cleanContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}_Summary.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const cleanContent = content.replace(/^```markdown\s*|```\s*$/g, '').replace(/^```\s*|```\s*$/g, '').trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4 animate-fade-in">
      <div className="bg-white md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-2xl overflow-hidden flex flex-col md:max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-gray-800">Project Context Summary</h2>
                <p className="text-xs text-gray-500">{projectName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-500 transition">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-3">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <p className="text-sm font-medium animate-pulse">Analyzing project data...</p>
            </div>
          ) : cleanContent ? (
            <div className="prose prose-sm prose-blue max-w-none">
              <ReactMarkdown>{cleanContent}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p>Click refresh to generate a new summary.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center">
            <button 
                onClick={handleDownload}
                disabled={loading || !content}
                className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
                title="Download as Markdown"
            >
                <Download size={16} />
                <span className="hidden sm:inline">Download</span>
            </button>

            <button 
                onClick={onRefresh} 
                disabled={loading}
                className="w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition disabled:opacity-50"
                title="Regenerate Summary"
            >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            </button>
        </div>
      </div>
    </div>
  );
};

export default SummaryModal;

