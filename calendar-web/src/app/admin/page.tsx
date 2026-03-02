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

      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : users.length === 0 ? (
          <p className="text-gray-500 text-sm">No users found.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                {users.length} user{users.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-sm font-semibold shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{u.name}</p>
                    <p className="text-sm text-gray-400 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {u.family_name && (
                      <span className="hidden sm:inline text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">
                        {u.family_name}
                      </span>
                    )}
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        u.role === "admin"
                          ? "bg-indigo-50 text-indigo-600"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {u.role ?? "member"}
                    </span>
                    <span className="hidden md:inline text-xs text-gray-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </span>
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
