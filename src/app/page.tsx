'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { User } from 'firebase/auth';
import Header from '@/components/Header';
import LoginPage from '@/components/LoginPage';
import KanbanBoard from '@/components/KanbanBoard';
import ProjectDetail from '@/components/ProjectDetail';
import StatsView from '@/components/StatsView';
import TimelineView from '@/components/TimelineView';
import CreateProjectModal from '@/components/CreateProjectModal';
import AdminPanel from '@/components/AdminPanel';
import {
  subscribeProjects,
  createProject,
  updateProject,
  deleteProject,
  seedIfEmpty,
} from '@/lib/firestore';
import { onAuthChange, logout, isAdmin, getUserProfile, ensureAdminProfile } from '@/lib/auth';
import { Project } from '@/types/project';
import { AppUser } from '@/types/user';
import {
  LayoutDashboard,
  BarChart3,
  Clock,
  Plus,
  Filter,
  Search,
  Users,
} from 'lucide-react';
import { STATUSES, PRIORITIES } from '@/lib/constants';

type Tab = 'dashboard' | 'stats' | 'timeline' | 'users';

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
        await seedIfEmpty();
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
        />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'stats', label: 'Estadísticas', icon: <BarChart3 size={18} /> },
    { id: 'timeline', label: 'Línea de Tiempo', icon: <Clock size={18} /> },
    ...(userIsAdmin ? [{ id: 'users' as Tab, label: 'Usuarios', icon: <Users size={18} />, adminOnly: true }] : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-teal-50/30 relative">
      {/* Decorative background graphics */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Concentric circles — top left */}
        <svg className="absolute top-[6%] left-[-3%] w-[480px] h-[480px] opacity-[0.08]" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="95" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="75" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="55" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="35" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <circle cx="100" cy="100" r="15" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <line x1="100" y1="5" x2="100" y2="195" stroke="#00A499" strokeWidth="0.3" />
          <line x1="5" y1="100" x2="195" y2="100" stroke="#00A499" strokeWidth="0.3" />
        </svg>

        {/* Hexagon nest — bottom right */}
        <svg className="absolute bottom-[3%] right-[-3%] w-[420px] h-[420px] opacity-[0.08]" viewBox="0 0 200 200">
          <polygon points="100,10 190,55 190,145 100,190 10,145 10,55" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <polygon points="100,30 170,60 170,140 100,170 30,140 30,60" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <polygon points="100,50 150,68 150,132 100,150 50,132 50,68" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <polygon points="100,70 130,80 130,120 100,130 70,120 70,80" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <line x1="100" y1="10" x2="100" y2="190" stroke="#00A499" strokeWidth="0.3" />
        </svg>

        {/* Diagonal lines — center */}
        <svg className="absolute top-[20%] left-[25%] w-[600px] h-[600px] opacity-[0.04]" viewBox="0 0 200 200">
          <line x1="0" y1="0" x2="200" y2="200" stroke="#00A499" strokeWidth="0.5" />
          <line x1="40" y1="0" x2="200" y2="160" stroke="#00A499" strokeWidth="0.5" />
          <line x1="80" y1="0" x2="200" y2="120" stroke="#00A499" strokeWidth="0.5" />
          <line x1="120" y1="0" x2="200" y2="80" stroke="#00A499" strokeWidth="0.5" />
          <line x1="160" y1="0" x2="200" y2="40" stroke="#00A499" strokeWidth="0.5" />
          <line x1="0" y1="40" x2="160" y2="200" stroke="#00A499" strokeWidth="0.5" />
          <line x1="0" y1="80" x2="120" y2="200" stroke="#00A499" strokeWidth="0.5" />
          <line x1="0" y1="120" x2="80" y2="200" stroke="#00A499" strokeWidth="0.5" />
          <line x1="0" y1="160" x2="40" y2="200" stroke="#00A499" strokeWidth="0.5" />
        </svg>

        {/* Dot grid — top right */}
        <svg className="absolute top-[10%] right-[3%] w-[320px] h-[320px] opacity-[0.12]" viewBox="0 0 100 100">
          {Array.from({ length: 8 }).map((_, row) =>
            Array.from({ length: 8 }).map((_, col) => (
              <circle key={`dot-${row}-${col}`} cx={6 + col * 13} cy={6 + row * 13} r="1.2" fill="#00A499" />
            ))
          )}
        </svg>

        {/* Rounded squares — mid left */}
        <svg className="absolute top-[48%] left-[2%] w-[300px] h-[300px] opacity-[0.08]" viewBox="0 0 200 200">
          <rect x="15" y="15" width="170" height="170" rx="30" fill="none" stroke="#F97316" strokeWidth="0.6" />
          <rect x="40" y="40" width="120" height="120" rx="22" fill="none" stroke="#F97316" strokeWidth="0.6" />
          <rect x="65" y="65" width="70" height="70" rx="14" fill="none" stroke="#F97316" strokeWidth="0.6" />
        </svg>

        {/* Circle cluster — bottom left */}
        <svg className="absolute bottom-[12%] left-[12%] w-[250px] h-[250px] opacity-[0.1]" viewBox="0 0 100 100">
          <circle cx="30" cy="30" r="22" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <circle cx="62" cy="22" r="14" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <circle cx="45" cy="58" r="18" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <circle cx="78" cy="55" r="10" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <circle cx="22" cy="72" r="12" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <circle cx="68" cy="78" r="8" fill="none" stroke="#00A499" strokeWidth="0.5" />
        </svg>

        {/* Arc waves — top center */}
        <svg className="absolute top-[2%] left-[35%] w-[400px] h-[220px] opacity-[0.07]" viewBox="0 0 200 100">
          <path d="M 5 95 Q 100 -20 195 95" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <path d="M 25 95 Q 100 5 175 95" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <path d="M 45 95 Q 100 25 155 95" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <path d="M 65 95 Q 100 45 135 95" fill="none" stroke="#00A499" strokeWidth="0.5" />
        </svg>

        {/* Diamond — right center */}
        <svg className="absolute top-[38%] right-[6%] w-[220px] h-[220px] opacity-[0.08]" viewBox="0 0 100 100">
          <polygon points="50,3 97,50 50,97 3,50" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <polygon points="50,16 84,50 50,84 16,50" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <polygon points="50,29 71,50 50,71 29,50" fill="none" stroke="#00A499" strokeWidth="0.5" />
          <line x1="50" y1="3" x2="50" y2="97" stroke="#00A499" strokeWidth="0.3" />
          <line x1="3" y1="50" x2="97" y2="50" stroke="#00A499" strokeWidth="0.3" />
        </svg>

        {/* Small crosses pattern — bottom center */}
        <svg className="absolute bottom-[5%] left-[40%] w-[300px] h-[150px] opacity-[0.08]" viewBox="0 0 200 80">
          {Array.from({ length: 4 }).map((_, row) =>
            Array.from({ length: 7 }).map((_, col) => (
              <g key={`cross-${row}-${col}`}>
                <line x1={14 + col * 28 - 4} y1={12 + row * 20} x2={14 + col * 28 + 4} y2={12 + row * 20} stroke="#00A499" strokeWidth="0.5" />
                <line x1={14 + col * 28} y1={12 + row * 20 - 4} x2={14 + col * 28} y2={12 + row * 20 + 4} stroke="#00A499" strokeWidth="0.5" />
              </g>
            ))
          )}
        </svg>

        {/* Color blobs */}
        <div className="absolute top-[18%] right-[20%] w-[350px] h-[350px] rounded-full bg-[#00A499]/[0.04] blur-[80px]" />
        <div className="absolute bottom-[20%] left-[5%] w-[300px] h-[300px] rounded-full bg-[#F97316]/[0.035] blur-[80px]" />
        <div className="absolute top-[55%] left-[45%] w-[250px] h-[250px] rounded-full bg-[#00A499]/[0.03] blur-[60px]" />
        <div className="absolute top-[5%] left-[60%] w-[200px] h-[200px] rounded-full bg-[#F97316]/[0.025] blur-[60px]" />
      </div>

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
        )}

        {/* Content Area */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'dashboard' && (
            <KanbanBoard
              projects={filteredProjects}
              onProjectClick={setSelectedProject}
            />
          )}

          {activeTab === 'stats' && (
            <StatsView projects={filteredProjects} />
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
