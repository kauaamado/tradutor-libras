interface ConsentDialogProps {
  /** Exibe ou esconde o diálogo. */
  open: boolean;
  /** Callback quando o usuário aceita baixar o modelo LLM. */
  onAccept: () => void;
  /** Callback quando o usuário prefere fallback heurístico. */
  onFallback: () => void;
  /** Callback quando o usuário fecha o diálogo sem decidir. */
  onClose: () => void;
}

/**
 * Diálogo de transparência — informa ao usuário sobre o download de modelo
 * de IA, privacidade, e limitações antes de prosseguir com a tradução via LLM.
 */
export function ConsentDialog({
  open,
  onAccept,
  onFallback,
  onClose,
}: ConsentDialogProps) {
  if (!open) return null;

  return (
    <div
      className="consent-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="consent-panel">
        <div className="consent-header">
          <p className="consent-kicker">Aviso de transparência</p>
          <h2 id="consent-title">Modelo de Inteligência Artificial</h2>
          <button
            className="consent-close"
            type="button"
            onClick={onClose}
            aria-label="Fechar diálogo"
          >
            ×
          </button>
        </div>

        <div className="consent-body">
          <p>
            Para gerar frases naturais a partir dos sinais, o sistema utiliza o{' '}
            <strong>Qwen2.5-0.5B-Instruct</strong>, um modelo de linguagem que
            será baixado automaticamente do CDN do Hugging Face.
          </p>

          <ul>
            <li>
              <strong>Tamanho do modelo:</strong> ~500 MB.
            </li>
            <li>
              <strong>Privacidade:</strong> tudo roda localmente no seu
              navegador — nenhum dado pessoal, imagem da webcam ou texto é
              enviado para servidores externos.
            </li>
            <li>
              <strong>Pré-requisito:</strong> o modelo requer WebGPU, disponível
              apenas no Chrome/Edge com aceleração de hardware. Sem WebGPU, o
              sistema usa uma montagem simples baseada em templates.
            </li>
            <li>
              <strong>Funcionalidade beta:</strong> a qualidade das frases pode
              variar conforme o contexto e a combinação de sinais.
            </li>
            <li>
              <strong>Primeira execução:</strong> o download pode levar de 1 a 5
              minutos, dependendo da sua conexão. Downloads futuros usam o cache
              do navegador.
            </li>
          </ul>
        </div>

        <div className="consent-actions">
          <button
            className="primary-button"
            type="button"
            onClick={onAccept}
            autoFocus
          >
            Baixar modelo
          </button>
          <button
            className="consent-secondary"
            type="button"
            onClick={onFallback}
          >
            Tradução simples sem IA
          </button>
        </div>
      </div>
    </div>
  );
}
