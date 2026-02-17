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
import CreateObrasModal from '@/components/CreateObrasModal';
import EmailConfirmDialog from '@/components/EmailConfirmDialog';
import AdminPanel from '@/components/AdminPanel';
import BacklogView from '@/components/BacklogView';
import EmailSyncPanel from '@/components/EmailSyncPanel';
import {
  subscribeProjects,
  createProject,
  updateProject,
  deleteProject,
  addComment,
  batchUpdateSortOrder,
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
  Snowflake,
  Hammer,
  ShoppingCart,
  Mail,
} from 'lucide-react';
import { STATUSES, OBRAS_STATUSES, PRIORITIES, REQUESTING_UNITS } from '@/lib/constants';

type Tab = 'compras' | 'obras' | 'stats' | 'gantt' | 'map' | 'timeline' | 'backlog' | 'emailsync' | 'users';

export default function Home() {
  // Auth state
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App state
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('compras');
  const [showCreateObrasModal, setShowCreateObrasModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterUnit, setFilterUnit] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [creationEmailDialog, setCreationEmailDialog] = useState<{
    open: boolean;
    projectData: Omit<Project, 'id'> | null;
  }>({ open: false, projectData: null });
  const [freezeDialog, setFreezeDialog] = useState<{
    open: boolean;
    project: Project | null;
  }>({ open: false, project: null });
  const [freezeJustification, setFreezeJustification] = useState('');

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
    setActiveTab('compras');
  }, []);

  const handleCreate = useCallback(
    async (projectData: Omit<Project, 'id'>) => {
      try {
        await createProject(projectData);
        setShowCreateModal(false);
        setShowCreateObrasModal(false);
        // Obras projects don't need email notifications
        if (projectData.dashboardType !== 'obras') {
          setCreationEmailDialog({ open: true, projectData });
        }
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

  // Freeze: from KanbanBoard card — open modal
  const handleRequestFreeze = useCallback((project: Project) => {
    setFreezeDialog({ open: true, project });
    setFreezeJustification('');
  }, []);

  // Freeze: confirm with justification (from modal or ProjectDetail)
  const handleFreezeConfirm = useCallback(
    async (project: Project, justification: string) => {
      try {
        const wasFrozen = !!project.frozen;
        const updated = { ...project, frozen: !wasFrozen };
        await updateProject(project.id, updated);
        // Add justification as a system comment
        const action = wasFrozen ? 'DESCONGELADO' : 'CONGELADO';
        await addComment(project.id, {
          authorEmail: authUser?.email || 'sistema',
          content: `❄️ Proyecto ${action}: ${justification}`,
          mentions: [],
          createdAt: new Date().toISOString(),
        });
        // Update commentCount
        await updateProject(project.id, { ...updated, commentCount: (project.commentCount || 0) + 1 });
        // If we're viewing this project, update the selection
        if (selectedProject?.id === project.id) {
          setSelectedProject({ ...updated, commentCount: (project.commentCount || 0) + 1 });
        }
      } catch (error) {
        console.error('Error toggling freeze:', error);
      }
    },
    [authUser, selectedProject]
  );

  // Duplicate a project
  const handleDuplicate = useCallback(
    async (project: Project) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, sortOrder, ...rest } = project;
        const duplicated: Omit<Project, 'id'> = {
          ...rest,
          title: `${project.title} (copia)`,
          // Reset status to initial
          status: 'recepcion_requerimiento',
          createdAt: new Date().toISOString(),
          commentCount: 0,
          flagged: false,
          frozen: false,
        };
        await createProject(duplicated);
        // If viewing the detail, go back to the board
        if (selectedProject) {
          setSelectedProject(null);
        }
      } catch (error) {
        console.error('Error duplicating project:', error);
      }
    },
    [selectedProject]
  );

  // Reorder projects within a column
  const handleReorder = useCallback(
    async (statusId: string, orderedIds: string[]) => {
      try {
        const updates = orderedIds.map((id, index) => ({ id, sortOrder: index }));
        await batchUpdateSortOrder(updates);
      } catch (error) {
        console.error('Error reordering projects:', error);
      }
    },
    []
  );

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      // Filter by dashboardType when on compras or obras tab
      if (activeTab === 'compras' && project.dashboardType === 'obras') return false;
      if (activeTab === 'obras' && project.dashboardType !== 'obras') return false;

      const statusMatch =
        filterStatus === 'all' || project.status === filterStatus;
      const priorityMatch =
        filterPriority === 'all' || project.priority === filterPriority;
      const unitMatch =
        filterUnit === 'all' || project.requestingUnit === filterUnit;
      const searchMatch =
        search === '' ||
        project.title.toLowerCase().includes(search.toLowerCase()) ||
        (project.memorandumNumber &&
          project.memorandumNumber.toLowerCase().includes(search.toLowerCase()));

      return statusMatch && priorityMatch && unitMatch && searchMatch;
    });
  }, [projects, activeTab, filterStatus, filterPriority, filterUnit, search]);

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
          onToggleFreeze={handleFreezeConfirm}
          onDuplicate={handleDuplicate}
          onBack={() => setSelectedProject(null)}
          userEmail={authUser.email || ""}
        />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: 'compras', label: 'Dashboard Compras', icon: <ShoppingCart size={18} /> },
    { id: 'obras', label: 'Dashboard Obras', icon: <Hammer size={18} /> },
    { id: 'stats', label: 'Estadísticas', icon: <BarChart3 size={18} /> },
    { id: 'gantt', label: 'Carta Gantt', icon: <GanttChart size={18} /> },
    { id: 'map', label: 'Mapa', icon: <MapPin size={18} /> },
    { id: 'timeline', label: 'Línea de Tiempo', icon: <Clock size={18} /> },
    ...(userIsAdmin ? [{ id: 'backlog' as Tab, label: 'Backlog', icon: <Lightbulb size={18} />, adminOnly: true }] : []),
    ...(userIsAdmin ? [{ id: 'emailsync' as Tab, label: 'Correo Auto', icon: <Mail size={18} />, adminOnly: true }] : []),
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

            {/* New project buttons at bottom of sidebar */}
            <div className="p-2 border-t border-gray-100 space-y-1.5">
              <button
                onClick={() => setShowCreateModal(true)}
                title="Nuevo Proyecto Compras"
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#F97316] to-[#ea580c] text-white shadow-md shadow-orange-500/15 hover:shadow-lg hover:shadow-orange-500/25 active:scale-[0.97] transition-all"
              >
                <span className="flex-shrink-0 w-5 flex justify-center">
                  <ShoppingCart size={16} strokeWidth={2.5} />
                </span>
                <span className="whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 text-xs">
                  Nuevo Compras
                </span>
              </button>
              <button
                onClick={() => setShowCreateObrasModal(true)}
                title="Nuevo Proyecto Obras"
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-[#22c55e] to-[#16a34a] text-white shadow-md shadow-green-500/15 hover:shadow-lg hover:shadow-green-500/25 active:scale-[0.97] transition-all"
              >
                <span className="flex-shrink-0 w-5 flex justify-center">
                  <Hammer size={16} strokeWidth={2.5} />
                </span>
                <span className="whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 text-xs">
                  Nuevo Obras
                </span>
              </button>
            </div>
          </aside>

          {/* Main content area */}
          <main className="flex-1 overflow-auto">
            {/* Filter Bar — hide on admin panel and backlog */}
            {activeTab !== 'users' && activeTab !== 'backlog' && activeTab !== 'emailsync' && (
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
                        {(activeTab === 'obras' ? OBRAS_STATUSES : STATUSES).map((status) => (
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

                    {/* Unit Filter */}
                    <div className="bg-gray-50 rounded-lg px-3 border border-gray-200/80">
                      <select
                        value={filterUnit}
                        onChange={(e) => setFilterUnit(e.target.value)}
                        className="px-0 py-2 bg-transparent text-sm focus:outline-none text-gray-700 cursor-pointer"
                      >
                        <option value="all">Todas las Unidades</option>
                        {REQUESTING_UNITS.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
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
                    {(activeTab === 'compras' || activeTab === 'obras') && (
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
              {/* Dashboard Compras */}
              {activeTab === 'compras' && (
                <DashboardSummary projects={filteredProjects} dashboardType="compras" />
              )}

              {activeTab === 'compras' && viewMode === 'kanban' && (
                <KanbanBoard
                  projects={filteredProjects}
                  onProjectClick={setSelectedProject}
                  onToggleFlag={handleToggleFlag}
                  onToggleFreeze={handleRequestFreeze}
                  onDuplicate={handleDuplicate}
                  onReorder={handleReorder}
                />
              )}

              {activeTab === 'compras' && viewMode === 'table' && (
                <TableView
                  projects={filteredProjects}
                  onProjectClick={setSelectedProject}
                  onToggleFlag={handleToggleFlag}
                  onToggleFreeze={handleRequestFreeze}
                />
              )}

              {/* Dashboard Obras */}
              {activeTab === 'obras' && (
                <DashboardSummary projects={filteredProjects} dashboardType="obras" />
              )}

              {activeTab === 'obras' && viewMode === 'kanban' && (
                <KanbanBoard
                  projects={filteredProjects}
                  statuses={OBRAS_STATUSES}
                  onProjectClick={setSelectedProject}
                  onToggleFlag={handleToggleFlag}
                  onToggleFreeze={handleRequestFreeze}
                  onDuplicate={handleDuplicate}
                  onReorder={handleReorder}
                />
              )}

              {activeTab === 'obras' && viewMode === 'table' && (
                <TableView
                  projects={filteredProjects}
                  onProjectClick={setSelectedProject}
                  onToggleFlag={handleToggleFlag}
                  onToggleFreeze={handleRequestFreeze}
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

              {activeTab === 'emailsync' && userIsAdmin && (
                <EmailSyncPanel />
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

      {/* Create Obras Modal */}
      {showCreateObrasModal && (
        <CreateObrasModal
          onCreate={handleCreate}
          onClose={() => setShowCreateObrasModal(false)}
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

      {/* Freeze justification modal (from Kanban cards) */}
      {freezeDialog.open && freezeDialog.project && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full overflow-hidden">
            <div className={`px-6 py-4 flex items-center gap-3 ${freezeDialog.project.frozen ? 'bg-green-500' : 'bg-blue-400'}`}>
              <Snowflake className="w-6 h-6 text-white flex-shrink-0" />
              <h3 className="text-lg font-bold text-white">
                {freezeDialog.project.frozen ? 'Descongelar Proyecto' : 'Congelar Proyecto'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Proyecto:</p>
                <p className="text-sm font-semibold text-gray-900">{freezeDialog.project.title}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-600 font-semibold mb-2">
                  Justificación (mínimo 10 caracteres)
                </label>
                <textarea
                  value={freezeJustification}
                  onChange={(e) => setFreezeJustification(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:border-blue-400 outline-none resize-none h-24"
                  placeholder={freezeDialog.project.frozen ? '¿Por qué se descongela este proyecto?' : '¿Por qué se congela este proyecto?'}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setFreezeDialog({ open: false, project: null }); setFreezeJustification(''); }}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (freezeDialog.project && freezeJustification.trim().length >= 10) {
                      handleFreezeConfirm(freezeDialog.project, freezeJustification.trim());
                      setFreezeDialog({ open: false, project: null });
                      setFreezeJustification('');
                    }
                  }}
                  disabled={freezeJustification.trim().length < 10}
                  className={`flex-1 px-3 py-2 rounded-lg text-white text-sm font-semibold transition ${
                    freezeJustification.trim().length >= 10
                      ? freezeDialog.project.frozen ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-400 hover:bg-blue-500'
                      : 'bg-gray-300 cursor-not-allowed'
                  }`}
                >
                  {freezeDialog.project.frozen ? 'Descongelar' : 'Congelar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
