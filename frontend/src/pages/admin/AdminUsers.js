import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Navigate } from 'react-router-dom';
import '../../styles/pages/admin/AdminUsers.css';
import axios from 'axios';

export default function AdminUsers() {
    const { isAdmin, user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [fetchTrigger, setFetchTrigger] = useState(0);
    const [openAction, setOpenAction] = useState(null);


    const apiBase = process.env.REACT_APP_API_URL || 'https://zippyyy.com/api';

    // --- Data Fetching Logic ---
    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            if (!token) return;

            const queryParams = new URLSearchParams({
                page,
                limit: 20,
                role: filterRole
            });

            const response = await fetch(`${apiBase}/admin/users?${queryParams}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(data.users);
                setTotalPages(data.totalPages);
            } else {
                setUsers([]);
                setTotalPages(1);
            }
        } catch {
            setUsers([]);
            setTotalPages(1);
        } finally {
            setLoading(false);
        }
    }, [page, filterRole, apiBase]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers, fetchTrigger]);

    // Reset page to 1 and trigger fetch when filterRole changes
    useEffect(() => {
        setPage(1);
        setFetchTrigger(t => t + 1);
    }, [filterRole]);

    // --- Role Change Logic ---
    const handleRoleChange = async (userId, newRole) => {
        if (!window.confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiBase}/admin/users/${userId}/role`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role: newRole })
            });

            if (response.ok) {
                // Update local state (Optimistic UI Update)
                setUsers(prev => prev.map(u =>
                    u._id === userId ? { ...u, role: newRole } : u
                ));
                alert('User role updated successfully');
            } else {
                const data = await response.json();
                alert(data.message || 'Failed to update role');
            }
        } catch (error) {
            console.error('Error updating role:', error);
            alert('Error updating role');
        }
    };

    const StatusHandel = async (id, currentStatus) => {
        const confirmMsg = currentStatus
            ? "Are you sure you want to BLOCK this user?"
            : "Are you sure you want to UNBLOCK this user?";

        if (!window.confirm(confirmMsg)) return;
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await axios.put(
                `${apiBase}/admin/user/status/${id}`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (res?.data?.status) {
                alert(
                    currentStatus
                        ? "User Blocked Successfully"
                        : "User Unblocked Successfully"
                );

                fetchUsers(); // reload list
            } else {
                alert("Something went wrong");
            }
        } catch (err) {
            console.error(err);
            alert("Server error");
        }
    };

    const handelDelete = async (id) => {
        const confirmMsg = "Are you sure you want to Delete this user?"

        if (!window.confirm(confirmMsg)) return;
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const res = await axios.delete(
                `${apiBase}/admin/user/delete/${id}`,
                {},
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            if (res?.data?.status) {
                alert("User Delete Successfully");

                fetchUsers();
            } else {
                alert("Something went wrong");
            }
        } catch (err) {
            console.error(err);
            alert("Server error");
        }
    };


    // --- Client-Side Search (on current page data) ---
    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // --- Authorization Check ---
    if (!isAdmin) {
        return <Navigate to="/" replace />;
    }

    // --- Helper function for avatar initial ---
    const getAvatarInitial = (name) => {
        return name ? name.charAt(0).toUpperCase() : '?';
    };

    return (
        <div className="admin-users-container">
            <div className="admin-users-header">
                <div className="users-header-content">
                    <h1>👥 User Management</h1>
                    <p>Manage customer accounts and admin privileges</p>
                </div>
            </div>

            <div className="users-filters">
                <div className="users-search-section">
                    <div className="users-search-wrapper">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Search users by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>

                <div className="role-filters">
                    <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        className="role-select"
                    >
                        <option value="all">All Roles</option>
                        <option value="customer">Customers</option>
                        <option value="admin">Admins</option>
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="loading-spinner">Loading...</div>
            ) : filteredUsers.length === 0 ? (
                <div className="loading-spinner">No users found matching your criteria.</div>
            ) : (
                <div className="users-table-container">
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                {/* <th>Email</th> */}
                                <th>Role</th>
                                <th>Joined Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <tr key={user._id}>
                                    {/* Column 1: User & Email (Combined for mobile card view) */}
                                    <td data-label="User & Email">
                                        <div className="user-info">
                                            <div className="user-avatar">
                                                {getAvatarInitial(user.name)}
                                            </div>
                                            <div className='user-info-username'>
                                                <span className="user-name">{user.name}</span><br />
                                                <small style={{ color: 'var(--text-medium)' }}>{user.email}</small>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Column 2: Email (Hidden on mobile, only needed if not combined above) */}
                                    {/* If you want to strictly follow the 5 columns for desktop, 
                                       you can keep the email here and hide it on mobile using CSS: .users-table td:nth-child(2) { display: none; } */}
                                    {/* <td data-label="Email" className="email-cell-desktop-only">{user.email}</td> */}

                                    {/* Column 3: Role */}
                                    <td data-label="Role">
                                        <span className={`role-badge ${user.role}`}>
                                            {user.role}
                                        </span>
                                    </td>

                                    {/* Column 4: Joined Date */}
                                    <td data-label="Joined Date">
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>

                                    <td data-label="Joined Date">
                                        {user?.isActive === true ? "Active" : "Block"}
                                    </td>

                                    {/* Column 5: Actions */}
                                    <td data-label="Actions" className="action-cell text-centerqq">
                                        {user._id !== currentUser?.id ? (
                                            <div className="action-wrapper">
                                                <button
                                                    className="dots-btn"
                                                    onClick={() =>
                                                        setOpenAction(openAction === user._id ? null : user._id)
                                                    }
                                                >
                                                    &#8942;
                                                </button>

                                                {openAction === user._id && (
                                                    <div className="action-dropdown">
                                                        <select
                                                            value={user.role}
                                                            onChange={(e) => handleRoleChange(user._id, e.target.value)}
                                                            className="role-select-dropdown"
                                                        >
                                                            <option value="customer">Customer</option>
                                                            <option value="admin">Admin</option>
                                                        </select>

                                                        <button
                                                            onClick={() => StatusHandel(user._id, user.isActive)}
                                                            className={`status-btn ${user?.isActive === true ? "btn-block" : "btn-unblock"}`}
                                                        >
                                                            {user?.isActive === true ? "Block" : "Unblock"}
                                                        </button>


                                                        <button
                                                            className="delete"
                                                            onClick={() => handelDelete(user._id)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="role-badge admin">You (Admin)</span>
                                        )}
                                    </td>

                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="pagination">
                <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                >
                    Previous
                </button>
                <span>Page **{page}** of **{totalPages}**</span>
                <button
                    disabled={page === totalPages || totalPages === 0}
                    onClick={() => setPage(p => p + 1)}
                >
                    Next
                </button>
            </div>
        </div>
    );
}