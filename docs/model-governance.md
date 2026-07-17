# Governança do uso de IA

## Finalidade e decisão humana

A IA é usada somente como fallback de extração estruturada quando o parser não consegue confirmar um campo. As anomalias são produzidas por regras determinísticas e devem ser revisadas por uma pessoa qualificada. O sistema não aprova pagamentos, não classifica fraude e não emite parecer de auditoria.

## Fluxo de dados

1. O documento é interpretado localmente pelo parser.
2. Campos válidos recebem proveniência `parser` e não podem ser sobrescritos.
3. No modo interativo, campos ausentes ou inválidos podem ser enviados ao provedor configurado.
4. A resposta passa por JSON Schema no provedor e por Zod na aplicação.
5. Somente campos ainda não confiáveis são incorporados, com proveniência do provedor.
6. Regras determinísticas geram achados e evidências para revisão humana.

O modo público não envia dados para provedores e não mantém banco de dados.

## Riscos e controles

| Risco | Controle |
|---|---|
| Alucinação ou alteração indevida | Precedência do parser e validação estrita antes do merge |
| Campo ausente tratado como válido | Estado `unresolved` e lista de campos não extraídos |
| Falso positivo em regra | Evidência estruturada, severidade, confiança e revisão humana |
| Exposição de dados | Demo sintética sem upload, banco ou chamada externa |
| Mudança de comportamento do modelo | Versão de prompt e ID do modelo registrados nos exports |
| Uso automático de conclusão | Avisos explícitos e ausência de ação decisória automatizada |

## Avaliação

O CI avalia parser e regras contra o gabarito sintético. Integrações com provedores são testadas com respostas simuladas, sem rede e sem chaves. Uma avaliação real de modelo deve usar somente dados sintéticos, registrar modelo, prompt, data e resultado, e nunca ser confundida com evidência de auditoria.

A avaliação opcional `npm run eval:ai` atende a esse fluxo fora do CI: usa três casos sintéticos, registra provedor, modelo, versão do prompt, campos não resolvidos e proveniência resultante. O relatório é observacional e não constitui aprovação do modelo.

## Limitações

- O schema garante formato, não veracidade semântica.
- A cobertura sintética não representa todos os documentos financeiros brasileiros.
- As heurísticas de outlier dependem de volume e qualidade da referência.
- Qualquer uso profissional exige avaliação de privacidade, contrato, retenção, fornecedor de IA e supervisão aplicáveis ao contexto.
