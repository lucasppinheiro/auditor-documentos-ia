# Conjunto de dados sintético

## Finalidade

Este conjunto existe exclusivamente para demonstrar e testar o Auditor de Documentos com IA. Nenhum registro representa cliente, fornecedor, colaborador, conta bancária, documento fiscal ou operação real.

## Autoria e proveniência

- Os dados são gerados deterministicamente pelo próprio código do projeto.
- Nomes de organizações incluem indicação explícita de que são fictícios.
- Identificadores, CNPJs, bancos, valores e hashes foram criados para teste e não devem ser usados como cadastros válidos.
- Nenhum material recebido de empresa, cliente ou processo externo integra este conjunto.

## Composição

- 40 documentos históricos para formar a referência de cinco fornecedores fictícios.
- 20 documentos de revisão.
- 13 tipos de anomalia cobertos pelo gabarito.
- Casos limpos, parciais, duplicados, divergentes e estatisticamente atípicos.

O código-fonte da geração e o gabarito ficam em `src/lib/demo/synthetic-dataset.ts`. O comando `npm run eval` compara o resultado real das regras com esse gabarito e retorna erro em qualquer divergência.

## Restrições

O conjunto não deve ser apresentado como amostra representativa de risco, fraude ou conformidade. Quantidades e distribuições foram escolhidas para cobertura funcional, não para inferência estatística sobre ambientes reais.
