import React, { useState, useEffect } from 'react';
import { X, Database, CheckCircle2, AlertCircle, Globe, Zap, ArrowRight, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * WelcomeModal Component
 * Shows on first visit or when database connection fails.
 */
const WelcomeModal: React.FC = () => {
    const { projects, appLoading } = useApp();
    const [isOpen, setIsOpen] = useState(false);
    const [isDbConnected, setIsDbConnected] = useState<boolean | null>(null);
    const [dbUrl, setDbUrl] = useState('');
    const [checking, setChecking] = useState(false);
    const [step, setStep] = useState<'welcome' | 'setup'>('welcome');

    useEffect(() => {
        const hasSeenWelcome = localStorage.getItem('koge_welcome_seen');
        const storedDbUrl = localStorage.getItem('koge_api_base_url') || '';
        setDbUrl(storedDbUrl);

        // If never seen welcome OR projects is null (connection error)
        if (!hasSeenWelcome || projects === null) {
            setIsOpen(true);
            if (projects === null) {
                setIsDbConnected(false);
                setStep('setup');
            } else {
                setIsDbConnected(true);
            }
        }
    }, [projects]);

    const handleGetStarted = () => {
        localStorage.setItem('koge_welcome_seen', 'true');
        if (isDbConnected) {
            setIsOpen(false);
        } else {
            setStep('setup');
        }
    };

    const handleSaveDb = () => {
        if (!dbUrl.trim()) return;
        setChecking(true);
        
        // Save to localStorage and reload to apply changes in db.ts
        localStorage.setItem('koge_api_base_url', dbUrl.trim());
        localStorage.setItem('koge_welcome_seen', 'true');
        
        // Give a small delay for visual feedback
        setTimeout(() => {
            window.location.reload();
        }, 800);
    };

    if (!isOpen || appLoading) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white md:rounded-2xl shadow-2xl w-full h-full md:h-auto md:max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">
                {/* Header Gradient */}
                <div className="h-32 bg-gradient-to-br from-blue-600 to-indigo-700 relative flex items-center justify-center">
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shadow-xl border border-white/30">
                        {step === 'welcome' ? <Zap size={32} fill="currentColor" /> : <Database size={32} />}
                    </div>
                </div>

                <div className="p-8 flex-1 overflow-y-auto">
                    {step === 'welcome' ? (
                        <div className="text-center animate-in slide-in-from-bottom-4 duration-500">
                            <h2 className="text-3xl font-black text-gray-800 mb-3 tracking-tight">Welcome to Koge Kanban</h2>
                            <p className="text-gray-500 mb-8 leading-relaxed">
                                Experience the next generation of task management with integrated AI and seamless database synchronization.
                            </p>
                            
                            <div className="space-y-4 mb-10 text-left">
                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-blue-50 border border-blue-100">
                                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-sm"><CheckCircle2 size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-blue-900 text-sm">Database Sync</h4>
                                        <p className="text-xs text-blue-700/70">Automatic cloud saving for all your boards and tasks.</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4 p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm"><Zap size={18} /></div>
                                    <div>
                                        <h4 className="font-bold text-indigo-900 text-sm">AI Powered</h4>
                                        <p className="text-xs text-indigo-700/70">Generate subtasks, summaries, and chat with your projects.</p>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={handleGetStarted}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 group active:scale-[0.98]"
                            >
                                Get Started <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    ) : (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-2 mb-4">
                                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isDbConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {isDbConnected ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                                    {isDbConnected ? 'Connected' : 'Connection Failed'}
                                </span>
                            </div>
                            
                            <h2 className="text-2xl font-black text-gray-800 mb-2">Database Configuration</h2>
                            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                                We couldn't reach the default database. If you have a custom database server, please enter the domain and port below.
                            </p>

                            <div className="space-y-5">
                                <div className="group">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">API Base Domain / URL</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
                                            <Globe size={18} />
                                        </div>
                                        <input 
                                            type="text" 
                                            placeholder="https://your-database-domain.com" 
                                            value={dbUrl}
                                            onChange={(e) => setDbUrl(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 transition-all font-medium"
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-2 ml-1 italic">Example: http://192.168.1.5:3000 or https://api.yourdomain.com</p>
                                </div>

                                <button 
                                    onClick={handleSaveDb}
                                    disabled={checking || !dbUrl.trim()}
                                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {checking ? <Loader2 size={20} className="animate-spin" /> : <Database size={20} />}
                                    {checking ? 'Connecting...' : 'Save & Connect'}
                                </button>
                                
                                {isDbConnected && (
                                    <button 
                                        onClick={() => setIsOpen(false)}
                                        className="w-full bg-white border border-gray-200 text-gray-500 font-bold py-3 rounded-2xl hover:bg-gray-50 transition-all text-sm"
                                    >
                                        Use Default & Continue
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex justify-center">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">Koge Kanban v2.0 • Data is stored securely</p>
                </div>
            </div>
        </div>
    );
};

export default WelcomeModal;

