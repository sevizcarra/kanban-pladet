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
import EmailConfirmDialog from '@/components/EmailConfirmDialog';
import AdminPanel from '@/components/AdminPanel';
import BacklogView from '@/components/BacklogView';
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
  Lightbulb,
} from 'lucide-react';
import { STATUSES, PRIORITIES } from '@/lib/constants';

type Tab = 'dashboard' | 'stats' | 'gantt' | 'map' | 'timeline' | 'backlog' | 'users';

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
  const [creationEmailDialog, setCreationEmailDialog] = useState<{
    open: boolean;
    projectData: Omit<Project, 'id'> | null;
  }>({ open: false, projectData: null });

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
        // Always show the email notification dialog — user can add/edit email there
        setCreationEmailDialog({ open: true, projectData });
      } catch (error) {
        console.error('Error creating project:', error);
      }
    },
    []
  );

  const handleCreationEmailSend = useCallback(async (editedName: string, editedEmail: string) => {
    const pd = creationEmailDialog.projectData;
    if (!pd) return;
    // Also update the project in Firestore with the (possibly edited) contact info
    const projectToUpdate = projects.find(
      (p) => p.title === pd.title && p.memorandumNumber === (`MEM-${pd.memorandumNumber}` || pd.memorandumNumber)
    ) || projects[projects.length - 1]; // fallback to last created
    if (projectToUpdate && (editedName !== pd.contactName || editedEmail !== pd.contactEmail)) {
      try {
        await updateProject(projectToUpdate.id, {
          ...projectToUpdate,
          contactName: editedName,
          contactEmail: editedEmail,
        });
      } catch (err) {
        console.error('Error updating contact info:', err);
      }
    }
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'creation',
        to: editedEmail,
        contactName: editedName || 'Estimado/a',
        projectName: pd.title,
        projectCode: pd.codigoProyectoUsa || '—',
        status: pd.status,
        tipoDesarrollo: pd.tipoDesarrollo || '—',
        tipoLicitacion: pd.tipoLicitacion || '—',
        disciplinaLider: pd.disciplinaLider || '—',
        jefeProyecto: 'Por asignar',
      }),
    });
  }, [creationEmailDialog.projectData, projects]);

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

  const handleToggleFlag = useCallback(
    async (project: Project) => {
      try {
        const updated = { ...project, flagged: !project.flagged };
        await updateProject(project.id, updated);
      } catch (error) {
        console.error('Error toggling flag:', error);
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
          <div className="w-12 h-12 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin"></div>
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
          <div className="w-12 h-12 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin"></div>
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
    ...(userIsAdmin ? [{ id: 'backlog' as Tab, label: 'Backlog', icon: <Lightbulb size={18} />, adminOnly: true }] : []),
    ...(userIsAdmin ? [{ id: 'users' as Tab, label: 'Usuarios', icon: <Users size={18} />, adminOnly: true }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Dot grid background — full screen */}
      <div className="fixed inset-0 pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(circle, #F97316 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: 0.15 }} />

      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <Header userEmail={authUser.email} onLogout={handleLogout} />

        {/* Body: Sidebar + Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-16 hover:w-52 group/sidebar bg-white border-r border-gray-200/80 flex flex-col transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0">
            {/* Nav items */}
            <nav className="flex-1 py-3 px-2 space-y-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    title={tab.label}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white shadow-md shadow-orange-500/20'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="flex-shrink-0 w-5 flex justify-center">
                      {tab.icon}
                    </span>
                    <span className="whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* New project button at bottom of sidebar */}
            <div className="p-2 border-t border-gray-100">
              <button
                onClick={() => setShowCreateModal(true)}
                title="Nuevo Proyecto"
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#F97316] to-[#ea580c] text-white shadow-md shadow-orange-500/15 hover:shadow-lg hover:shadow-orange-500/25 active:scale-[0.97] transition-all"
              >
                <span className="flex-shrink-0 w-5 flex justify-center">
                  <Plus size={18} strokeWidth={2.5} />
                </span>
                <span className="whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
                  Nuevo Proyecto
                </span>
              </button>
            </div>
          </aside>

          {/* Main content area */}
          <main className="flex-1 overflow-auto">
            {/* Filter Bar — hide on admin panel and backlog */}
            {activeTab !== 'users' && activeTab !== 'backlog' && (
              <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200/60">
                <div className="px-5 py-2.5">
                  <div className="flex flex-wrap gap-2.5 items-center">
                    {/* Status Filter */}
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 border border-gray-200/80">
                      <Filter size={14} className="text-gray-400 flex-shrink-0" />
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-1 py-2 bg-transparent text-sm focus:outline-none text-gray-700 cursor-pointer"
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
                    <div className="bg-gray-50 rounded-lg px-3 border border-gray-200/80">
                      <select
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                        className="px-0 py-2 bg-transparent text-sm focus:outline-none text-gray-700 cursor-pointer"
                      >
                        <option value="all">Todas las Prioridades</option>
                        {Object.entries(PRIORITIES).map(([key, prio]) => (
                          <option key={key} value={key}>
                            {prio.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px]">
                      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por título o memorándum..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200/80 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-300 focus:bg-white transition-all"
                      />
                    </div>

                    {/* View toggle */}
                    {activeTab === 'dashboard' && (
                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                        <button
                          onClick={() => setViewMode('kanban')}
                          className={`p-2 rounded-md transition-all ${
                            viewMode === 'kanban'
                              ? 'bg-white text-[#F97316] shadow-sm'
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
                              ? 'bg-white text-[#F97316] shadow-sm'
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
                  </div>
                </div>
              </div>
            )}

            {/* Content Area — full width */}
            <div className="px-5 py-6">
              {activeTab === 'dashboard' && (
                <DashboardSummary projects={filteredProjects} />
              )}

              {activeTab === 'dashboard' && viewMode === 'kanban' && (
                <KanbanBoard
                  projects={filteredProjects}
                  onProjectClick={setSelectedProject}
                  onToggleFlag={handleToggleFlag}
                />
              )}

              {activeTab === 'dashboard' && viewMode === 'table' && (
                <TableView
                  projects={filteredProjects}
                  onProjectClick={setSelectedProject}
                  onToggleFlag={handleToggleFlag}
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

              {activeTab === 'backlog' && userIsAdmin && (
                <BacklogView
                  userEmail={authUser.email || ''}
                  onPromoteToProject={async (data) => {
                    await handleCreate(data);
                  }}
                />
              )}

              {activeTab === 'users' && userIsAdmin && (
                <AdminPanel />
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onCreate={handleCreate}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Email notification dialog for project creation */}
      <EmailConfirmDialog
        isOpen={creationEmailDialog.open}
        onClose={() => setCreationEmailDialog({ open: false, projectData: null })}
        onConfirm={handleCreationEmailSend}
        onSkip={() => setCreationEmailDialog({ open: false, projectData: null })}
        contactName={creationEmailDialog.projectData?.contactName || '—'}
        contactEmail={creationEmailDialog.projectData?.contactEmail || '—'}
        projectName={creationEmailDialog.projectData?.title || ''}
        projectCode={creationEmailDialog.projectData?.codigoProyectoUsa || '—'}
        type="creation"
      />
    </div>
  );
}
