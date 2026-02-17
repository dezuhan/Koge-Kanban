import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    Trash2,
    ShieldAlert,
    Database,
    ChevronLeft,
    User,
    Mail,
    Calendar,
    Search,
    RefreshCw,
    AlertTriangle,
    Plus,
    X,
    Lock,
    Key
} from 'lucide-react';
import { useApp } from '../context/AppContext';

interface UserRecord {
    id: number;
    username: string;
    email: string;
    created_at: number;
}

const AdminPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, alert: globalAlert, confirm: globalConfirm } = useApp();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Create User Form State
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newUserData, setNewUserData] = useState({
        username: '',
        email: '',
        password: ''
    });

    // Reset Password State
    const [resettingUser, setResettingUser] = useState<UserRecord | null>(null);
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        // Redirection if not admin (ID 1)
        if (user && user.id !== 1) {
            navigate('/');
            return;
        }
        fetchUsers();
    }, [user, navigate]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const { db } = await import('../services/db');
            const data = await db.admin.getUsers();
            setUsers(data || []);
        } catch (e) {
            console.error("Failed to fetch users", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserData.username || !newUserData.email || !newUserData.password) {
            globalAlert({ title: 'Error', message: 'All fields are required.', type: 'danger' });
            return;
        }

        setIsActionLoading(true);
        try {
            const { db } = await import('../services/db');
            await db.admin.createUser(newUserData);
            globalAlert({
                title: 'User Created',
                message: `Account for ${newUserData.username} has been created successfully.`,
                type: 'info'
            });
            setShowCreateForm(false);
            setNewUserData({ username: '', email: '', password: '' });
            fetchUsers();
        } catch (e: any) {
            globalAlert({ title: 'Error', message: e.message || 'Failed to create user.', type: 'danger' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resettingUser || !newPassword) return;

        if (newPassword.length < 6) {
            globalAlert({ title: 'Weak Password', message: 'Password must be at least 6 characters.', type: 'danger' });
            return;
        }

        setIsActionLoading(true);
        try {
            const { db } = await import('../services/db');
            await db.admin.resetUserPassword(resettingUser.id, newPassword);
            globalAlert({ title: 'Password Updated', message: `Password for ${resettingUser.username} has been reset successfully.`, type: 'info' });
            setResettingUser(null);
            setNewPassword('');
        } catch (e: any) {
            globalAlert({ title: 'Error', message: e.message || 'Failed to reset password.', type: 'danger' });
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDeleteUser = (u: UserRecord) => {
        if (u.id === 1) return;

        globalConfirm({
            title: `Delete User: ${u.username}?`,
            message: `Are you sure you want to permanently delete this user and ALL their data? This action is irreversible.`,
            type: 'danger',
            confirmText: 'Delete User',
            onConfirm: async () => {
                setIsActionLoading(true);
                try {
                    const { db } = await import('../services/db');
                    await db.admin.deleteUser(u.id);
                    globalAlert({ title: 'User Deleted', message: `User ${u.username} has been removed from the system.`, type: 'info' });
                    fetchUsers();
                } catch (e: any) {
                    globalAlert({ title: 'Error', message: e.message || 'Failed to delete user.', type: 'danger' });
                } finally {
                    setIsActionLoading(false);
                }
            }
        });
    };

    const handleResetSystem = () => {
        globalConfirm({
            title: 'WIPE ENTIRE SYSTEM?',
            message: 'CRITICAL ACTION: This will delete ALL users (except you) and ALL project data from the entire database. This is a fresh start reset. ARE YOU ABSOLUTELY SURE?',
            type: 'danger',
            confirmText: 'Wipe Everything',
            onConfirm: async () => {
                setIsActionLoading(true);
                try {
                    const { db } = await import('../services/db');
                    await db.admin.resetSystem();
                    globalAlert({
                        title: 'System Wiped',
                        message: 'All system data has been cleared. You are the only user left.',
                        type: 'info'
                    });
                    fetchUsers();
                } catch (e: any) {
                    globalAlert({ title: 'Error', message: e.message || 'Reset failed.', type: 'danger' });
                } finally {
                    setIsActionLoading(false);
                }
            }
        });
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (user?.id !== 1) return null;

    return (
        <div className="min-h-screen bg-slate-50 pb-12">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/settings', { replace: true })}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                                <ShieldAlert size={20} />
                            </div>
                            <div>
                                <h1 className="text-lg font-black text-slate-800 tracking-tight">System Admin</h1>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Management Console</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowCreateForm(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-tight hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
                        >
                            <Plus size={14} />
                            Create User
                        </button>
                        <button
                            onClick={handleResetSystem}
                            disabled={isActionLoading}
                            className="px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl text-xs font-black uppercase tracking-tight hover:bg-rose-100 transition-all flex items-center gap-2"
                        >
                            <Trash2 size={14} />
                            Wipe Database
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 mt-8 space-y-8">
                {/* Create User Modal */}
                {showCreateForm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowCreateForm(false)} />
                        <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                        <User size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800">New User Account</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Administrator Portal</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowCreateForm(false)}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <User size={12} />
                                        Username
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={newUserData.username}
                                        onChange={e => setNewUserData({ ...newUserData, username: e.target.value })}
                                        placeholder="e.g. john_doe"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Mail size={12} />
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={newUserData.email}
                                        onChange={e => setNewUserData({ ...newUserData, email: e.target.value })}
                                        placeholder="john@example.com"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Lock size={12} />
                                        Set Password
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        value={newUserData.password}
                                        onChange={e => setNewUserData({ ...newUserData, password: e.target.value })}
                                        placeholder="••••••••"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold placeholder:text-slate-300 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={isActionLoading}
                                        className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-tight hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isActionLoading ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />}
                                        Initialize Account
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                            <Users size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Users</p>
                            <h3 className="text-2xl font-black text-slate-800">{users.length}</h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <Calendar size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">New Today</p>
                            <h3 className="text-2xl font-black text-slate-800">
                                {users.filter(u => new Date(u.created_at).toDateString() === new Date().toDateString()).length}
                            </h3>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                            <Database size={24} />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status</p>
                            <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                                Online
                                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            </h3>
                        </div>
                    </div>
                </div>

                {/* User List Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-black text-slate-800">Registered Users</h2>
                            <p className="text-xs text-slate-400 font-medium">Monitor and manage all application accounts</p>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all w-full md:w-80 font-medium"
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">User Details</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Email Address</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Joined On</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-20 text-center">
                                            <RefreshCw className="mx-auto text-indigo-500 animate-spin mb-3" size={32} />
                                            <p className="text-sm font-bold text-slate-400">Loading user database...</p>
                                        </td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-20 text-center">
                                            <Users className="mx-auto text-slate-200 mb-3" size={48} />
                                            <p className="text-sm font-bold text-slate-400">No users found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredUsers.map((u) => (
                                        <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${u.id === 1 ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                                        {u.username.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-black text-slate-800">{u.username}</span>
                                                            <span className="text-[10px] font-bold text-slate-400 text-slate-400/50">ID: {u.id}</span>
                                                            {u.id === 1 && (
                                                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-black rounded uppercase tracking-tighter border border-indigo-100">Owner</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                                                            <User size={12} />
                                                            {u.id === 1 ? 'Administrator' : 'General User'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                                                    <Mail size={14} className="text-slate-300" />
                                                    {u.email}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-slate-500 uppercase">
                                                    {new Date(u.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </div>
                                                <div className="text-[10px] text-slate-300 font-bold tracking-tight">
                                                    {new Date(u.created_at).toLocaleTimeString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                                                {u.id !== 1 ? (
                                                    <>
                                                        <button
                                                            onClick={() => setResettingUser(u)}
                                                            className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"
                                                            title="Reset user password"
                                                        >
                                                            <Key size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteUser(u)}
                                                            disabled={isActionLoading}
                                                            className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                                                            title="Delete user data"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <div className="text-[10px] font-black text-indigo-400/50 uppercase tracking-widest px-2">Protected</div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Reset Password Modal */}
                {resettingUser && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setResettingUser(null)} />
                        <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                                        <Key size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800">Security Reset</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">User: {resettingUser.username}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setResettingUser(null)}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleResetPassword} className="p-6 space-y-5">
                                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                                    <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-xs font-bold text-amber-700 leading-relaxed">
                                        This will immediately change the password for <strong>{resettingUser.username}</strong>. They will need to use this new password for their next login.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Lock size={12} />
                                        New Security Password
                                    </label>
                                    <input
                                        type="password"
                                        required
                                        autoFocus
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="Min. 6 characters"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold placeholder:text-slate-300 focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 outline-none transition-all"
                                    />
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={isActionLoading}
                                        className="w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-black uppercase tracking-tight hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isActionLoading ? <RefreshCw className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                                        Update Password
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* System Warning */}
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4 shadow-sm shadow-amber-100/50">
                    <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                        <AlertTriangle size={20} />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-amber-800 uppercase tracking-tight mb-1">Administrator Privileges Active</h4>
                        <p className="text-xs text-amber-700 leading-relaxed font-medium">
                            You are logged in as the system owner (ID 1). You have absolute control over all data records.
                            Actions taken on this page cannot be undone. Always verify user identities before performing account deletions.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminPage;
