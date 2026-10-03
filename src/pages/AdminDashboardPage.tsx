import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, ADMIN_EMAILS } from '../firebase';
import { AppUser, UserRole } from '../types/auth';
import { useAuth } from '../context/AuthContext';
import { SyllabusManager } from '../components/admin/SyllabusManager';

export const AdminDashboardPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [activeSection, setActiveSection] = useState<'users' | 'syllabus'>('users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  // Real-time listener for Firestore `users` collection
  useEffect(() => {
    const usersColRef = collection(db, 'users');
    const unsubscribe = onSnapshot(
      usersColRef,
      (snapshot) => {
        const fetchedUsers: AppUser[] = [];
        snapshot.forEach((docSnap) => {
          fetchedUsers.push(docSnap.data() as AppUser);
        });
        setUsers(fetchedUsers);
        setLoadingUsers(false);
      },
      (error) => {
        setLoadingUsers(false);
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );

    return () => unsubscribe();
  }, []);

  // Update user role in Firestore
  const handleRoleChange = async (targetUser: AppUser, newRole: UserRole) => {
    if (targetUser.role === newRole) return;
    setUpdatingUid(targetUser.uid);
    try {
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, { role: newRole });
      setActionMessage(`Role for ${targetUser.name || targetUser.email} changed to "${newRole}".`);
      setTimeout(() => setActionMessage(null), 4000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetUser.uid}`);
    } finally {
      setUpdatingUid(null);
    }
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      u.uid.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalAdmins = users.filter((u) => u.role === 'admin').length;
  const totalStandardUsers = users.filter((u) => u.role === 'user').length;

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#c0c9c0]/30 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-200 uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">admin_panel_settings</span>
              Restricted Area • Admin Only
            </span>
            <span className="text-xs text-[#707971]">Zero-Trust Firestore Security</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#003820] tracking-tight">
            System Administration & Master Syllabus Console
          </h1>
          <p className="text-xs text-[#404942] mt-1 max-w-2xl">
            Manage authenticated student accounts, toggle permissions, and CRUD the official HSC Master Syllabus stored in Firestore.
          </p>
        </div>

        {/* Current Admin Badge */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-[#c0c9c0]/40 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-[#003820] text-[#6ffbbe] flex items-center justify-center font-bold text-sm overflow-hidden">
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.name}
                className="w-full h-full rounded-xl object-cover"
              />
            ) : (
              currentUser?.name?.slice(0, 2).toUpperCase() || 'AD'
            )}
          </div>
          <div className="text-xs">
            <div className="font-bold text-[#0b1c30] flex items-center gap-1.5">
              <span>{currentUser?.name}</span>
              <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 text-[10px] font-mono font-bold">
                ADMIN
              </span>
            </div>
            <span className="text-[11px] text-[#707971] font-mono">{currentUser?.email}</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs for Section 1 and Section 2 */}
      <div className="flex items-center gap-3 border-b border-[#c0c9c0]/30 pb-1">
        <button
          onClick={() => setActiveSection('users')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeSection === 'users'
              ? 'bg-[#003820] text-white shadow-xs'
              : 'text-[#404942] hover:bg-[#eff4ff] hover:text-[#003820]'
          }`}
        >
          <span className="material-symbols-outlined text-base">group</span>
          <span>Section 1: User Management</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeSection === 'users'
                ? 'bg-[#6ffbbe]/25 text-[#6ffbbe]'
                : 'bg-[#eff4ff] text-[#003820]'
            }`}
          >
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSection('syllabus')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeSection === 'syllabus'
              ? 'bg-[#003820] text-white shadow-xs'
              : 'text-[#404942] hover:bg-[#eff4ff] hover:text-[#003820]'
          }`}
        >
          <span className="material-symbols-outlined text-base">menu_book</span>
          <span>Section 2: Syllabus Management (CRUD)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeSection === 'syllabus'
                ? 'bg-[#6ffbbe]/25 text-[#6ffbbe]'
                : 'bg-[#eff4ff] text-[#003820]'
            }`}
          >
            Firestore
          </span>
        </button>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="p-4 rounded-2xl bg-[#003820] text-white text-xs font-semibold flex items-center justify-between shadow-lg border border-[#6ffbbe]/40 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-[#6ffbbe]">check_circle</span>
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-white/70 hover:text-white"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* SECTION 1: USER MANAGEMENT */}
      {activeSection === 'users' && (
        <div className="space-y-6">
          {/* Top Admin KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-[#c0c9c0]/30 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase font-bold text-[#707971]">
                  Total Accounts
                </span>
                <div className="text-2xl font-black text-[#0b1c30] tabular-nums">
                  {loadingUsers ? '...' : users.length}
                </div>
                <span className="text-[10px] text-[#006c49] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">cloud_done</span>
                  Synced from Firestore /users
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#eff4ff] text-[#003820] flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">group</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#c0c9c0]/30 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase font-bold text-[#707971]">
                  System Admins
                </span>
                <div className="text-2xl font-black text-purple-700 tabular-nums">
                  {loadingUsers ? '...' : totalAdmins}
                </div>
                <span className="text-[10px] text-purple-600 font-medium">
                  Elevated Permissions
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">shield_person</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#c0c9c0]/30 shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-mono uppercase font-bold text-[#707971]">
                  Students (Users)
                </span>
                <div className="text-2xl font-black text-[#003820] tabular-nums">
                  {loadingUsers ? '...' : totalStandardUsers}
                </div>
                <span className="text-[10px] text-[#707971]">Academic Scholars</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#6ffbbe]/20 text-[#003820] flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl">school</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#c0c9c0]/30 shadow-xs flex items-center justify-between">
              <div className="space-y-1 overflow-hidden">
                <span className="text-[11px] font-mono uppercase font-bold text-[#707971]">
                  Auto-Admin Email
                </span>
                <div className="text-xs font-mono font-bold text-[#0b1c30] truncate">
                  {ADMIN_EMAILS[0]}
                </div>
                <span className="text-[10px] text-[#006c49] font-medium flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">auto_awesome</span>
                  Auto-Elevated on Sign-In
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">verified</span>
              </div>
            </div>
          </div>

          {/* User Management Table Card */}
          <div className="bg-white rounded-3xl border border-[#c0c9c0]/30 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-[#c0c9c0]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#003820] tracking-tight">
                  User Directory & Role Management
                </h2>
                <p className="text-xs text-[#707971]">
                  Live records from <code className="font-mono text-[#003820]">/users</code> collection
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-base text-[#707971]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-3 py-2 text-xs rounded-xl border border-[#c0c9c0]/60 bg-[#f8f9ff] text-[#0b1c30] focus:outline-none focus:border-[#003820] w-56 sm:w-64"
                  />
                </div>

                <div className="flex items-center rounded-xl border border-[#c0c9c0]/60 bg-[#f8f9ff] p-1 text-xs">
                  <button
                    onClick={() => setRoleFilter('all')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      roleFilter === 'all'
                        ? 'bg-white text-[#003820] shadow-xs'
                        : 'text-[#707971] hover:text-[#0b1c30]'
                    }`}
                  >
                    All ({users.length})
                  </button>
                  <button
                    onClick={() => setRoleFilter('admin')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      roleFilter === 'admin'
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'text-[#707971] hover:text-[#0b1c30]'
                    }`}
                  >
                    Admins ({totalAdmins})
                  </button>
                  <button
                    onClick={() => setRoleFilter('user')}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      roleFilter === 'user'
                        ? 'bg-white text-[#003820] shadow-xs'
                        : 'text-[#707971] hover:text-[#0b1c30]'
                    }`}
                  >
                    Users ({totalStandardUsers})
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f8f9ff] text-[#707971] font-mono text-[10px] uppercase border-b border-[#c0c9c0]/30">
                  <tr>
                    <th className="px-6 py-3.5">User</th>
                    <th className="px-6 py-3.5">UID</th>
                    <th className="px-6 py-3.5">Assigned Role</th>
                    <th className="px-6 py-3.5">Joined</th>
                    <th className="px-6 py-3.5">Last Login</th>
                    <th className="px-6 py-3.5 text-right">Role Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5eeff]">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-[#707971]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-5 h-5 border-2 border-[#003820] border-t-transparent rounded-full animate-spin" />
                          <span>Loading Firestore User Records...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-[#707971]">
                        <span className="material-symbols-outlined text-3xl mb-1 text-[#c0c9c0]">
                          person_search
                        </span>
                        <p className="font-semibold text-xs">No matching user records found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isCurrent = u.uid === currentUser?.uid;
                      const isHardcodedAdmin = ADMIN_EMAILS.some(
                        (em) => em.toLowerCase() === u.email.toLowerCase()
                      );

                      return (
                        <tr key={u.uid} className="hover:bg-[#f8f9ff]/70 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-[#003820] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden shadow-xs">
                                {u.photoURL ? (
                                  <img
                                    src={u.photoURL}
                                    alt={u.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  u.name?.slice(0, 2).toUpperCase() || 'ST'
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-[#0b1c30] flex items-center gap-1.5">
                                  <span>{u.name || 'Unnamed Scholar'}</span>
                                  {isCurrent && (
                                    <span className="px-1.5 py-0.2 rounded bg-[#6ffbbe]/30 text-[#003820] text-[9px] font-mono font-bold">
                                      YOU
                                    </span>
                                  )}
                                  {isHardcodedAdmin && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-mono font-bold">
                                      ROOT
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-[#707971] font-mono">
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4 font-mono text-[11px] text-[#707971]">
                            <span className="truncate max-w-[120px] inline-block" title={u.uid}>
                              {u.uid}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            {u.role === 'admin' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                <span className="material-symbols-outlined text-xs">
                                  admin_panel_settings
                                </span>
                                ADMIN
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-[#eff4ff] text-[#003820] border border-[#c0c9c0]/30">
                                <span className="material-symbols-outlined text-xs">school</span>
                                USER
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 font-mono text-[11px] text-[#707971]">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                          </td>

                          <td className="px-6 py-4 font-mono text-[11px] text-[#707971]">
                            {u.lastLoginAt
                              ? new Date(u.lastLoginAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Just now'}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {u.role === 'user' ? (
                                <button
                                  onClick={() => handleRoleChange(u, 'admin')}
                                  disabled={updatingUid === u.uid}
                                  className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {updatingUid === u.uid ? 'Updating...' : 'Promote to Admin'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleRoleChange(u, 'user')}
                                  disabled={updatingUid === u.uid || isHardcodedAdmin}
                                  title={
                                    isHardcodedAdmin
                                      ? 'Root admin cannot be demoted'
                                      : 'Demote to regular user'
                                  }
                                  className="px-3 py-1.5 rounded-xl bg-gray-100 text-[#404942] hover:bg-gray-200 border border-gray-200 font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {updatingUid === u.uid ? 'Updating...' : 'Demote to User'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: SYLLABUS MANAGEMENT */}
      {activeSection === 'syllabus' && <SyllabusManager />}
    </div>
  );
};
