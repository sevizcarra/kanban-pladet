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
  categoriaProyecto?: string;
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
    compraAceptacionOC?: boolean;
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
  frozen?: boolean;  // Proyecto congelado
  sortOrder?: number; // Orden dentro de la columna
  dashboardType?: "compras" | "obras"; // Tipo de dashboard
  cuadrillas?: string[]; // Cuadrillas asignadas (obras)
  // Recinto (location grouping — links related purchases for the same physical location)
  recinto?: string;                    // e.g. "Planta Nitrógeno FACIMED"
  // STD Integration
  memos?: MemoLink[];                   // Memorándums vinculados (multi-memo)
  dataSource?: "manual" | "std" | "mixed"; // Origen de los datos
  stdAsunto?: string;                   // Título original del STD
  stdCuerpoDoc?: string;               // Cuerpo del documento STD (referencia)
  // Field-level timestamps: tracks when each field was last set/modified
  fieldTimestamps?: Record<string, string>; // { fieldName: ISO date string }
}

export interface MemoLink {
  key: string;          // "MEM-2026-3899"
  tipo: "cdp" | "licitacion" | "cotizacion" | "pago" | "compra_agil" | "resolucion" | "otro";
  asunto: string;       // Asunto del memo en el STD
  fecha: string;        // Fecha del correo/memo
}

export interface Comment {
  id: string;
  authorEmail: string;
  content: string;
  mentions: string[];
  createdAt: string;
}
