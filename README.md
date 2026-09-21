# Central OCR Oficina

Aplicação web local para ler campos selecionados de relatórios em PDF e acrescentar novas linhas em uma planilha Excel central existente.

## Regras implementadas

- O.S.: extraída do campo **Orçamento**.
- Cliente: extraído do campo **Razão**.
- Potência: extraída do campo **Potência**.
- Cor: derivada somente das letras no final do Nº Série:
  - AZ → AZ
  - BR → BR
  - AM → AM
  - qualquer outro caso sem código → ROSA
- Técnico: escolhido manualmente a partir de uma lista fixa, com pesquisa/digitação.
- Data: data local do computador no momento do lançamento.
- Data final: extraída do campo **Entrega**; pode permanecer vazia.
- Status:
  - sem data final → NO PRAZO
  - data atual > data final → ATRASADO
  - caso contrário → NO PRAZO
- Rebobinamento: definido manualmente por uma caixa de seleção.
  - desmarcado → grava somente em MONTADOS
  - marcado → grava em MONTADOS e ENROLADOR
- Duplicidade: a mesma O.S. não é inserida novamente na mesma aba.

## Segurança operacional

Antes de alterar o Excel, a aplicação cria uma cópia de segurança local do arquivo XLSM.

O arquivo Excel original **não faz parte do repositório**. O caminho da planilha é configurado no computador onde a aplicação roda.

## Estrutura

- `app/main.py`: API FastAPI e interface web.
- `app/services/ocr.py`: OCR e extração dos campos.
- `app/services/excel_writer.py`: inclusão segura de linhas no XLSM.
- `app/config.py`: configuração local.
- `config/technicians.json`: lista inicial de técnicos baseada na planilha fornecida.
- `app/static/`: interface web.

## Execução local

1. Instale Python 3.11+.
2. Instale o Tesseract OCR e deixe o executável no PATH, ou informe `TESSERACT_CMD`.
3. Copie `.env.example` para `.env`.
4. Ajuste `XLSM_PATH` para o caminho da sua planilha central.
5. Instale as dependências:

```bash
pip install -r requirements.txt
```

6. Inicie:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

7. Abra `http://127.0.0.1:8000`.

## Produtividade Oficina

A nova substituição web da planilha está em [produtividade/](./produtividade/).

A versão pública não inclui os dados reais da oficina. Para usar a base real, exporte um backup JSON da aplicação local e restaure-o na aplicação web.
