import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

function buildFallbackUser() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdminUsername = String(user.username || '').toLowerCase() === 'admin';
    const isAdminRole = String(user.role || '').toLowerCase() === 'admin';
    return {
        user_id: user.user_id || null,
        username: user.username || '',
        role: user.role || (isAdminUsername ? 'admin' : 'user'),
        roles: (isAdminRole || isAdminUsername) ? ['ADMIN'] : ['STAFF'],
        permissions: {},
        branch_id: null,
        staff_profile: null
    };
}

export function AuthProvider({ children }) {
    const [authState, setAuthState] = useState({
        loading: true,
        user: buildFallbackUser()
    });

    async function refreshAuth() {
        const token = localStorage.getItem('token');
        if (!token) {
            setAuthState({ loading: false, user: buildFallbackUser() });
            return;
        }

        try {
            const res = await api.get('/auth/me');
            const payload = {
                ...res.data,
                roles: Array.isArray(res.data.roles) ? res.data.roles : [],
                permissions: res.data.permissions || {}
            };
            localStorage.setItem('user', JSON.stringify({
                user_id: payload.user_id,
                username: payload.username,
                role: payload.role
            }));
            setAuthState({ loading: false, user: payload });
        } catch (err) {
            setAuthState({ loading: false, user: buildFallbackUser() });
        }
    }

    useEffect(() => {
        refreshAuth();
    }, []);

    const value = useMemo(() => {
        const user = authState.user;
        const permissionMap = user.permissions || {};
        const isAdminAccount =
            String(user.username || '').toLowerCase() === 'admin'
            || String(user.role || '').toLowerCase() === 'admin'
            || (user.roles || []).includes('ADMIN');

        const hasRole = (roleName) => {
            const normalized = String(roleName).toUpperCase();
            if (normalized === 'ADMIN' && isAdminAccount) return true;
            return (user.roles || []).includes(normalized);
        };
        const hasPermission = (key) => {
            if (isAdminAccount) return true;
            return Boolean(permissionMap[key]);
        };

        return {
            loading: authState.loading,
            user,
            isAdminAccount,
            refreshAuth,
            hasRole,
            hasPermission
        };
    }, [authState]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return ctx;
}
