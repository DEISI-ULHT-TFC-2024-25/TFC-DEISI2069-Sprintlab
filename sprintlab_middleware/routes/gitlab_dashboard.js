const express = require("express");
const router = express.Router();
const pool = require("../services/db");
const axios = require("axios");

// Endpoint para carregar dados do Gantt Chart
router.get("/gantt-data", async (req, res) => {
  const { teamId, channelId } = req.query;
  console.log("🔍 Gantt API chamada:", { teamId, channelId });

  try {
    // Buscar configuração do projeto GitLab
    const result = await pool.query(
      `SELECT gitlab_project_id, gitlab_token
       FROM projects_config
       WHERE teams_team_id = $1 AND teams_channel_id = $2`,
      [teamId, channelId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Configuração não encontrada." });
    }

    const { gitlab_project_id, gitlab_token } = result.rows[0];
    const headers = { "PRIVATE-TOKEN": gitlab_token };

    // Buscar info do projeto para obter o web_url
    const projectResponse = await axios.get(
      `https://gitlab.com/api/v4/projects/${gitlab_project_id}`,
      { headers }
    );
    const projectWebUrl = projectResponse.data.web_url; // ✅ Aqui obtemos o web_url correto

    // Puxar todos os issues via paginação
    let allIssues = [];
    let page = 1;
    let moreIssues = true;

    while (moreIssues) {
      const response = await axios.get(
        `https://gitlab.com/api/v4/projects/${gitlab_project_id}/issues`,
        {
          headers,
          params: {
            per_page: 100,
            page: page
          }
        }
      );

      const issuesPage = response.data;
      allIssues = allIssues.concat(issuesPage);

      if (issuesPage.length < 100) {
        moreIssues = false;
      } else {
        page++;
      }
    }

    // Preparar issues para o Gantt
    const issuesFormatted = allIssues.map(issue => {
      const startDate = issue.created_at || issue.updated_at;
      const endDate = issue.due_date || null;

      return {
        id: issue.id,
        iid: issue.iid, // ⚡️ Importante! iid para montar o link
        name: `${issue.title} (${issue.assignee?.name || "No Assignee"})`,
        startDate: startDate,
        endDate: endDate,
        closed_at: issue.closed_at || null,
        milestone: issue.milestone ? { title: issue.milestone.title } : null,
        assignees: issue.assignees || [],
        labels: issue.labels || []
      };
    });

    // ✅ Agora devolve um OBJETO completo
    res.json({
      issues: issuesFormatted,
      projectWebUrl: projectWebUrl
    });

  } catch (err) {
    console.error("❌ Erro no endpoint Gantt:", err.message);
    res.status(500).json({ error: "Erro ao buscar dados para Gantt." });
  }
});

module.exports = router;
