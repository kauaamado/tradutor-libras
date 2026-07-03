import { useCallback, useRef, useState } from 'react';
import type * as tf from '@tensorflow/tfjs';

import type { TrainingProgress, TrainingResult, ModelInfo } from '@/types/model';
import {
  createModel,
  prepareDataset,
  trainModel,
  saveModel,
  loadModel,
  saveModelMetadata,
  loadModelMetadata,
  exportModel as exportTfModel,
} from '@/modules/training/modelTrainer';
import { getAllSamples } from '@/modules/training/dataCollector';

/** Estados do modelo. */
export type ModelStatus = 'none' | 'training' | 'trained' | 'error';

interface UseTrainingReturn {
  /** Status atual do modelo. */
  modelStatus: ModelStatus;
  /** Se está treinando no momento. */
  isTraining: boolean;
  /** Progresso da época atual. */
  progress: TrainingProgress | null;
  /** Resultado final do treinamento. */
  result: TrainingResult | null;
  /** Metadados do modelo salvo. */
  modelInfo: ModelInfo;
  /** Mensagem de erro, se houver. */
  error: string | null;
  /** Inicia o treinamento com as amostras do IndexedDB. */
  train: () => Promise<void>;
  /** Verifica se existe modelo salvo. */
  checkModel: () => void;
  /** Exporta o modelo treinado. */
  exportModel: () => Promise<void>;
}

/**
 * Hook que gerencia o ciclo de vida do modelo TF.js:
 * carregar, treinar, salvar e exportar.
 */
export function useTraining(): UseTrainingReturn {
  const [modelStatus, setModelStatus] = useState<ModelStatus>('none');
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState<TrainingProgress | null>(null);
  const [result, setResult] = useState<TrainingResult | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo>(loadModelMetadata);
  const [error, setError] = useState<string | null>(null);

  // Guarda referência ao modelo para exportação posterior (ref, não state —
  // TF.js LayersModel não é serializável e quebra o React se colocado em state).
  const trainedModelRef = useRef<tf.LayersModel | null>(null);

  /** Verifica se há modelo salvo no IndexedDB. */
  const checkModel = useCallback(() => {
    const info = loadModelMetadata();
    setModelInfo(info);
    if (info.trained) {
      setModelStatus('trained');
      console.info('[useTraining] Modelo encontrado:', info.labels.length, 'classes.');
    } else {
      setModelStatus('none');
      console.info('[useTraining] Nenhum modelo treinado.');
    }
  }, []);

  /** Fluxo completo de treinamento. */
  const train = useCallback(async () => {
    setIsTraining(true);
    setModelStatus('training');
    setError(null);
    setProgress(null);
    setResult(null);

    try {
      // 1. Carregar amostras
      const samples = await getAllSamples();
      if (samples.length === 0) {
        throw new Error('Nenhuma amostra no dataset. Colete dados antes de treinar.');
      }

      // 2. Preparar dataset
      const { xs, ys, labels } = prepareDataset(samples);
      if (labels.length < 2) {
        xs.dispose();
        ys.dispose();
        throw new Error(
          `Dataset contém apenas ${labels.length} classe(s). São necessárias pelo menos 2 classes para treinar.`,
        );
      }

      console.info(
        '[useTraining] Iniciando treino com',
        samples.length,
        'amostras,',
        labels.length,
        'classes.',
      );

      // 3. Criar modelo
      const model = createModel(labels.length);

      // 4. Treinar com callback de progresso
      const trainingResult = await trainModel(model, xs, ys, {
        validationSplit: 0.2,
        epochs: 50,
        batchSize: 8,
        testSplit: 0.2,
        onProgress: (p) => setProgress(p),
      });

      // 5. Salvar modelo + metadados
      await saveModel(model);
      saveModelMetadata(labels, trainingResult.accuracy);

      setResult(trainingResult);
      setModelInfo(loadModelMetadata());
      trainedModelRef.current = model;
      setModelStatus('trained');

      console.info(
        '[useTraining] Treino concluído: acurácia =',
        (trainingResult.accuracy * 100).toFixed(1) + '%',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido ao treinar.';
      setError(msg);
      setModelStatus('error');
      console.error('[useTraining] Erro no treino:', msg);
    } finally {
      setIsTraining(false);
    }
  }, []);

  /** Exporta o modelo treinado. */
  const exportModel = useCallback(async () => {
    try {
      const model = trainedModelRef.current ?? (await loadModel());
      if (!model) {
        throw new Error('Nenhum modelo treinado para exportar.');
      }
      // Atualiza a ref se carregou do IndexedDB
      trainedModelRef.current ??= model;
      const info = loadModelMetadata();
      await exportTfModel(model, info.labels);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao exportar modelo.';
      setError(msg);
      console.error('[useTraining] Erro na exportação:', msg);
    }
  }, []);

  return {
    modelStatus,
    isTraining,
    progress,
    result,
    modelInfo,
    error,
    train,
    checkModel,
    exportModel,
  };
}
