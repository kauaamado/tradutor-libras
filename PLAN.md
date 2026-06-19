# PLAN.md: Intérprete Inteligente de LIBRAS

## 1. Visão Geral do Projeto

**Objetivo:** Desenvolver uma aplicação local em Python que capture gestos em LIBRAS via webcam, reconheça os sinais utilizando Visão Computacional e Machine Learning, e converta a sequência de sinais em uma frase natural em português utilizando um LLM local.
**Metodologia:** Spec-Driven Development (SDD). O desenvolvimento será modular, validando cada etapa antes de avançar para a próxima.

## 2. Stack Tecnológica

* **Linguagem:** Python 3.10+
* **Visão Computacional:** OpenCV (`opencv-python`)
* **Rastreamento de Mãos:** MediaPipe (`mediapipe`)
* **Machine Learning (Reconhecimento de Sinais):** `scikit-learn` (para o MVP de sinais estáticos) e `numpy`
* **Processamento de Linguagem Natural (NLP):** Ollama (rodando localmente com modelo `llama3` ou `gemma`)
* **Interface:** Janela OpenCV para feedback visual

## 3. Arquitetura do Sistema

O sistema será dividido em 4 módulos principais:

1. **Módulo de Captura (Coleta):** Captura vídeo e extrai coordenadas 3D (landmarks) das mãos. Salva os dados em CSV para treinamento.
2. **Módulo de Treinamento:** Lê os dados em CSV e treina um classificador de Machine Learning, salvando o modelo compilado.
3. **Módulo de Inferência (Visão):** Captura o vídeo em tempo real, extrai landmarks, passa pelo modelo treinado e empilha as palavras detectadas.
4. **Módulo de NLP:** Recebe o array de palavras detectadas e consome a API local do Ollama para formular a frase final.

---

## 4. Fases de Implementação e Especificações (Specs)

### Fase 1: Setup e Rastreamento de Mãos

**Objetivo:** Configurar o ambiente e capturar os landmarks das mãos com sucesso.

* [ ] Criar ambiente virtual e arquivo `requirements.txt`.
* [ ] Criar script `data_collection.py`.
* [ ] Integrar OpenCV para abrir a webcam.
* [ ] Integrar MediaPipe Hands para processar cada frame e desenhar os landmarks na tela.
* [ ] **Spec de Aceitação:** A webcam deve abrir sem lag, e as conexões (esqueleto) da mão devem ser desenhadas corretamente sobre a mão do usuário em tempo real.

### Fase 2: Coleta de Dados para Treinamento (Dataset)

**Objetivo:** Permitir que o usuário grave exemplos de sinais.

* [ ] Atualizar `data_collection.py` para incluir lógica de gravação.
* [ ] Ao pressionar uma tecla (ex: 'S'), o sistema deve pedir o nome da classe (ex: "EU", "QUERER", "ÁGUA").
* [ ] Gravar N frames consecutivos da mão, extraindo as coordenadas X, Y, Z de todos os 21 pontos.
* [ ] Salvar as coordenadas em um arquivo `dataset.csv` onde a última coluna é a label (classe).
* [ ] **Spec de Aceitação:** O arquivo CSV deve ser gerado contendo linhas com 63 valores numéricos (21 pontos * 3 eixos) mais a string da label no final, sem dados nulos.

### Fase 3: Treinamento do Modelo de Machine Learning

**Objetivo:** Criar o cérebro que entende os sinais estáticos.

* [ ] Criar script `train_model.py`.
* [ ] Carregar dados de `dataset.csv` usando Pandas ou Numpy.
* [ ] Dividir os dados em treino e teste (ex: 80/20).
* [ ] Treinar um modelo Random Forest ou SVM utilizando `scikit-learn`.
* [ ] Avaliar a precisão do modelo no terminal.
* [ ] Salvar o modelo em um arquivo `model.pkl` usando `pickle` ou `joblib`.
* [ ] **Spec de Aceitação:** O script deve rodar do início ao fim, imprimir uma acurácia superior a 85% e gerar o arquivo `model.pkl` válido.

### Fase 4: Inferência em Tempo Real

**Objetivo:** Juntar a visão com o modelo treinado para traduzir ao vivo.

* [ ] Criar script `app.py`.
* [ ] Carregar o modelo `model.pkl`.
* [ ] Inicializar webcam e MediaPipe.
* [ ] Para cada frame com uma mão detectada, extrair os landmarks, formatá-los exatamente como na Fase 2, e prever a classe usando o modelo.
* [ ] Desenhar a palavra prevista na tela (OpenCV `putText`).
* [ ] Implementar uma lógica de "debounce" (só confirmar a palavra se o modelo prevê-la repetidamente por X frames seguidos) para evitar ruídos.
* [ ] **Spec de Aceitação:** O sistema deve exibir a palavra correta na tela quando o usuário fizer um dos sinais treinados na Fase 2, de forma estável.

### Fase 5: Integração com LLM (Ollama) para Frases

**Objetivo:** Transformar sinais isolados em uma frase natural.

* [ ] Atualizar `app.py`.
* [ ] Criar uma fila (lista) de palavras detectadas (ex: `["EU", "QUERER", "ÁGUA"]`).
* [ ] Criar um gatilho (ex: pressionar a tecla 'Enter' ou cruzar os braços/abaixar a mão) para finalizar a frase.
* [ ] Quando o gatilho for acionado, enviar um request HTTP local para o Ollama (URL: `http://localhost:11434/api/generate`).
* [ ] **Prompt Base:** `"Você é um tradutor de LIBRAS. Transforme as seguintes palavras extraídas de sinais em uma frase fluente, natural e gramaticalmente correta em português. Retorne APENAS a frase traduzida, sem explicações. Palavras: {lista_palavras}"`.
* [ ] Exibir a frase final retornada pelo Ollama na tela (ou no terminal).
* [ ] **Spec de Aceitação:** O sistema deve receber um array de strings estáticas, passar para o Ollama rodando em background e retornar uma frase contínua e correta em português.

---

## 5. Regras de Desenvolvimento para o Agente IA

1. **Um passo de cada vez:** Não tente implementar o Módulo 3 sem que o Módulo 1 e 2 estejam 100% funcionais e testados pelo usuário.
2. **Tratamento de Erros:** Sempre adicione blocos `try-except`, especialmente na captura de vídeo e na comunicação com a API do Ollama.
3. **Logs:** Adicione prints no console para indicar o status atual ("Iniciando webcam...", "Carregando modelo...", "Aguardando Ollama...").
4. **Refatoração Contínua:** Mantenha o código limpo, modular e documentado usando docstrings.
