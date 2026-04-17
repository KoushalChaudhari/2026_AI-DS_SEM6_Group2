import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export default function Alert({ type = 'error', children, onDismiss, dismissible = false }) {
    const icons = {
        error: <AlertCircle size={18} />,
        success: <CheckCircle size={18} />,
        info: <Info size={18} />
    };

    const colors = {
        error: {
            bg: 'rgba(239, 68, 68, 0.12)',
            border: 'rgba(239, 68, 68, 0.3)',
            text: '#fca5a5',
            icon: '#ef4444'
        },
        success: {
            bg: 'var(--alert-success-bg)',
            border: 'var(--alert-success-border)',
            text: 'var(--alert-success-text)',
            icon: '#16a34a'
        },
        info: {
            bg: 'rgba(6, 182, 212, 0.12)',
            border: 'rgba(6, 182, 212, 0.3)',
            text: '#67e8f9',
            icon: '#06b6d4'
        }
    };

    const style = colors[type] || colors.error;

    return (
        <div
            className="alert"
            style={{
                background: style.bg,
                border: `1px solid ${style.border}`,
                color: style.text,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                marginBottom: 12
            }}
        >
            <div style={{ flexShrink: 0, marginTop: 2, color: style.icon }}>
                {icons[type]}
            </div>
            <div style={{ flex: 1 }}>
                {children}
            </div>
            {dismissible && (
                <button
                    type="button"
                    onClick={onDismiss}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 4,
                        marginTop: -4,
                        marginRight: -4
                    }}
                >
                    <X size={16} />
                </button>
            )}
        </div>
    );
}
