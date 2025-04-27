
# Sprintlab

**Sprintlab** é uma solução de integração entre o Microsoft Teams e o GitLab, desenvolvida para permitir a gestão de projetos de forma ágil e eficiente, através de uma interface moderna e intuitiva.  
Permite visualizar, criar e editar issues diretamente no Teams, além de fornecer dashboards de acompanhamento do progresso do projeto.

---

## ⚙️ Instruções para Configuração

**Nota Importante:**  
Devido a protocolos de segurança definidos pela Microsoft Lusófona, apenas é possível configurar o Sprintlab na seguinte equipa do Teams:

🔗 [Equipa de Demonstração Sprintlab no Teams](https://teams.microsoft.com/l/channel/19%3A538c985238b04587b4f3da36333062b0%40thread.tacv2/Demonstra%C3%A7%C3%A3o%20TFC-DEISI2069-Sprintlab?groupId=2053b2e9-aafe-4c87-92c6-f089d5510d4c&tenantId=138ccc06-516b-4e81-8813-06fd2531bddc)

### Passos para Configuração:

1. Aceder ao canal acima e **adicionar um separador** (tab) ao canal.
2. Escolher o Sprintlab e preencher as informações necessárias:
   - **Nome do Projeto GitLab**
   - **ID do Projeto GitLab**
   - **Token Privada de Acesso GitLab**  
     _(Nota: a Token Privada é um token de acesso pessoal, criado no GitLab, com permissões para ler e utilizar a API do GitLab.)_
3. Clicar em **Salvar Configurações** para validar os dados.
4. Depois, clicar em **Guardar** para associar o projeto ao canal de forma definitiva.

---

## 📋 Board

A **Board** do Sprintlab baseia-se na metodologia Agile, exibindo os issues organizados por colunas (por exemplo: To Do, Doing, Done).  
Permite criar novos issues, editar existentes e mover issues entre colunas através de drag and drop, com atualizações **automáticas** e em **tempo real** para o GitLab via **REST API**.

Todas as ações realizadas na board refletem-se diretamente no projeto GitLab associado, assegurando a sincronização contínua e o controlo completo do projeto.

---

## 📈 Dashboard

A secção de **Dashboard** apresenta uma visão analítica do projeto:

- **Gantt Chart**:  
  Visualiza os issues abertos no tempo, permitindo uma gestão visual dos prazos e dependências.

- **Estatísticas Avançadas**:  
  Indicadores de desempenho do projeto, como:
  - Número de issues abertas e fechadas
  - Número total de issues
  - Issues sem milestones
  - Evolução de issues e milestones ao longo do tempo

Estas ferramentas apoiam a **gestão estratégica do projeto**, fornecendo dados relevantes para tomada de decisão.

---

## 🎯 Teste o Sprintlab

Sinta-se à vontade para testar a solução e associar projetos GitLab no canal:  
🔗 [Equipa de Demonstração Sprintlab no Teams](https://teams.microsoft.com/l/channel/19%3A538c985238b04587b4f3da36333062b0%40thread.tacv2/Demonstra%C3%A7%C3%A3o%20TFC-DEISI2069-Sprintlab?groupId=2053b2e9-aafe-4c87-92c6-f089d5510d4c&tenantId=138ccc06-516b-4e81-8813-06fd2531bddc)
