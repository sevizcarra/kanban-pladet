export interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: "alta" | "media" | "baja";
  memorandumNumber: string;
  requestingUnit: string;
  contactName: string;
  contactEmail: string;
  budget: string;
  dueDate: string | null;
  tipoFinanciamiento: string | null;
  codigoProyectoUsa: string;
  tipoDesarrollo: string;
  disciplinaLider: string;
  sector: string;
  // Antecedentes Generales
  fechaLicitacion?: string;
  fechaPublicacion?: string;
  idLicitacion?: string;
  codigoProyectoDCI?: string;
  fechaVencimientoRecursos?: string;
  // Equipo
  jefeProyectoId?: number;
  inspectorId?: number;
  profesionalAsignado?: string;
  especialidades?: string[];
  // Sub-etapas (checkboxes de avance)
  subEtapas?: {
    disenoArquitectura?: boolean;
    disenoEspecialidades?: boolean;
    compraCDP?: boolean;
    compraDOCL?: boolean;
  };
  // Ejecución
  fechaInicioObra?: string;
  plazoEjecucion?: string;
  fechaEstimadaTermino?: string;
  fechaVencGarantia?: string;
  fechaRecProviso?: string;
  fechaRecDefinitiva?: string;
  // Docs
  edpCount?: number;
  retCount?: number;
  ndcCount?: number;
  // Metadata
  createdAt?: string;
}
