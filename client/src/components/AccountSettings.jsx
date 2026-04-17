import React, { useEffect, useState } from 'react';
import { User, Lock, Palette, Type, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import api from '../api';

export default function AccountSettings({ user, isOpen, onClose }) {
    const { theme, changeTheme, fontPreset, changeFontPreset } = useTheme();
    const [activeTab, setActiveTab] = useState('profile');
    const [username, setUsername] = useState(user.username);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const fontPresets = [
        {
            key: 'manrope-sora',
            label: 'Modern',
            name: 'Manrope + Sora',
            sampleHeading: 'Modern Dashboard Clarity'
        },
        {
            key: 'ibm-plex',
            label: 'Enterprise',
            name: 'IBM Plex Sans',
            sampleHeading: 'Enterprise Reporting Focus'
        },
        {
            key: 'jakarta-merriweather',
            label: 'Premium',
            name: 'Plus Jakarta + Merriweather Sans',
            sampleHeading: 'Premium Structured Presentation'
        }
    ];

    useEffect(() => {
        if (isOpen) {
            setActiveTab('profile');
            setError('');
            setSuccess('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    async function handleUpdateUsername() {
        if (!username.trim()) {
            setError('Username cannot be empty.');
            return;
        }
        if (username === user.username) {
            setError('Username is the same as current.');
            return;
        }

        setError('');
        setSuccess('');
        setLoading(true);

        try {
            await api.put(`/auth/users/${user.user_id}/profile`, { username });
            // Update localStorage
            const updatedUser = { ...user, username };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setSuccess('Username updated successfully!');
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update username.');
        } finally {
            setLoading(false);
        }
    }

    async function handleChangePassword() {
        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('All password fields are required.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('New passwords do not match.');
            return;
        }
        if (newPassword.length < 6) {
            setError('New password must be at least 6 characters.');
            return;
        }

        setError('');
        setSuccess('');
        setLoading(true);

        try {
            await api.post(`/auth/users/${user.user_id}/change-password`, {
                current_password: currentPassword,
                new_password: newPassword
            });
            setSuccess('Password changed successfully! Please login again.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }, 2000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to change password.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Account Settings</h3>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="settings-tabs">
                    <button
                        className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('profile');
                            setError('');
                            setSuccess('');
                        }}
                    >
                        <User size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} /> Profile
                    </button>
                    <button
                        className={`settings-tab ${activeTab === 'password' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('password');
                            setError('');
                            setSuccess('');
                        }}
                    >
                        <Lock size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} /> Password
                    </button>
                    <button
                        className={`settings-tab ${activeTab === 'theme' ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab('theme');
                            setError('');
                            setSuccess('');
                        }}
                    >
                        <Palette size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} /> Theme
                    </button>
                </div>

                <div className="settings-content">
                    {/* Profile Tab */}
                    {activeTab === 'profile' && (
                        <div className="settings-panel">
                            <h4>Update Username</h4>
                            <div className="form-group">
                                <label>Current Username</label>
                                <input type="text" value={user.username} disabled className="form-control input-disabled" />
                            </div>
                            <div className="form-group">
                                <label>New Username</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter new username"
                                />
                            </div>
                            <div className="form-group">
                                <label>Role</label>
                                <input type="text" value={user.role} disabled className="form-control input-disabled" />
                                <small>Contact an administrator to change your role.</small>
                            </div>
                            {error && <div className="alert alert-error">{error}</div>}
                            {success && <div className="alert alert-success">{success}</div>}
                            <div className="form-actions">
                                <button
                                    className="btn btn-primary"
                                    onClick={handleUpdateUsername}
                                    disabled={loading || username === user.username}
                                >
                                    {loading ? 'Updating...' : 'Update Username'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Password Tab */}
                    {activeTab === 'password' && (
                        <div className="settings-panel">
                            <h4>Change Password</h4>
                            <div className="form-group">
                                <label>Current Password *</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                />
                            </div>
                            <div className="form-group">
                                <label>New Password *</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                />
                            </div>
                            <div className="form-group">
                                <label>Confirm New Password *</label>
                                <input
                                    type="password"
                                    className="form-control"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                />
                            </div>
                            {error && <div className="alert alert-error">{error}</div>}
                            {success && <div className="alert alert-success">{success}</div>}
                            <div className="form-actions">
                                <button
                                    className="btn btn-primary"
                                    onClick={handleChangePassword}
                                    disabled={loading}
                                >
                                    {loading ? 'Changing...' : 'Change Password'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Theme Tab */}
                    {activeTab === 'theme' && (
                        <div className="settings-panel">
                            <h4>Theme Preferences</h4>
                            <p className="theme-description">Choose your preferred theme for the interface.</p>
                            <div className="theme-options">
                                <div
                                    className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                                    onClick={() => changeTheme('light')}
                                >
                                    <div className="theme-preview theme-light">
                                        <div className="theme-bar"></div>
                                        <div className="theme-content"></div>
                                    </div>
                                    <div className="theme-label">
                                        <input
                                            type="radio"
                                            name="theme"
                                            value="light"
                                            checked={theme === 'light'}
                                            onChange={() => changeTheme('light')}
                                        />
                                        <span>Light</span>
                                    </div>
                                </div>

                                <div
                                    className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                                    onClick={() => changeTheme('dark')}
                                >
                                    <div className="theme-preview theme-dark">
                                        <div className="theme-bar"></div>
                                        <div className="theme-content"></div>
                                    </div>
                                    <div className="theme-label">
                                        <input
                                            type="radio"
                                            name="theme"
                                            value="dark"
                                            checked={theme === 'dark'}
                                            onChange={() => changeTheme('dark')}
                                        />
                                        <span>Dark</span>
                                    </div>
                                </div>

                                <div
                                    className={`theme-option ${theme === 'system' ? 'active' : ''}`}
                                    onClick={() => changeTheme('system')}
                                >
                                    <div className="theme-preview theme-system">
                                        <div className="theme-bar-left"></div>
                                        <div className="theme-bar-right"></div>
                                        <div className="theme-content"></div>
                                    </div>
                                    <div className="theme-label">
                                        <input
                                            type="radio"
                                            name="theme"
                                            value="system"
                                            checked={theme === 'system'}
                                            onChange={() => changeTheme('system')}
                                        />
                                        <span>System</span>
                                    </div>
                                </div>
                            </div>
                            <div className="theme-info">
                                <small>Current: {theme === 'system' ? `System (${document.documentElement.getAttribute('data-theme')})` : theme.charAt(0).toUpperCase() + theme.slice(1)}</small>
                            </div>

                            <div className="divider"></div>

                            <h4 style={{ marginBottom: '10px' }}><Type size={16} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} /> Typography</h4>
                            <p className="theme-description">Select a professional font pairing for the interface.</p>
                            <div className="form-group" style={{ maxWidth: '360px' }}>
                                <label htmlFor="fontPreset">Font Preset</label>
                                <select
                                    id="fontPreset"
                                    className="form-control"
                                    value={fontPreset}
                                    onChange={(e) => changeFontPreset(e.target.value)}
                                >
                                    <option value="manrope-sora">Modern: Manrope + Sora</option>
                                    <option value="ibm-plex">Enterprise: IBM Plex Sans</option>
                                    <option value="jakarta-merriweather">Premium: Plus Jakarta Sans + Merriweather Sans</option>
                                </select>
                            </div>

                            <div className="font-preview-grid">
                                {fontPresets.map((preset) => (
                                    <div
                                        key={preset.key}
                                        className={`font-preview-card ${fontPreset === preset.key ? 'active' : ''}`}
                                        onClick={() => changeFontPreset(preset.key)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                changeFontPreset(preset.key);
                                            }
                                        }}
                                    >
                                        <div className="font-preview-card-top">
                                            <span className="font-preview-badge">{preset.label}</span>
                                            {fontPreset === preset.key && (
                                                <span className="font-preview-active-mark">
                                                    <Check size={14} /> Active
                                                </span>
                                            )}
                                        </div>
                                        <div className="font-preview-demo" data-font={preset.key}>
                                            <h5>{preset.sampleHeading}</h5>
                                            <p>Voucher tables, room allocations, and account settings remain easy to scan.</p>
                                            <div className="font-preview-meta">Sample Label</div>
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    changeFontPreset(preset.key);
                                                }}
                                            >
                                                Use {preset.name}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
