export default function Forbidden() {
    return (
        <div className="card" style={{ maxWidth: 760, margin: '24px auto' }}>
            <div className="page-header">
                <div>
                    <div className="page-title">403 Forbidden</div>
                    <div className="page-subtitle">
                        You do not have access to Voucher Generation. This module is available only for ADMIN and CLERK roles.
                    </div>
                </div>
            </div>
        </div>
    );
}
