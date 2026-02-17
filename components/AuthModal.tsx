import React, { useState } from 'react';
import { User, Lock, Mail, ArrowRight, ShieldCheck, Ghost, LogIn, UserPlus, Loader2, Globe } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type AuthMode = 'welcome' | 'endpoint' | 'login' | 'signup';

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
    const { login, register, guestLogin } = useApp();
    const [mode, setMode] = useState<AuthMode>('welcome');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [endpoint, setEndpoint] = useState(localStorage.getItem('koge_api_base_url') || 'http://localhost:3000/api');
    const [isTestingEndpoint, setIsTestingEndpoint] = useState(false);

    if (!isOpen) return null;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            await login(username, password);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            await register(username, email, password);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGuest = () => {
        guestLogin();
        onClose();
    };

    const handleVerifyEndpoint = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsTestingEndpoint(true);

        const normalized = endpoint.trim().replace(/\/+$/, '');

        try {
            const { db } = await import('../services/db');
            const isOk = await db.testConnection(normalized);
            if (isOk) {
                localStorage.setItem('koge_api_base_url', normalized);
                setMode('login'); // Default to login as users likely already have an account
            } else {
                setError('Could not connect to database at this endpoint. Please ensure the server is running.');
            }
        } catch (err) {
            setError('Invalid endpoint URL.');
        } finally {
            setIsTestingEndpoint(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-500 relative">

                {/* Decorative Background - Changed to Blue */}
                <div className="absolute top-0 left-0 w-full h-48 bg-blue-600 rounded-b-[50%] scale-x-150 translate-y-[-50%] z-0" />

                <div className="relative z-10 p-8 pt-12">
                    <div className="flex justify-center mb-6">
                        <div className="bg-white p-4 rounded-2xl shadow-xl ring-4 ring-blue-50">
                            <ShieldCheck className="w-8 h-8 text-blue-600" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-black text-center text-slate-800 mb-2">
                        {mode === 'welcome' && "Welcome to Koge"}
                        {mode === 'endpoint' && "Connect Database"}
                        {mode === 'login' && "Welcome Back"}
                        {mode === 'signup' && "Create Account"}
                    </h2>

                    <p className="text-center text-slate-500 text-sm mb-8 px-4 leading-relaxed">
                        {mode === 'welcome' && "Secure your workspace or continue as a guest to inspect the board."}
                        {mode === 'endpoint' && "Enter your server endpoint to link your data."}
                        {mode === 'login' && "Enter your credentials to access your secure workspace."}
                        {mode === 'signup' && "Set up your secure profile to sync your tasks across devices."}
                    </p>

                    {/* ERROR ALERT */}
                    {error && (
                        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold text-center animate-shake flex items-center justify-center gap-2">
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                            {error}
                        </div>
                    )}

                    {/* WELCOME MODE */}
                    {mode === 'welcome' && (
                        <div className="space-y-4">
                            <button
                                onClick={() => setMode('endpoint')}
                                className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold text-sm shadow-xl shadow-slate-200 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <LogIn size={18} />
                                Login / Sign Up
                            </button>

                            <div className="relative flex items-center py-2">
                                <div className="flex-grow border-t border-slate-100"></div>
                                <span className="flex-shrink-0 mx-4 text-slate-300 text-[10px] font-bold uppercase tracking-widest">OR</span>
                                <div className="flex-grow border-t border-slate-100"></div>
                            </div>

                            <button
                                onClick={handleGuest}
                                className="w-full py-4 bg-white border-2 border-slate-100 hover:border-slate-200 text-slate-600 hover:text-slate-800 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 transition-all hover:bg-slate-50"
                            >
                                <Ghost size={18} />
                                Continue as Guest
                            </button>
                        </div>
                    )}

                    {/* ENDPOINT CONFIG MODE */}
                    {mode === 'endpoint' && (
                        <form onSubmit={handleVerifyEndpoint} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Database Endpoint</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors">
                                        <Globe className="w-[18px] h-[18px]" />
                                    </div>
                                    <input
                                        type="text"
                                        value={endpoint}
                                        onChange={e => setEndpoint(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
                                        placeholder="http://localhost:3000/api"
                                        required
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 italic px-1">Ensure your database server is running before connecting.</p>
                            </div>

                            <button
                                type="submit"
                                disabled={isTestingEndpoint}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-100 flex items-center justify-center gap-2 transition-all transform hover:translate-y-[-1px] active:translate-y-[1px]"
                            >
                                {isTestingEndpoint ? <Loader2 size={18} className="animate-spin" /> : <>Connect & Continue <ArrowRight size={18} /></>}
                            </button>
                        </form>
                    )}

                    {/* LOGIN FORM */}
                    {mode === 'login' && (
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Username or Email</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors">
                                        <User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:text-slate-300"
                                        placeholder="Enter your username or email"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:text-slate-300"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-100 flex items-center justify-center gap-2 transition-all transform hover:translate-y-[-1px] active:translate-y-[1px]"
                            >
                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <>Sign In <ArrowRight size={18} /></>}
                            </button>

                            <div className="pt-4 text-center">
                                <button
                                    type="button"
                                    onClick={() => setMode('signup')}
                                    className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors"
                                >
                                    Don't have an account? Sign up
                                </button>
                            </div>
                        </form>
                    )}

                    {/* SIGNUP FORM */}
                    {mode === 'signup' && (
                        <form onSubmit={handleSignup} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Username</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors">
                                        <User size={18} />
                                    </div>
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:text-slate-300"
                                        placeholder="Choose a username"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors">
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:text-slate-300"
                                        placeholder="Enter your email address"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
                                <div className="relative group">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors">
                                        <Lock size={18} />
                                    </div>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:text-slate-300"
                                        placeholder="Create a strong password"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-4 mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-100 flex items-center justify-center gap-2 transition-all transform hover:translate-y-[-1px] active:translate-y-[1px]"
                            >
                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <>Create Account <UserPlus size={18} /></>}
                            </button>

                            <div className="pt-4 text-center">
                                <button
                                    type="button"
                                    onClick={() => setMode('login')}
                                    className="text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors"
                                >
                                    Already have an account? Login
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Back Button for Login/Signup */}
                    {mode !== 'welcome' && (
                        <div className="absolute top-6 left-6">
                            <button
                                onClick={() => setMode('welcome')}
                                className="text-white/50 hover:text-white transition-colors text-xs font-bold flex items-center gap-1"
                            >
                                ← Back
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
