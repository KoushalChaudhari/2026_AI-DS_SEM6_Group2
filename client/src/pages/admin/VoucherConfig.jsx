import { Link } from 'react-router-dom';
import { Folder, FileText, UserCheck, CreditCard, Banknote, ClipboardList, Settings } from 'lucide-react';

const voucherConfigLinks = [
    { to: '/admin/categories', icon: <Folder size={20} />, title: 'Categories', description: 'Manage remuneration categories.' },
    { to: '/admin/titles', icon: <FileText size={20} />, title: 'Titles', description: 'Manage titles under categories.' },
    { to: '/admin/examiner-types', icon: <UserCheck size={20} />, title: 'Examiner Types', description: 'Configure examiner types.' },
    { to: '/admin/payment-units', icon: <CreditCard size={20} />, title: 'Payment Units', description: 'Set payment units for calculations.' },
    { to: '/admin/remuneration-rates', icon: <Banknote size={20} />, title: 'Remuneration Rates', description: 'Maintain practical remuneration rates.' },
    { to: '/admin/theory-rates', icon: <ClipboardList size={20} />, title: 'Theory Rates', description: 'Maintain theory exam rates.' },
    { to: '/admin/rules', icon: <Settings size={20} />, title: 'System Rules', description: 'Set voucher calculation rules.' },
];

export default function VoucherConfig() {
    return (
        <div className="page-container">
            <div className="page-header">
                <h2><FileText size={24} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '8px' }} /> Voucher Config</h2>
                <p>All voucher-related admin configurations in one place.</p>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '16px'
                }}
            >
                {voucherConfigLinks.map((item) => (
                    <Link
                        key={item.to}
                        to={item.to}
                        className="card"
                        style={{ textDecoration: 'none', color: 'var(--text)', display: 'block' }}
                    >
                        <div style={{ fontSize: '1.25rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {item.icon} {item.title}
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.9rem' }}>
                            {item.description}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
