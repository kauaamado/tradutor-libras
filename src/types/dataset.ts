/** Uma entrada do dataset: 63 features (21 landmarks × 3 eixos) + label. */
export interface DatasetEntry {
  features: number[];
  label: string;
}

/** Metadados do dataset completo. */
export interface DatasetMetadata {
  id: string;
  name: string;
  createdAt: number;
  entries: DatasetEntry[];
}

/** Estatísticas de coleta por label. */
export interface DatasetStats {
  label: string;
  count: number;
}
