"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Trash2, Shield, User } from "lucide-react";
import { createCollaborator, listUsers, removeUser } from "@/lib/auth";
import { AppUser, ADMIN_EMAIL } from "@/types/user";

export default function AdminPanel() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // New user form
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState("");

  // Delete confirm
  const [deleteUid, setDeleteUid] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await listUsers();
      setUsers(list);
    } catch {
      console.error("Error loading users");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!newEmail.endsWith("@usach.cl")) {
      setFormError("Solo se permiten correos @usach.cl");
      return;
    }
    if (newPassword.length < 6) {
      setFormError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (!newName.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }

    setFormLoading(true);
    try {
      await createCollaborator(newEmail, newPassword, newName.trim());
      setFormSuccess(`Usuario ${newEmail} creado correctamente`);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setShowForm(false);
      await loadUsers();
      setTimeout(() => setFormSuccess(""), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear usuario";
      if (msg.includes("email-already-in-use")) {
        setFormError("Este correo ya está registrado");
      } else {
        setFormError(msg);
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (uid: string) => {
    try {
      await removeUser(uid);
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
      setDeleteUid(null);
    } catch {
      console.error("Error removing user");
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-[#F97316]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Gestión de Usuarios
            </h2>
            <p className="text-sm text-gray-500">
              Administra los colaboradores del sistema
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setFormError("");
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F97316] hover:bg-[#F97316]/90 text-white text-sm font-semibold transition"
        >
          <Plus className="w-4 h-4" />
          Agregar Colaborador
        </button>
      </div>

      {/* Success message */}
      {formSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">
          {formSuccess}
        </div>
      )}

      {/* New user form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-4">
            Nuevo Colaborador
          </h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Nombre completo
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre Apellido"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Correo @usach.cl
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nombre@usach.cl"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-1">
                  Contraseña
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-[#F97316] outline-none"
                  required
                />
              </div>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
                {formError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={formLoading}
                className={`px-4 py-2 rounded-lg text-white text-sm font-semibold transition ${
                  formLoading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#F97316] hover:bg-[#F97316]/90"
                }`}
              >
                {formLoading ? "Creando..." : "Crear Usuario"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <p className="text-xs text-gray-600 font-semibold">
            {users.length} usuario{users.length !== 1 ? "s" : ""} registrado
            {users.length !== 1 ? "s" : ""}
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">
            Cargando usuarios...
          </div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No hay usuarios registrados
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map((user) => (
              <div
                key={user.uid}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      user.role === "admin" ? "bg-[#003B5C]" : "bg-[#F97316]"
                    }`}
                  >
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {user.role === "admin" ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-[#003B5C] bg-[#003B5C]/10 px-2.5 py-1 rounded-full">
                      <Shield className="w-3 h-3" />
                      Admin
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-[#F97316] bg-[#F97316]/10 px-2.5 py-1 rounded-full">
                      <User className="w-3 h-3" />
                      Colaborador
                    </span>
                  )}

                  {user.email !== ADMIN_EMAIL && (
                    <>
                      {deleteUid === user.uid ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleDelete(user.uid)}
                            className="text-xs text-red-600 font-semibold hover:text-red-800 transition"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => setDeleteUid(null)}
                            className="text-xs text-gray-500 font-semibold hover:text-gray-700 transition"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteUid(user.uid)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
