import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState('system');
    const [resolvedTheme, setResolvedTheme] = useState('light');
    const [fontPreset, setFontPreset] = useState('manrope-sora');

    // Load theme preference from localStorage on mount
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'system';
        const savedFontPreset = localStorage.getItem('fontPreset') || 'manrope-sora';
        setTheme(savedTheme);
        setFontPreset(savedFontPreset);
        applyTheme(savedTheme);
        applyFontPreset(savedFontPreset);
    }, []);

    // Listen for system theme changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (theme === 'system') {
                applyTheme('system');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    function applyTheme(themeToApply) {
        let actualTheme = themeToApply;

        if (themeToApply === 'system') {
            actualTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        setResolvedTheme(actualTheme);
        document.documentElement.setAttribute('data-theme', actualTheme);
        localStorage.setItem('theme', themeToApply);
    }

    function changeTheme(newTheme) {
        setTheme(newTheme);
        applyTheme(newTheme);
    }

    function applyFontPreset(preset) {
        document.documentElement.setAttribute('data-font', preset);
        localStorage.setItem('fontPreset', preset);
    }

    function changeFontPreset(newPreset) {
        setFontPreset(newPreset);
        applyFontPreset(newPreset);
    }

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, changeTheme, fontPreset, changeFontPreset }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}
