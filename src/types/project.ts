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
  fechaRecepcionMemo?: string;
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
  tipoLicitacion?: string;
  // Sub-etapas (checkboxes de avance)
  subEtapas?: {
    disenoArquitectura?: boolean;
    disenoEspecialidades?: boolean;
    compraCDP?: boolean;
    compraEnProceso?: boolean;
    compraEvaluacionAdj?: boolean;
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
  // Modificaciones de Contrato
  mcdCount?: number;
  mcdData?: Array<{
    monto?: string;
    descripcion?: string;
    fecha?: string;
  }>;
  // Ubicación
  ubicacionNombre?: string;
  ubicacionLat?: number;
  ubicacionLng?: number;
  // Metadata
  createdAt?: string;
  commentCount?: number;
  flagged?: boolean; // Baliza de alerta visual
}

export interface Comment {
  id: string;
  authorEmail: string;
  content: string;
  mentions: string[];
  createdAt: string;
}
