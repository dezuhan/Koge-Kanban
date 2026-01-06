import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link as LinkIcon, Upload, Trash2, Image as ImageIcon, X, AlertTriangle, Check, Loader2 } from 'lucide-react';

interface MediaUploaderProps {
  media: string[];
  onChange: (media: string[]) => void;
}

const ImageThumbnail = ({ src, onPreview, onRemove }: { src: string, onPreview: (src: string) => void, onRemove: () => void }) => {
    const [error, setError] = useState(false);

    // Reset error state if src changes
    React.useEffect(() => {
        setError(false);
    }, [src]);

    return (
        <div 
            className="relative flex-shrink-0 w-24 h-24 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden group cursor-pointer hover:border-blue-300 transition-all"
            onClick={() => onPreview(src)}
        >
            {!error ? (
                <img 
                    src={src} 
                    alt="Preview" 
                    className="h-full w-full object-cover" 
                    onError={() => setError(true)}
                />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-2 text-center">
                    <ImageIcon size={20} />
                    <span className="text-[10px] truncate w-full mt-1">{src.slice(0, 15)}...</span>
                </div>
            )}
            
            <button 
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
                className="absolute top-1 right-1 bg-white/90 p-1 rounded-full text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            >
                <Trash2 size={12} />
            </button>
        </div>
    );
};

export const MediaUploader: React.FC<MediaUploaderProps> = ({ media = [], onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [compressModalOpen, setCompressModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [newLink, setNewLink] = useState('');

  const MAX_SIZE = 2 * 1024 * 1024; // 2MB limit before prompt (user asked for limit, let's set 2MB as threshold for compression, originally was 8MB hard limit)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            if (file.size > MAX_SIZE) {
                // If file is too large, trigger compression flow for this file
                // For simplicity in this demo, we handle one "oversized" file at a time or we could auto-compress.
                // The user requested a "popup confirmation".
                setPendingFile(file);
                setCompressModalOpen(true);
                // Reset input so it can be selected again if needed
                if (fileInputRef.current) fileInputRef.current.value = '';
                return; 
            }

            // Normal upload
            const reader = new FileReader();
            reader.onloadend = () => {
                onChange([...media, reader.result as string]);
            };
            reader.readAsDataURL(file);
        }
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddLink = () => {
      if (newLink.trim()) {
          onChange([...media, newLink.trim()]);
          setNewLink('');
      }
  };

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxWidth = 1200; // Reasonable max width
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                // Compress to JPEG with 0.7 quality
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
  };

  const confirmCompression = async () => {
      if (!pendingFile) return;
      setIsCompressing(true);
      try {
          const compressedDataUrl = await compressImage(pendingFile);
          onChange([...media, compressedDataUrl]);
          setCompressModalOpen(false);
          setPendingFile(null);
      } catch (error) {
          console.error("Compression failed", error);
          alert("Failed to compress image.");
      } finally {
          setIsCompressing(false);
      }
  };

  const cancelUpload = () => {
      setCompressModalOpen(false);
      setPendingFile(null);
  };

  const removeMedia = (index: number) => {
      const newMedia = [...media];
      newMedia.splice(index, 1);
      onChange(newMedia);
  };

  return (
    <>
    <div className="form-group">
        <label className="block text-sm font-medium text-gray-700 mb-1">Media (Links or Images)</label>
        
        {/* Input Area */}
        <div className="flex flex-col gap-3">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <LinkIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={newLink}
                        onChange={(e) => setNewLink(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLink())}
                        placeholder="Paste image URL..."
                        className="input-media w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    {newLink && (
                        <button 
                            onClick={handleAddLink}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                        >
                            <Check size={14} />
                        </button>
                    )}
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                />
                <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-upload bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 transition flex items-center gap-2 text-sm whitespace-nowrap"
                    title="Upload Image"
                >
                    <Upload size={16} /> <span className="hidden sm:inline">Upload</span>
                </button>
            </div>

            {/* Gallery Slider */}
            {media.length > 0 && (
                <div className="flex overflow-x-auto gap-2 mt-2 pb-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    {media.map((item, index) => (
                        <ImageThumbnail 
                            key={index}
                            src={item}
                            onPreview={setPreviewImage}
                            onRemove={() => removeMedia(index)}
                        />
                    ))}
                </div>
            )}
        </div>
    </div>

    {/* Full Screen Preview Modal */}
    {previewImage && createPortal(
        <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in"
            onClick={() => setPreviewImage(null)}
        >
            <div className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center justify-center p-4">
                <button 
                    onClick={() => setPreviewImage(null)}
                    className="absolute top-4 right-4 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-2 transition z-10"
                    title="Close Preview"
                >
                    <X size={32} />
                </button>
                <img 
                    src={previewImage} 
                    alt="Full Preview" 
                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                    onClick={(e) => e.stopPropagation()} 
                />
            </div>
        </div>,
        document.body
    )}

    {/* Compression Confirmation Modal */}
    {compressModalOpen && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">File Too Large</h3>
                    <p className="text-sm text-gray-500 mb-6">
                        The image you selected is larger than 2MB. Would you like to compress it to reduce size?
                    </p>
                    
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={cancelUpload}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmCompression}
                            disabled={isCompressing}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition flex items-center justify-center gap-2"
                        >
                            {isCompressing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            Compress
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )}
    </>
  );
};

