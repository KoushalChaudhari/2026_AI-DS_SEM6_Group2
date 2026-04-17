import { Link } from 'react-router-dom';

export default function VoucherConfigBackButton() {
    return (
        <div style={{ marginBottom: 12 }}>
            <Link to="/admin/voucher-config" className="btn btn-secondary btn-sm">
                &lt; Back
            </Link>
        </div>
    );
}