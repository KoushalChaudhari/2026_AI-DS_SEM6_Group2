import { useState, useEffect, useMemo } from 'react';
import { Pencil, Search } from 'lucide-react';
import api from '../../api';

export default function AdminRooms() {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingRoom, setEditingRoom] = useState(null);
    const [editCapacity, setEditCapacity] = useState('');
    const [editIsDefault, setEditIsDefault] = useState(false);
    const [activeFloor, setActiveFloor] = useState('Ground');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            const res = await api.get('/rooms');
            setRooms(res.data);
            setLoading(false);
            // Set initial active floor if available
            if (res.data.length > 0) {
                const floors = [...new Set(res.data.map(r => r.floor_name))];
                if (floors.length > 0 && !floors.includes(activeFloor)) {
                    setActiveFloor(floors[0]);
                }
            }
        } catch (err) {
            console.error(err);
            setError('Failed to fetch rooms');
            setLoading(false);
        }
    };

    const handleEdit = (room) => {
        setEditingRoom(room.room_id);
        setEditCapacity(room.bench_capacity);
        setEditIsDefault(room.is_default || false);
    };

    const handleSave = async (id) => {
        if (!editCapacity || isNaN(editCapacity) || parseInt(editCapacity) <= 0) {
            alert('Please enter a valid positive number for bench capacity.');
            return;
        }

        try {
            await api.put(`/rooms/${id}`, { 
                benchCapacity: parseInt(editCapacity),
                isDefault: editIsDefault
            });
            setEditingRoom(null);
            fetchRooms(); // refresh list
        } catch (err) {
            console.error(err);
            alert('Failed to update room capacity');
        }
    };

    const handleCancel = () => {
        setEditingRoom(null);
        setEditCapacity('');
        setEditIsDefault(false);
    };

    // Get unique floors for tabs
    const floors = useMemo(() => {
        const uniqueFloors = [...new Set(rooms.map(r => r.floor_name))];
        // Custom sort to ensure Ground is first, then 1st, 2nd, etc.
        return uniqueFloors.sort((a, b) => {
            if (a === 'Ground') return -1;
            if (b === 'Ground') return 1;
            return a.localeCompare(b, undefined, { numeric: true });
        });
    }, [rooms]);

    // Filter rooms based on active floor and search query
    const filteredRooms = useMemo(() => {
        return rooms.filter(room =>
            room.floor_name === activeFloor &&
            (room.room_number.toLowerCase().includes(searchQuery.toLowerCase()))
        );
    }, [rooms, activeFloor, searchQuery]);

    // Stats for the active floor
    const floorStats = useMemo(() => {
        const floorRooms = rooms.filter(r => r.floor_name === activeFloor);
        return {
            total: floorRooms.length,
            capacity: floorRooms.reduce((sum, r) => sum + r.bench_capacity, 0)
        };
    }, [rooms, activeFloor]);

    if (loading) return (
        <div className="admin-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <div className="p-card">Loading Campus Rooms...</div>
        </div>
    );

    if (error) return <div className="p-card error-msg">{error}</div>;

    return (
        <div className="admin-page" style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <header className="page-header" style={{ marginBottom: '32px' }}>
                <div>
                    <h2 className="page-title" style={{ fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
                        Manage Campus Rooms
                    </h2>
                    <p className="page-subtitle" style={{ fontSize: '14px', marginTop: '6px' }}>
                        Configure bench capacities for 175 rooms across {floors.length} floors.
                    </p>
                </div>

                <div style={{ position: 'relative', width: '300px' }}>
                    <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-3)' }}>
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search Room Number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            padding: '12px 16px 12px 40px',
                            borderRadius: '12px',
                            background: 'var(--surface)',
                            boxShadow: 'var(--shadow-sm)',
                            border: '1px solid var(--border)'
                        }}
                    />
                </div>
            </header>

            {/* Stats Bar */}
            <div style={{
                display: 'flex',
                gap: '24px',
                marginBottom: '24px',
                padding: '16px 24px',
                background: 'var(--surface-2)',
                borderRadius: '16px',
                border: '1px solid var(--border)'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: '700' }}>Active Floor</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--primary)' }}>{activeFloor} Floor</span>
                </div>
                <div style={{ width: '1px', background: 'var(--border)', margin: '0 8px' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: '700' }}>Total Rooms</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '700' }}>{floorStats.total}</span>
                </div>
                <div style={{ width: '1px', background: 'var(--border)', margin: '0 8px' }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: '700' }}>Total Bench Capacity</span>
                    <span style={{ fontSize: '1.2rem', fontWeight: '700' }}>{floorStats.capacity}</span>
                </div>
            </div>

            {/* Floor Tabs */}
            <div style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '24px',
                overflowX: 'auto',
                paddingBottom: '8px',
                scrollbarWidth: 'none'
            }}>
                {floors.map(floor => (
                    <button
                        key={floor}
                        onClick={() => setActiveFloor(floor)}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '10px',
                            background: activeFloor === floor ? 'var(--primary)' : 'var(--surface)',
                            color: activeFloor === floor ? 'var(--surface)' : 'var(--text-2)',
                            fontWeight: '600',
                            fontSize: '13px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: activeFloor === floor ? 'var(--shadow)' : 'var(--shadow-sm)',
                            transition: 'all 0.2s ease',
                            border: activeFloor === floor ? '1px solid var(--primary)' : '1px solid var(--border)'
                        }}
                    >
                        {floor} Floor
                    </button>
                ))}
            </div>

            {/* Rooms Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '20px',
                minHeight: '400px'
            }}>
                {filteredRooms.length > 0 ? (
                    filteredRooms.map(room => (
                        <div key={room.room_id} style={{
                            padding: '20px',
                            background: 'var(--surface)',
                            backdropFilter: 'blur(10px)',
                            border: editingRoom === room.room_id ? '2px solid var(--primary)' : '1px solid var(--border)',
                            borderRadius: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            overflow: 'hidden'
                        }} className="room-card-premium">
                            {/* Decorative Background Element */}
                            <div style={{
                                position: 'absolute',
                                top: '-20px',
                                right: '-20px',
                                width: '80px',
                                height: '80px',
                                background: 'radial-gradient(circle, var(--primary-light) 0%, transparent 70%)',
                                opacity: 0.1,
                                borderRadius: '50%'
                            }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{
                                        fontSize: '0.8rem',
                                        fontWeight: '700',
                                        color: 'var(--text-3)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '1px',
                                        marginBottom: '4px'
                                    }}>
                                        Room Number
                                    </div>
                                    <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text)' }}>
                                        {room.room_number}
                                    </div>
                                </div>
                                <div style={{
                                    background: 'var(--bg-2)',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    color: 'var(--text-2)'
                                }}>
                                    {room.floor_name}
                                </div>
                            </div>

                            <div style={{
                                background: 'var(--bg-3)',
                                padding: '12px 16px',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.7rem', fontWeight: '600', color: 'var(--text-3)', textTransform: 'uppercase' }}>
                                        Bench Capacity
                                    </div>
                                    {editingRoom === room.room_id ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                            <input
                                                type="number"
                                                className="form-control"
                                                value={editCapacity}
                                                onChange={(e) => setEditCapacity(e.target.value)}
                                                style={{
                                                    width: '70px',
                                                    padding: '4px 8px',
                                                    borderRadius: '6px',
                                                    border: '1px solid var(--primary)'
                                                }}
                                                min="1"
                                                autoFocus
                                            />
                                            <span style={{ fontWeight: '600', fontSize: '13px' }}>benches</span>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text)' }}>
                                            {room.bench_capacity} <span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-2)' }}>benches</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    {editingRoom === room.room_id ? (
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => handleSave(room.room_id)}
                                                style={{ padding: '6px 12px', borderRadius: '8px' }}
                                            >
                                                Save
                                            </button>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={handleCancel}
                                                style={{ padding: '6px 12px', borderRadius: '8px' }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => handleEdit(room)}
                                            style={{
                                                padding: '8px 14px',
                                                borderRadius: '10px',
                                                background: 'var(--surface)',
                                                border: '1px solid var(--border)',
                                                boxShadow: 'var(--shadow-sm)'
                                            }}
                                        >
                                            <Pencil size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }} /> Edit
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Default Room Toggle */}
                            <div style={{
                                padding: '12px 16px',
                                background: room.is_default ? 'var(--bg-2)' : 'var(--surface-2)',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                border: room.is_default ? '1px solid var(--primary)' : '1px solid transparent'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: '700', color: room.is_default ? 'var(--primary)' : 'var(--text-2)', textTransform: 'uppercase' }}>
                                        Default Room
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>
                                        {room.is_default ? 'Used in auto-allot' : 'Not used in auto-allot'}
                                    </div>
                                </div>
                                {editingRoom === room.room_id ? (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={editIsDefault}
                                            onChange={(e) => setEditIsDefault(e.target.checked)}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: '12px', fontWeight: '500' }}>
                                            {editIsDefault ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </label>
                                ) : (
                                    <div style={{
                                        padding: '4px 10px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        background: room.is_default ? 'var(--primary)' : 'var(--bg-3)',
                                        color: room.is_default ? 'var(--surface)' : 'var(--text-3)'
                                    }}>
                                        {room.is_default ? 'YES' : 'NO'}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{
                        gridColumn: '1 / -1',
                        padding: '60px',
                        textAlign: 'center',
                        background: 'var(--surface)',
                        borderRadius: '16px',
                        border: '1px dashed var(--border)'
                    }}>
                        <div style={{ display: 'inline-flex', justifyContent: 'center', marginBottom: '16px', color: 'var(--text-3)' }}>
                            <Search size={48} strokeWidth={1.5} />
                        </div>
                        <h3>No rooms found</h3>
                        <p className="text-muted">Try adjusting your search query or switching floors.</p>
                        <button
                            className="btn btn-secondary mt-4"
                            onClick={() => setSearchQuery('')}
                        >
                            Reset Search
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                .room-card-premium:hover {
                    transform: translateY(-4px);
                    box-shadow: var(--shadow);
                    border-color: var(--primary-light) !important;
                }
                .admin-page::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
}

