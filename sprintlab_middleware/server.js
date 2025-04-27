const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const webhooks = require("./routes/webhooks");
const axios = require("axios");
const gitlabDashboardRoutes = require("./routes/gitlab_dashboard");

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});


  
// Rotas
app.use("/webhooks", webhooks);
// ➕ Servir os ficheiros estáticos das tabs

/*****************************Tabs****************************************************/

app.use("/tabs", express.static(path.join(__dirname, "tabs")));

// 🔧 Servir página de configuração
app.get("/tabs/config", (req, res) => {
  res.sendFile(path.join(__dirname, "tabs", "config.html"));
});
app.use("/gitlab-dashboards", gitlabDashboardRoutes);

const teamsRoutes = require("./routes/teams");
app.use("/teams", teamsRoutes);


// 🛠️ Endpoint para validar e/ou guardar configurações
app.post("/configure-project", async (req, res) => {
  const { teamId, channelId, projectName, projectId, token } = req.body;
  console.log("📥 Dados recebidos:", req.body);

  if (!teamId || !channelId || !projectName || !projectId || !token) {
    return res.status(400).json({ message: "Todos os campos são obrigatórios." });
  }

  try {
    // 🔐 Validar token e acesso ao projeto GitLab
    try {
      const url = `https://gitlab.com/api/v4/projects/${encodeURIComponent(projectId)}/issues`;

      const gitlabResponse = await axios.get(url, {
        headers: { "PRIVATE-TOKEN": token }
      });

      if (gitlabResponse.status !== 200) {
        return res.status(403).json({ message: "Token inválido ou sem acesso ao projeto GitLab." });
      }
    } catch (validationError) {
      const status = validationError.response?.status;
      const message = validationError.response?.data?.message || validationError.message;

      console.error("🔐 Erro GitLab:", status, message);
      return res.status(403).json({ message: "Token inválido ou sem acesso ao projeto GitLab." });
    }

    // 🧠 Verificar se já existe configuração EXATA
    const existing = await pool.query(
      `SELECT * FROM projects_config 
       WHERE teams_team_id = $1 AND teams_channel_id = $2 AND gitlab_project_id = $3`,
      [teamId, channelId, projectId]
    );

    if (existing.rowCount > 0) {
      console.log("ℹ️ Já existe esta configuração — não será duplicada.");
      return res.status(200).json({ message: "✅ Ligação ao projeto GitLab validada com sucesso!" });
    }

    // ✅ Inserir nova configuração
    await pool.query(
      `INSERT INTO projects_config (
         teams_team_id, teams_channel_id, gitlab_project_name, gitlab_project_id, gitlab_token
       ) VALUES ($1, $2, $3, $4, $5)`,
      [teamId, channelId, projectName, projectId, token]
    );

    res.status(200).json({ message: "✅ Nova configuração guardada com sucesso!" });

  } catch (err) {
    console.error("💥 ERRO DETALHADO:", err.message);
    res.status(500).json({ message: "Erro interno ao guardar a configuração." });
  }
});

/*****************************Tabs****************************************************/

const gitlabRoutes = require("./routes/gitlab");
app.use("/gitlab-issues", gitlabRoutes);

app.get("/gitlab-boards", async (req, res) => {
  const { teamId, channelId } = req.query;

  if (!teamId || !channelId) {
    return res.status(400).json({ error: "Parâmetros teamId e channelId são obrigatórios." });
  }

  try {
    const result = await pool.query(
      `SELECT gitlab_project_id, gitlab_token FROM projects_config
       WHERE teams_team_id = $1 AND teams_channel_id = $2`,
      [teamId, channelId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Projeto não configurado para este canal." });
    }

    const { gitlab_project_id, gitlab_token } = result.rows[0];

    const response = await axios.get(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(gitlab_project_id)}/boards`,
      { headers: { "PRIVATE-TOKEN": gitlab_token } }
    );

    res.json(response.data);

  } catch (err) {
    console.error("❌ Erro ao obter boards:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao obter boards do GitLab." });
  }
});



app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
