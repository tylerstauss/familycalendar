"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  family_name: string | null;
  member_count: number;
  members_with_cal: number;
}

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => {
        if (r.status === 403 || r.status === 401) {
          router.replace("/");
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (data) setUsers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const adminCount = users.filter((u) => u.role === "admin").length;
  const memberCount = users.filter((u) => u.role !== "admin").length;

  return (
    <div className="pb-4">
      <header className="border-b border-gray-100 px-4 md:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <span className="text-xs font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
            Admin
          </span>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
        {!loading && users.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-2xl font-bold text-gray-900">{users.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total users</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-2xl font-bold text-indigo-600">{adminCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Admins</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <p className="text-2xl font-bold text-gray-900">{memberCount}</p>
              <p className="text-xs text-gray-400 mt-0.5">Members</p>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-gray-500 text-sm">No users found.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-500">
                {users.length} user{users.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {users.map((u) => (
                <div key={u.id} className="flex items-start gap-4 px-5 py-4">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 mt-0.5 ${
                      u.role === "admin"
                        ? "bg-indigo-100 text-indigo-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900">{u.name}</p>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          u.role === "admin"
                            ? "bg-indigo-50 text-indigo-600"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {u.role ?? "member"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-0.5">{u.email}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {u.family_name && (
                        <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-lg">
                          {u.family_name}
                        </span>
                      )}
                      {u.member_count > 0 ? (
                        <span className="text-xs text-gray-400">
                          {u.member_count} member{u.member_count !== 1 ? "s" : ""}
                          {u.members_with_cal > 0 ? (
                            <span className="text-emerald-500 ml-1">
                              · {u.members_with_cal} with calendar
                            </span>
                          ) : (
                            <span className="text-gray-300 ml-1">· none with calendar</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">No family members</span>
                      )}
                      <span className="text-xs text-gray-300">
                        Joined {new Date(u.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
