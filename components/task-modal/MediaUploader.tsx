import React, { useRef } from 'react';
import { Link as LinkIcon, Upload, Trash2, Image as ImageIcon } from 'lucide-react';

interface MediaUploaderProps {
  media: string;
  onChange: (media: string) => void;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({ media, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) { // 8MB limit
          alert("Image is too large. Please upload an image smaller than 8MB.");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="form-group">
        <label className="block text-sm font-medium text-gray-700 mb-1">Media (Link or Image)</label>
        <div className="flex flex-col gap-2">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <LinkIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={media}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="https://example.com/image.png"
                        className="input-media w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                />
                <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-upload bg-gray-100 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
                    title="Upload Image"
                >
                    <Upload size={18} /> <span className="hidden sm:inline">Upload</span>
                </button>
            </div>
            {media && (
                <div className="media-preview relative mt-2 w-full h-32 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center group">
                     {media.match(/\.(jpeg|jpg|gif|png|webp)|data:image/i) ? (
                         <img src={media} alt="Preview" className="h-full w-full object-contain" />
                     ) : (
                         <div className="text-gray-400 flex flex-col items-center gap-1">
                             <ImageIcon size={24} />
                             <span className="text-xs">Media Link Preview</span>
                         </div>
                     )}
                     <button 
                        type="button"
                        onClick={() => onChange('')}
                        className="btn-remove-media absolute top-1 right-1 bg-white/80 p-1 rounded-full text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                     >
                         <Trash2 size={16} />
                     </button>
                </div>
            )}
        </div>
    </div>
  );
};

