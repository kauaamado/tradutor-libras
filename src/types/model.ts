/** Progresso do treinamento emitido a cada época. */
export interface TrainingProgress {
  /** Época atual (1‑based). */
  epoch: number;
  /** Total de épocas configuradas. */
  totalEpochs: number;
  /** Perda no conjunto de treino. */
  loss: number;
  /** Acurácia no conjunto de treino (0‑1). */
  accuracy: number;
  /** Perda no conjunto de validação. */
  valLoss: number;
  /** Acurácia no conjunto de validação (0‑1). */
  valAccuracy: number;
}

/** Resultado final do treinamento. */
export interface TrainingResult {
  /** Acurácia no conjunto de teste (0‑1). */
  accuracy: number;
  /** Perda no conjunto de teste. */
  loss: number;
  /** Acurácia de validação na última época. */
  valAccuracy: number;
  /** Perda de validação na última época. */
  valLoss: number;
  /** Quantidade de épocas executadas. */
  epochs: number;
  /** Número de classes do modelo. */
  numClasses: number;
}

/** Informações sobre o modelo salvo. */
export interface ModelInfo {
  /** Se existe um modelo treinado salvo. */
  trained: boolean;
  /** Número de classes do modelo. */
  numClasses: number;
  /** Labels mapeadas (índice → letra). */
  labels: string[];
  /** Acurácia registrada no último treino (0‑1). */
  accuracy: number;
  /** Timestamp do último treino. */
  trainedAt: number;
}
