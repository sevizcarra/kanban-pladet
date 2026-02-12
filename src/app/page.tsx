'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from 'firebase/auth';
import Header from '@/components/Header';
import LoginPage from '@/components/LoginPage';
import KanbanBoard from '@/components/KanbanBoard';
import TableView from '@/components/TableView';
import DashboardSummary from '@/components/DashboardSummary';
import ProjectDetail from '@/components/ProjectDetail';
import StatsView from '@/components/StatsView';
import TimelineView from '@/components/TimelineView';
import GanttView from '@/components/GanttView';
import ExportButton from '@/components/ExportButton';
import MapView from '@/components/MapView';
import CreateProjectModal from '@/components/CreateProjectModal';
import AdminPanel from '@/components/AdminPanel';
import {
  subscribeProjects,
  createProject,
  updateProject,
  deleteProject,
} from '@/lib/firestore';
import { onAuthChange, logout, isAdmin, getUserProfile, ensureAdminProfile } from '@/lib/auth';
import { Project } from '@/types/project';
import { AppUser } from '@/types/user';
import {
  LayoutDashboard,
  BarChart3,
  Clock,
  GanttChart,
  MapPin,
  Plus,
  Filter,
  Search,
  Users,
  Columns3,
  List,
} from 'lucide-react';
import { STATUSES, PRIORITIES } from '@/lib/constants';

type Tab = 'dashboard' | 'stats' | 'gantt' | 'map' | 'timeline' | 'users';

export default function Home() {
  // Auth state
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App state
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      setAuthUser(user);
      if (user) {
        // Check if user has a profile in Firestore
        let profile = await getUserProfile(user.uid);
        if (!profile && isAdmin(user.email)) {
          // Auto-create admin profile on first login
          profile = await ensureAdminProfile(user);
        }
        if (profile) {
          setAppUser(profile);
        } else {
          // User exists in Firebase Auth but not in Firestore users collection
          // This means they were removed by admin — sign them out
          await logout();
          setAuthUser(null);
          setAppUser(null);
        }
      } else {
        setAppUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to projects only when authenticated
  useEffect(() => {
    if (!authUser) return;

    let unsubscribe: (() => void) | undefined;

    const initializeAndSubscribe = async () => {
      try {
        unsubscribe = subscribeProjects((newProjects) => {
          setProjects(newProjects);
          setLoading(false);
        });
      } catch (error) {
        console.error('Error initializing projects:', error);
        setLoading(false);
      }
    };

    initializeAndSubscribe();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [authUser]);

  const handleLogout = useCallback(async () => {
    await logout();
    setAuthUser(null);
    setAppUser(null);
    setActiveTab('dashboard');
  }, []);

  const handleCreate = useCallback(
    async (projectData: Omit<Project, 'id'>) => {
      try {
        await createProject(projectData);
        setShowCreateModal(false);
      } catch (error) {
        console.error('Error creating project:', error);
      }
    },
    []
  );

  const handleUpdate = useCallback(
    async (project: Project) => {
      try {
        await updateProject(project.id, project);
        setSelectedProject(project);
      } catch (error) {
        console.error('Error updating project:', error);
      }
    },
    []
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteProject(id);
        setSelectedProject(null);
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    },
    []
  );

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const statusMatch =
        filterStatus === 'all' || project.status === filterStatus;
      const priorityMatch =
        filterPriority === 'all' || project.priority === filterPriority;
      const searchMatch =
        search === '' ||
        project.title.toLowerCase().includes(search.toLowerCase()) ||
        (project.memorandumNumber &&
          project.memorandumNumber.toLowerCase().includes(search.toLowerCase()));

      return statusMatch && priorityMatch && searchMatch;
    });
  }, [projects, filterStatus, filterPriority, search]);

  const matchingProject = selectedProject
    ? projects.find((p) => p.id === selectedProject.id) || null
    : null;

  const userIsAdmin = isAdmin(authUser?.email);

  // Auth loading spinner
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-teal-500 rounded-full animate-spin"></div>
          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // Not authenticated — show login
  if (!authUser) {
    return <LoginPage onLogin={() => {}} />;
  }

  // Data loading spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-teal-500 rounded-full animate-spin"></div>
          <p className="text-gray-600">Cargando proyectos...</p>
        </div>
      </div>
    );
  }

  // Project detail view
  if (selectedProject && matchingProject) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header userEmail={authUser.email} onLogout={handleLogout} />
        <ProjectDetail
          project={matchingProject}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onBack={() => setSelectedProject(null)}
          userEmail={authUser.email || ""}
        />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'stats', label: 'Estadísticas', icon: <BarChart3 size={18} /> },
    { id: 'gantt', label: 'Carta Gantt', icon: <GanttChart size={18} /> },
    { id: 'map', label: 'Mapa', icon: <MapPin size={18} /> },
    { id: 'timeline', label: 'Línea de Tiempo', icon: <Clock size={18} /> },
    ...(userIsAdmin ? [{ id: 'users' as Tab, label: 'Usuarios', icon: <Users size={18} />, adminOnly: true }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-teal-50/30 relative">
      {/* Dot grid background — full screen */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(circle, #00A499 1.5px, transparent 1.5px)', backgroundSize: '28px 28px', opacity: 0.25 }} />

      <div className="relative z-10">
        <Header userEmail={authUser.email} onLogout={handleLogout} />

        {/* Tab Bar */}
        <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/80 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3.5 px-4 font-medium text-sm flex items-center gap-2 transition-all rounded-t-lg relative ${
                    activeTab === tab.id
                      ? 'text-teal-700 bg-teal-50/60'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50/50'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-2 right-2 h-[2.5px] bg-[#00A499] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter Bar — hide on admin panel */}
        {activeTab !== 'users' && (
          <div className="bg-white/60 backdrop-blur-sm border-b border-gray-200/60">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
                  {/* Status Filter */}
                  <div className="flex items-center gap-2">
                    <Filter size={16} className="text-gray-400" />
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 shadow-sm"
                    >
                      <option value="all">Todos los Estados</option>
                      {STATUSES.map((status) => (
                        <option key={status.id} value={status.id}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Priority Filter */}
                  <select
                    value={filterPriority}
                    onChange={(e) => setFilterPriority(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 shadow-sm"
                  >
                    <option value="all">Todas las Prioridades</option>
                    {Object.entries(PRIORITIES).map(([key, prio]) => (
                      <option key={key} value={key}>
                        {prio.label}
                      </option>
                    ))}
                  </select>

                  {/* Search Input */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar por título o memorándum..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 shadow-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* View toggle */}
                  {activeTab === 'dashboard' && (
                    <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                      <button
                        onClick={() => setViewMode('kanban')}
                        className={`p-2 rounded-md transition-all ${
                          viewMode === 'kanban'
                            ? 'bg-white text-[#00A499] shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                        title="Vista Kanban"
                      >
                        <Columns3 size={16} />
                      </button>
                      <button
                        onClick={() => setViewMode('table')}
                        className={`p-2 rounded-md transition-all ${
                          viewMode === 'table'
                            ? 'bg-white text-[#00A499] shadow-sm'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                        title="Vista Tabla"
                      >
                        <List size={16} />
                      </button>
                    </div>
                  )}

                  {/* Export Button */}
                  <ExportButton projects={filteredProjects} />

                  {/* Create Project Button */}
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#00A499] to-[#00B4A8] text-white rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-teal-500/20 active:scale-[0.98] transition-all whitespace-nowrap"
                  >
                    <Plus size={18} />
                    Nuevo Proyecto
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'dashboard' && (
            <DashboardSummary projects={filteredProjects} />
          )}

          {activeTab === 'dashboard' && viewMode === 'kanban' && (
            <KanbanBoard
              projects={filteredProjects}
              onProjectClick={setSelectedProject}
            />
          )}

          {activeTab === 'dashboard' && viewMode === 'table' && (
            <TableView
              projects={filteredProjects}
              onProjectClick={setSelectedProject}
            />
          )}

          {activeTab === 'stats' && (
            <StatsView projects={filteredProjects} />
          )}

          {activeTab === 'gantt' && (
            <GanttView
              projects={filteredProjects}
              onProjectClick={setSelectedProject}
            />
          )}

          {activeTab === 'map' && (
            <MapView
              projects={filteredProjects}
              onProjectClick={setSelectedProject}
            />
          )}

          {activeTab === 'timeline' && (
            <TimelineView
              projects={filteredProjects}
              onProjectClick={setSelectedProject}
            />
          )}

          {activeTab === 'users' && userIsAdmin && (
            <AdminPanel />
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onCreate={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
