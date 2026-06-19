# design.md - Design e Convenções do Tradutor-LIBRAS

## 1. Princípios de Design

* **Minimalismo Funcional:** A interface deve exibir apenas o essencial: feed da webcam e controles mínimos. Nada de painéis laterais, menus complexos ou informações desnecessárias.
* **Feedback Visual Imediato:** O usuário deve sempre saber o que o sistema está fazendo (palavra detectada, frase traduzida, status de carregamento).
* **Separação de Camadas:** A lógica de negócio (inferência, NLP) é totalmente desacoplada da interface (OpenCV). A UI apenas consome dados das camadas internas.

---

## 2. Layout da Interface

A aplicação abre em uma única janela fullscreen ou maximizada com o feed da webcam ocupando toda a área.

```
┌──────────────────────────────────────────────────┐
│                                                  │
│                                                  │
│              FEED DA WEBCAM                      │
│              (com overlay de landmarks)          │
│                                                  │
│                                                  │
│  ┌────────────────────────┐                      │
│  │ Palavra: "EU"          │   ← badge de detecção│
│  └────────────────────────┘                      │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │ Frase: "Eu quero água"                   │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│                                                  │
│  [🌐 PT-BR ▼]   [⏹ Encerrar]   [🗑 Limpar]       │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Componentes da UI

| Componente | Descrição | Posicionamento |
| ----------- | ----------- | ---------------- |
| Feed da Webcam | Stream de vídeo ao vivo com landmarks desenhados sobre a mão | Ocupa toda a janela (plano de fundo) |
| Badge de Detecção | Palavra atual detectada pelo modelo, sobreposta ao feed | Canto superior esquerdo, sobre o vídeo |
| Área de Frase | Frase traduzida retornada pelo LLM | Parte inferior central, sobre o vídeo, com fundo semitransparente |
| Seletor de Idioma | Dropdown/combobox para escolher o idioma de saída (PT-BR, EN, ES) | Parte inferior esquerda |
| Botão Encerrar | Encerra a sessão de captura e finaliza a frase | Parte inferior direita |
| Botão Limpar | Reseta a fila de palavras e a frase exibida | Parte inferior direita |

---

## 3. Convenções de Estilo e Código

### 3.1 Nomenclatura (PEP 8)

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Variáveis e funções | `snake_case` | `landmarks_list`, `predict_gesture()` |
| Classes | `PascalCase` | `HandTracker`, `SignClassifier` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_DEBOUNCE_FRAMES`, `OLLAMA_URL` |
| Módulos/Arquivos | `snake_case` | `data_collection.py`, `train_model.py` |
| Pacotes/Diretórios | `snake_case` | `captura/`, `inferencia/` |

### 3.2 Tipagem

* Todas as funções e métodos públicos devem ter type hints.
* Use `typing` para tipos compostos quando necessário.

```python
def detect_hands(frame: np.ndarray, hands: mp.solutions.hands.Hands) -> list[dict[str, float]]:
    ...

def translate_to_sentence(words: list[str], language: str) -> str:
    ...
```

### 3.3 Docstrings

* Formato: Google Style.
* Obrigatórias em módulos, classes e funções públicas.

```python
"""Módulo de rastreamento de mãos via MediaPipe."""

class HandTracker:
    """Rastreia mãos em frames de vídeo usando MediaPipe Hands."""

    def process_frame(self, frame: np.ndarray) -> list[dict]:
        """Processa um frame e retorna os landmarks detectados.

        Args:
            frame: Array numpy representando a imagem BGR.

        Returns:
            Lista de dicionários com coordenadas dos landmarks.

        Raises:
            ValueError: Se o frame for None ou vazio.
        """
```

### 3.4 Imports

* Ordem: biblioteca padrão → terceiros → projeto local.
* Um import por linha (exceto imports do mesmo módulo com parenteses).
* Sem imports curinga (`from module import *`).

```python
import logging
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np

from src.captura.hand_tracker import HandTracker
```

### 3.5 Tratamento de Erros

* `try-except` obrigatório em: captura de vídeo, chamadas ao Ollama, carregamento de modelo.
* Nunca silencie exceções. Use `logging.error()` ou `logging.warning()`.
* Levante exceções específicas, não `Exception` genérico.

```python
try:
    response = requests.post(OLLAMA_URL, json=payload, timeout=10)
    response.raise_for_status()
except requests.Timeout:
    logging.error("Timeout ao comunicar com Ollama")
    raise OllamaConnectionError("Ollama não respondeu no tempo esperado")
except requests.ConnectionError:
    logging.error("Ollama não está acessível em %s", OLLAMA_URL)
    raise OllamaConnectionError("Não foi possível conectar ao Ollama")
```

### 3.6 Logging

* Use o módulo `logging` do Python. Nunca use `print()` para saída de status.
* Níveis: `DEBUG` (desenvolvimento), `INFO` (operações normais), `WARNING` (problemas recuperáveis), `ERROR` (falhas críticas).
* Configure logging centralizado no ponto de entrada (`app.py`).

```python
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
```

---

## 4. Arquitetura de Módulos

```
src/
├── captura/
│   ├── __init__.py
│   ├── hand_tracker.py       # Classe HandTracker (MediaPipe)
│   └── data_collector.py     # Lógica de gravação de dataset
├── treinamento/
│   ├── __init__.py
│   └── model_trainer.py      # Classe ModelTrainer (scikit-learn)
├── inferencia/
│   ├── __init__.py
│   └── sign_classifier.py    # Classe SignClassifier (carrega model.pkl)
├── nlp/
│   ├── __init__.py
│   └── ollama_client.py     # Classe OllamaClient (HTTP para API local)
└── ui/
    ├── __init__.py
    └── window.py             # Classe AppWindow (OpenCV UI)
```

### Fluxo de Dependência

```
app.py
  ├── ui/window.py            → Renderiza feed e controles
  │     ├── captura/hand_tracker.py       → Detecta mãos
  │     └── inferencia/sign_classifier.py  → Classifica sinais
  │           └── treinamento/model_trainer.py (indireto, via model.pkl)
  └── nlp/ollama_client.py    → Gera frases
```

As setas indicam dependência. A camada `ui` depende de `captura` e `inferencia`. A camada `nlp` é independente e chamada via evento (gatilho do usuário).

---

## 5. Design Visual (OpenCV UI)

### 5.1 Cores (BGR no OpenCV)

| Elemento | Cor | Código BGR |
|----------|-----|------------|
| Fundo do badge de detecção | Verde escuro semitransparente | `(0, 100, 0)` |
| Texto da palavra detectada | Branco | `(255, 255, 255)` |
| Fundo da área de frase | Preto semitransparente | `(0, 0, 0)` |
| Texto da frase | Branco | `(255, 255, 255)` |
| Landmarks da mão | Verde claro | `(0, 255, 0)` |
| Conexões (esqueleto) | Verde escuro | `(0, 200, 0)` |
| Botões (highlight ao hover) | Azul | `(255, 150, 0)` |

### 5.2 Fontes e Tamanhos

| Elemento | Fonte OpenCV | Escala | Espessura |
|----------|-------------|--------|-----------|
| Palavra detectada | `FONT_HERSHEY_SIMPLEX` | 1.2 | 2 |
| Frase traduzida | `FONT_HERSHEY_SIMPLEX` | 1.0 | 2 |
| Status/Status de carregamento | `FONT_HERSHEY_SIMPLEX` | 0.7 | 1 |
| Labels de botões | `FONT_HERSHEY_SIMPLEX` | 0.6 | 1 |

### 5.3 Sobreposição (Overlay)

Todos os elementos de UI são desenhados como overlay sobre o frame da webcam usando `cv2.putText()`, `cv2.rectangle()` e `cv2.addWeighted()` para fundos semitransparentes. Não há widgets nativos — a interface é inteiramente renderizada sobre o vídeo.

### 5.4 Interação pelo Usuário

| Ação | Tecla/Controle | Resultado |
|------|---------------|-----------|
| Iniciar gravação de sinal | `S` | Solicita nome da classe e grava frames |
| Confirmar frase (enviar ao LLM) | `Enter` | Envia palavras acumuladas ao Ollama |
| Limpar palavras/frase | `C` | Reseta fila de palavras e frase exibida |
| Encerrar aplicação | `ESC` ou `Q` | Encerra loop, libera câmera e fecha janelas |
| Trocar idioma | `1`, `2`, `3` | Alterna idioma de saída (PT-BR, EN, ES) |

---

## 6. Formato de Dados

### 6.1 Dataset (dataset.csv)

```
x0,y0,z0,x1,y1,z1,...,x20,y20,z20,label
0.45,0.32,0.01,...,0.67,0.45,0.02,EU
0.44,0.31,0.01,...,0.66,0.44,0.01,EU
0.50,0.28,0.02,...,0.70,0.50,0.03,QUERER
```

* 63 colunas de float (21 landmarks × 3 eixos) + 1 coluna label (string).
* Sem dados nulos.

### 6.2 Modelo (model.pkl)

* Serializado com `joblib` ou `pickle`.
* Deve conter apenas o classificador treinado (sem pré-processadores externos, a menos que empacotados juntos).

### 6.3 Payload para o Ollama

```json
{
  "model": "llama3",
  "prompt": "Você é um tradutor de LIBRAS. Transforme as seguintes palavras extraídas de sinais em uma frase fluente, natural e gramaticalmente correta em português. Retorne APENAS a frase traduzida, sem explicações. Palavras: EU, QUERER, ÁGUA",
  "stream": false
}
```

---

## 7. Padrões de Commits

Formato: `<tipo>(<escopo>): <descrição em PT-BR>`

| Tipo | Uso |
|------|-----|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `refactor` | Refatoração sem mudança de comportamento |
| `docs` | Documentação |
| `test` | Testes |
| `chore` | Tarefas de manutenção (deps, configs) |

**Exemplos:**

```
feat(captura): adiciona integração com MediaPipe para rastreamento de mãos
fix(inferencia): corrige debounce de predições para evitar flickering
refactor(nlp): separa cliente Ollama em classe dedicada
docs(readme): atualiza instruções de instalação
test(treinamento): adiciona testes de validação de acurácia do modelo
chore(deps): atualiza scikit-learn para 1.4
```

---

## 8. Branches e GitFlow

``` files
main
 └── dev
      ├── feat/captura-mediapipe
      ├── feat/coleta-dataset
      ├── feat/treinamento-modelo
      ├── feat/inferencia-tempo-real
      └── feat/integracao-ollama
```

* **`main`**: Branch de produção. Recebe apenas merges de `dev` via PR.
* **`dev`**: Branch de desenvolvimento. Features são mescladas aqui.
* **`feat/*`**: Branches de feature, criadas a partir de `dev`.
* **Nunca faça commit direto em `main`.**
