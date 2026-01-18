import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'days' | 'months' | 'years'>('days');
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Parse current date or default to today
  const selectedDate = value ? new Date(value) : new Date();
  const [viewDate, setViewDate] = useState(new Date(selectedDate));
  
  // Year grid start year (for 'years' view)
  const [startYear, setStartYear] = useState(viewDate.getFullYear() - 4);

  // Sync internal input text when external value changes
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const formatted = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        setInputValue(formatted);
        setViewDate(new Date(date));
      }
    } else {
      setInputValue('');
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const formatDateToISO = (date: Date) => {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    onChange(formatDateToISO(newDate));
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // Try to parse DD/MM/YYYY
    const parts = val.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);

      if (year > 1000 && month >= 0 && month < 12 && day > 0 && day <= 31) {
        const parsedDate = new Date(year, month, day);
        if (!isNaN(parsedDate.getTime())) {
          onChange(formatDateToISO(parsedDate));
          setViewDate(new Date(parsedDate));
        }
      }
    }
  };

  const changeMonth = (offset: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  const changeYearRange = (offset: number) => {
    setStartYear(prev => prev + offset);
  };

  const handleMonthSelect = (monthIndex: number) => {
    setViewDate(new Date(viewDate.getFullYear(), monthIndex, 1));
    setViewMode('days');
  };

  const handleYearSelect = (year: number) => {
    setViewDate(new Date(year, viewDate.getMonth(), 1));
    setViewMode('months');
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const renderDaysView = () => {
    const days = [];
    const totalDays = daysInMonth(viewDate.getFullYear(), viewDate.getMonth());
    const startDay = firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth());

    // Padding for start of month
    for (let i = 0; i < startDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-8 w-8" />);
    }

    // Actual days
    for (let i = 1; i <= totalDays; i++) {
      const isSelected = value && 
        selectedDate.getDate() === i && 
        selectedDate.getMonth() === viewDate.getMonth() && 
        selectedDate.getFullYear() === viewDate.getFullYear();
      
      const isToday = new Date().getDate() === i && 
        new Date().getMonth() === viewDate.getMonth() && 
        new Date().getFullYear() === viewDate.getFullYear();

      days.push(
        <button
          key={i}
          type="button"
          onClick={() => handleDateClick(i)}
          className={`h-8 w-8 rounded-lg text-xs font-bold transition-all flex items-center justify-center
            ${isSelected ? 'bg-blue-600 text-white shadow-md' : 
              isToday ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'hover:bg-gray-100 text-gray-700'}`}
        >
          {i}
        </button>
      );
    }

    return (
      <>
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={() => changeMonth(-1)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronLeft size={18} /></button>
          <button 
            type="button" 
            onClick={() => setViewMode('months')}
            className="text-sm font-black text-gray-800 uppercase tracking-tight hover:text-blue-600 transition-colors"
          >
            {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
          </button>
          <button type="button" onClick={() => changeMonth(1)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronRight size={18} /></button>
        </div>
        
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="h-8 w-8 flex items-center justify-center text-[10px] font-black text-gray-400 uppercase">{d}</div>
          ))}
          {days}
        </div>
      </>
    );
  };

  const renderMonthsView = () => {
    return (
      <>
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1))} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronLeft size={18} /></button>
          <button 
            type="button" 
            onClick={() => { setStartYear(viewDate.getFullYear() - 4); setViewMode('years'); }}
            className="text-sm font-black text-gray-800 uppercase tracking-tight hover:text-blue-600 transition-colors"
          >
            {viewDate.getFullYear()}
          </button>
          <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1))} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {shortMonthNames.map((name, index) => (
            <button
              key={name}
              type="button"
              onClick={() => handleMonthSelect(index)}
              className={`py-3 rounded-lg text-xs font-bold transition-all
                ${viewDate.getMonth() === index ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-100 text-gray-700'}`}
            >
              {name}
            </button>
          ))}
        </div>
      </>
    );
  };

  const renderYearsView = () => {
    const years = [];
    for (let i = 0; i < 12; i++) {
      const year = startYear + i;
      years.push(
        <button
          key={year}
          type="button"
          onClick={() => handleYearSelect(year)}
          className={`py-3 rounded-lg text-xs font-bold transition-all
            ${viewDate.getFullYear() === year ? 'bg-blue-600 text-white shadow-md' : 'hover:bg-gray-100 text-gray-700'}`}
        >
          {year}
        </button>
      );
    }

    return (
      <>
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={() => changeYearRange(-12)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronLeft size={18} /></button>
          <div className="text-sm font-black text-gray-800 uppercase tracking-tight">
            {startYear} - {startYear + 11}
          </div>
          <button type="button" onClick={() => changeYearRange(12)} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {years}
        </div>
      </>
    );
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div 
        className="flex items-center gap-3 px-3 py-2 bg-white border border-gray-300 rounded-lg cursor-text hover:border-blue-400 transition-all shadow-sm group focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500"
      >
        <CalendarIcon 
          size={18} 
          onClick={() => { setIsOpen(!isOpen); if(!isOpen) setViewMode('days'); }}
          className={`cursor-pointer transition-colors ${isOpen ? 'text-blue-600' : 'text-gray-400 group-hover:text-blue-500'}`} 
        />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => { setIsOpen(true); setViewMode('days'); }}
          placeholder="DD/MM/YYYY"
          className="text-sm flex-1 bg-transparent border-none outline-none p-0 text-gray-800 font-medium placeholder:text-gray-400"
        />
        {value && (
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); onChange(''); setInputValue(''); }}
            className="p-0.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 p-4 bg-white border border-gray-200 rounded-xl shadow-2xl z-[100] w-64 animate-in fade-in zoom-in-95 duration-200 origin-top">
          {viewMode === 'days' && renderDaysView()}
          {viewMode === 'months' && renderMonthsView()}
          {viewMode === 'years' && renderYearsView()}

          <div className="border-t border-gray-100 mt-2 pt-2 flex justify-between">
            <button 
              type="button" 
              onClick={() => { setViewDate(new Date()); handleDateClick(new Date().getDate()); setViewMode('days'); }}
              className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest"
            >
              Today
            </button>
            <button 
              type="button" 
              onClick={() => { onChange(''); setIsOpen(false); setViewMode('days'); }}
              className="text-[10px] font-black text-gray-400 hover:text-gray-600 uppercase tracking-widest"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

