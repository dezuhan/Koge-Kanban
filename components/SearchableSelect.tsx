import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, Search, Check } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string;
  group?: string;
  subLabel?: string;
  rightLabel?: string;
  rightLabelColor?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  onCreateOption?: (option: string) => void;
  variant?: 'dark' | 'light';
  showSearch?: boolean;
  size?: 'sm' | 'md';
  optionStyles?: Record<string, { bg: string; text: string }>;
  disabled?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select or search...',
  label,
  icon,
  className = '',
  onCreateOption,
  variant = 'light',
  showSearch = true,
  size = 'md',
  optionStyles,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;
      const dropdownHeight = showSearch ? 350 : (size === 'sm' ? 200 : 320); // Estimated heights

      setOpenUpwards(spaceBelow < dropdownHeight);
    }
  }, [isOpen, showSearch, size]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const normalizedOptions: SelectOption[] = options.map(opt =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  const filteredOptions = normalizedOptions.filter(option =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    option.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (option.subLabel && option.subLabel.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const groupedOptions = filteredOptions.reduce((acc, opt) => {
    const group = opt.group || 'Default';
    if (!acc[group]) acc[group] = [];
    acc[group].push(opt);
    return acc;
  }, {} as Record<string, SelectOption[]>);

  const showCreateOption = onCreateOption && searchQuery.trim() !== '' &&
    !normalizedOptions.some(opt => opt.label.toLowerCase() === searchQuery.toLowerCase().trim());

  const selectedOption = normalizedOptions.find(opt => opt.value === value);
  const displayLabel = selectedOption ? selectedOption.label : value;

  const buttonClasses = variant === 'dark'
    ? 'bg-[#333333] text-white border-gray-600'
    : 'bg-white text-gray-800 border-gray-200';

  const textClasses = value
    ? (variant === 'dark' ? 'text-gray-100' : 'text-gray-800')
    : (variant === 'dark' ? 'text-gray-500' : 'text-gray-400');

  return (
    <div className={`searchable-select relative ${className}`} ref={containerRef}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}

      <div className="relative">
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`flex items-center justify-between w-full rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all ${disabled ? 'cursor-default grayscale opacity-60 bg-gray-50 border-gray-100' : 'cursor-pointer hover:border-blue-300'
            } ${size === 'sm' ? 'p-[6px] min-h-[30px]' : 'px-3 py-2 min-h-[40px]'
            } ${buttonClasses}`}
        >
          <div className="flex items-center gap-2 truncate">
            {icon && <div className="text-gray-400 shrink-0">{icon}</div>}
            <span
              className={`${size === 'sm' ? 'text-[10px]' : 'text-[11px]'} font-black uppercase tracking-wider ${textClasses} ${optionStyles?.[value] ? 'px-3 py-1 rounded' : ''}`}
              style={optionStyles?.[value] ? { backgroundColor: optionStyles[value].bg, color: optionStyles[value].text } : {}}
            >
              {displayLabel || placeholder}
            </span>
          </div>
          <ChevronDown size={size === 'sm' ? 14 : 16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {isOpen && (
          <div className={`absolute ${openUpwards ? 'bottom-full mb-1 origin-bottom animate-in slide-in-from-bottom-2' : 'top-full mt-1 origin-top animate-in slide-in-from-top-2'} left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col fade-in zoom-in-95 duration-200`}>
            {/* Search Input */}
            {showSearch && (
              <div className="p-3 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search or type new..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-blue-500 rounded-lg outline-none ring-4 ring-blue-500/10 transition-all"
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div className={`${showSearch ? 'max-h-[240px]' : (size === 'sm' ? 'max-h-[180px]' : 'max-h-[300px]')} overflow-y-auto custom-scrollbar`}>
              {Object.keys(groupedOptions).length > 0 ? (
                Object.entries(groupedOptions).map(([group, opts]) => (
                  <div key={group}>
                    {group !== 'Default' && (
                      <div className="px-3 py-1 bg-gray-50/50 text-[10px] font-black uppercase tracking-widest text-gray-400 border-y border-gray-100/50 mt-1 first:mt-0">
                        {group}
                      </div>
                    )}
                    {opts.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={option.disabled}
                        onClick={() => {
                          onChange(option.value);
                          setIsOpen(false);
                          setSearchQuery('');
                        }}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-all ${value === option.value
                          ? 'bg-blue-50 text-blue-700 font-bold'
                          : option.disabled ? 'opacity-50 cursor-not-allowed' : 'text-gray-600 hover:bg-blue-50 hover:pl-5'
                          }`}
                      >
                        <div className="flex flex-col min-w-0">
                          <span
                            className={`truncate ${size === 'sm' ? 'text-[10px]' : 'text-[11px]'} font-black uppercase tracking-wider ${optionStyles?.[option.value] ? 'px-3 py-1 rounded' : ''}`}
                            style={optionStyles?.[option.value] ? { backgroundColor: optionStyles[option.value].bg, color: optionStyles[option.value].text } : {}}
                          >
                            {option.label}
                          </span>
                          {option.subLabel && (
                            <span className="text-[10px] text-gray-400 font-medium truncate italic">{option.subLabel}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {option.rightLabel && (
                            <span
                              className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                              style={{
                                backgroundColor: option.rightLabelColor ? `${option.rightLabelColor}20` : '#f3f4f6',
                                color: option.rightLabelColor || '#6b7280',
                                border: `1px solid ${option.rightLabelColor ? `${option.rightLabelColor}30` : '#e5e7eb'}`
                              }}
                            >
                              {option.rightLabel}
                            </span>
                          )}
                          {value === option.value && <Check size={size === 'sm' ? 14 : 16} strokeWidth={3} className="text-blue-600" />}
                        </div>
                      </button>
                    ))}
                  </div>
                ))
              ) : !showCreateOption && (
                <div className="px-3 py-6 text-xs text-gray-400 text-center italic">
                  No results found
                </div>
              )}

              {/* Create New Option */}
              {showCreateOption && (
                <button
                  type="button"
                  onClick={() => {
                    const newVal = searchQuery.trim();
                    if (onCreateOption) onCreateOption(newVal);
                    onChange(newVal);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className="w-full text-left px-3 py-3 text-sm text-blue-600 bg-blue-50/50 hover:bg-blue-100 border-t border-blue-100 flex items-center gap-3 group transition-all"
                >
                  <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                    <Plus size={16} strokeWidth={3} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black text-xs uppercase tracking-wider">Create New</span>
                    <span className="text-sm font-bold text-blue-800 truncate">"{searchQuery.trim()}"</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

