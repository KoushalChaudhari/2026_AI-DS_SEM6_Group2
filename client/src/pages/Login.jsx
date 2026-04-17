import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import api from '../api';
import Alert from '../components/Alert';

export default function Login() {
    const [form, setForm] = useState({ username: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const res = await api.post('/auth/login', form);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify({ username: res.data.username, role: res.data.role }));
            navigate('/', { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-page">
            <div className="card login-card">
                <div className="login-logo">
                    <div className="logo-icon"><Landmark size={40} /></div>
                    <h1>ACPCE Remuneration</h1>
                    <p>Sign in to continue</p>
                </div>
                {error && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}
                <form className="form-stack" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                            id="username"
                            className="form-control"
                            placeholder="Enter username"
                            value={form.username}
                            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                            autoComplete="username"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            id="password"
                            className="form-control"
                            type="password"
                            placeholder="Enter password"
                            value={form.password}
                            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                            autoComplete="current-password"
                            required
                        />
                    </div>
                    <button id="login-btn" className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4 }}>
                        {loading ? 'Signing in…' : '→ Sign In'}
                    </button>
                </form>
                <p className="text-muted text-center" style={{ marginTop: 20 }}>
                    Contact your administrator to get an account.
                </p>
            </div>
        </div>
    );
}
