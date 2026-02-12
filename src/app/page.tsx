'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import KanbanBoard from '@/components/KanbanBoard';
import ProjectDetail from '@/components/ProjectDetail';
import StatsView from '@/components/StatsView';
import TimelineView from '@/components/TimelineView';
import CreateProjectModal from '@/components/CreateProjectModal';
import {
  subscribeProjects,
  createProject,
  updateProject,
  deleteProject,
  seedIfEmpty,
} from '@/lib/firestore';
import { Project } from '@/types/project';
import {
  LayoutDashboard,
  BarChart3,
  Clock,
  Plus,
  Filter,
  Search,
} from 'lucide-react';
import { STATUSES, PRIORITIES } from '@/lib/constants';

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'stats' | 'timeline'>(
    'dashboard'
  );
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAndSubscribe = async () => {
      try {
        await seedIfEmpty();
        const unsubscribe = subscribeProjects((newProjects) => {
          setProjects(newProjects);
          setLoading(false);
        });
        return unsubscribe;
      } catch (error) {
        console.error('Error initializing projects:', error);
        setLoading(false);
      }
    };

    let unsubscribe: (() => void) | undefined;
    initializeAndSubscribe().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
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

  if (selectedProject && matchingProject) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <ProjectDetail
          project={matchingProject}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onBack={() => setSelectedProject(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Tab Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === 'stats'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BarChart3 size={18} />
              Estadísticas
            </button>
            <button
              onClick={() => setActiveTab('timeline')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                activeTab === 'timeline'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Clock size={18} />
              Línea de Tiempo
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-1">
              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter size={18} className="text-gray-400" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="all">Todas las Prioridades</option>
                {Object.entries(PRIORITIES).map(([key, prio]) => (
                  <option key={key} value={key}>
                    {prio.label}
                  </option>
                ))}
              </select>

              {/* Search Input */}
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search size={18} className="text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por título o memorándum..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg flex-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>

            {/* Create Project Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded-lg font-medium hover:bg-teal-600 transition-colors whitespace-nowrap"
            >
              <Plus size={18} />
              Nuevo Proyecto
            </button>
          </div>
        </div>
      </div>

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
