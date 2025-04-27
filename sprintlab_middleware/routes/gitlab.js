const express = require("express");
const router = express.Router();
const pool = require("../services/db");
const axios = require("axios");

// ✅ Endpoint para obter configuração do projeto
router.get("/project-config", async (req, res) => {
  const { teamId, channelId } = req.query;

  try {
    const result = await pool.query(
      `SELECT gitlab_project_id, gitlab_token FROM projects_config
       WHERE teams_team_id = $1 AND teams_channel_id = $2`,
      [teamId, channelId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Configuração não encontrada." });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error("❌ Erro ao buscar configuração:", err.message);
    res.status(500).json({ error: "Erro interno ao buscar configuração." });
  }
});

// ✅ Endpoint para listar todas as issue boards do projeto
// GET /gitlab-boards?teamId=...&channelId=...
router.get("/boards", async (req, res) => {
  const { teamId, channelId } = req.query;

  if (!teamId || !channelId) {
    return res.status(400).json({ error: "Faltam parâmetros teamId e channelId" });
  }

  try {
    const result = await pool.query(
      `SELECT gitlab_project_id, gitlab_token FROM projects_config
       WHERE teams_team_id = $1 AND teams_channel_id = $2`,
      [teamId, channelId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Projeto não encontrado para este canal." });
    }

    const { gitlab_project_id, gitlab_token } = result.rows[0];
    const headers = { "PRIVATE-TOKEN": gitlab_token };

    const boardsRes = await axios.get(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(gitlab_project_id)}/boards`,
      { headers }
    );

    res.json(boardsRes.data);

  } catch (err) {
    console.error("❌ Erro ao buscar boards:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao buscar boards." });
  }
});


// ✅ Endpoint principal para buscar issues organizadas por colunas da board
router.get("/", async (req, res) => {
  const { teamId, channelId, boardId } = req.query;

  if (!teamId || !channelId || !boardId) {
    return res.status(400).json({ error: "Faltam parâmetros obrigatórios (teamId, channelId, boardId)" });
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
    const headers = { "PRIVATE-TOKEN": gitlab_token };
    //Cores das labels
    const labelsRes = await axios.get(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(gitlab_project_id)}/labels`,
      { headers }
    );
    const labelColors = {};
    labelsRes.data.forEach(label => {
      labelColors[label.name] = label.color;
    });
    

    // Nome do projeto
    const projectRes = await axios.get(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(gitlab_project_id)}`,
      { headers }
    );

    // Listas da board (definidas por label)
    const listsRes = await axios.get(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(gitlab_project_id)}/boards/${boardId}/lists`,
      { headers }
    );

    const boardData = {};
    const labelSet = new Set();

    // 1. Colunas com label associada
    for (const list of listsRes.data) {
      const columnName = list.label?.name || list.list_type || "Sem Nome";
      boardData[columnName] = [];

      if (list.label) {
        labelSet.add(list.label.name);

        const issuesRes = await axios.get(
          `https://gitlab.com/api/v4/projects/${encodeURIComponent(gitlab_project_id)}/issues?labels=${encodeURIComponent(list.label.name)}&state=opened&per_page=100`,
          { headers }
        );

        boardData[columnName] = issuesRes.data.filter(issue => issue.state === "opened");
      }
    }

    // 2. Issues abertas sem nenhuma label de coluna → "Open"
    const allOpenRes = await axios.get(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(gitlab_project_id)}/issues?state=opened&per_page=100`,
      { headers }
    );

    const openIssues = allOpenRes.data.filter(issue => {
      return issue.labels.every(label => !labelSet.has(label));
    });

    if (openIssues.length > 0) {
      boardData["Open"] = openIssues;
    }

    // 3. Issues fechadas → "Closed"
    const closedRes = await axios.get(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(gitlab_project_id)}/issues?state=closed&per_page=100`,
      { headers }
    );

    boardData["Closed"] = closedRes.data;

    // 4. Ordem: Open → colunas da board → Closed
    const orderedBoard = {};
    if (boardData["Open"]) orderedBoard["Open"] = boardData["Open"];
    for (const [name, issues] of Object.entries(boardData)) {
      if (name !== "Open" && name !== "Closed") {
        orderedBoard[name] = issues;
      }
    }
    if (boardData["Closed"]) orderedBoard["Closed"] = boardData["Closed"];

    res.json({
      project_name: projectRes.data.name,
      project_id: gitlab_project_id,
      project_web_url: projectRes.data.web_url,
      board: orderedBoard,
      label_colors: labelColors      
    });    

  } catch (err) {
    console.error("❌ Erro ao carregar issues da board:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao buscar issues da board." });
  }
});




router.get("/users", async (req, res) => {
  const { projectId, token } = req.query;
  try {
    const response = await axios.get(`https://gitlab.com/api/v4/projects/${projectId}/users`, {
      headers: { "PRIVATE-TOKEN": token }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar utilizadores." });
  }
});

router.get("/labels", async (req, res) => {
  const { projectId, token } = req.query;
  try {
    const response = await axios.get(`https://gitlab.com/api/v4/projects/${projectId}/labels`, {
      headers: { "PRIVATE-TOKEN": token }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar labels." });
  }
});

router.get("/milestones", async (req, res) => {
  const { projectId, token } = req.query;
  try {
    const response = await axios.get(`https://gitlab.com/api/v4/projects/${projectId}/milestones`, {
      headers: { "PRIVATE-TOKEN": token }
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar milestones." });
  }
});

router.get("/project-metadata", async (req, res) => {
  const { teamId, channelId } = req.query;

  if (!teamId || !channelId) {
    return res.status(400).json({ error: "Parâmetros obrigatórios em falta." });
  }

  try {
    const result = await pool.query(
      `SELECT gitlab_project_id, gitlab_token FROM projects_config
       WHERE teams_team_id = $1 AND teams_channel_id = $2`,
      [teamId, channelId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Configuração não encontrada." });
    }

    const { gitlab_project_id, gitlab_token } = result.rows[0];
    const headers = { "PRIVATE-TOKEN": gitlab_token };

    const [assigneesRes, labelsRes, milestonesRes] = await Promise.all([
      axios.get(`https://gitlab.com/api/v4/projects/${gitlab_project_id}/users`, { headers }),
      axios.get(`https://gitlab.com/api/v4/projects/${gitlab_project_id}/labels`, { headers }),
      axios.get(`https://gitlab.com/api/v4/projects/${gitlab_project_id}/milestones`, { headers })
    ]);

    res.json({
      assignees: assigneesRes.data,
      labels: labelsRes.data,
      milestones: milestonesRes.data
    });
  } catch (err) {
    console.error("❌ Erro ao buscar metadados:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao buscar metadados do projeto." });
  }
});


// ✅ Atualizar uma issue existente no GitLab
router.put("/:issueIid", async (req, res) => {
  const { teamId, channelId } = req.query;
  const { issueIid } = req.params;
  const { title, description, due_date, assignee_id, labels, milestone_id, state_event } = req.body;

  if (!teamId || !channelId || !issueIid) {
    return res.status(400).json({ error: "Parâmetros obrigatórios em falta." });
  }

  try {
    const result = await pool.query(
      `SELECT gitlab_project_id, gitlab_token FROM projects_config
       WHERE teams_team_id = $1 AND teams_channel_id = $2`,
      [teamId, channelId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Configuração não encontrada." });
    }

    const { gitlab_project_id, gitlab_token } = result.rows[0];

    const { title, description, due_date, assignee_id, labels, milestone_id } = req.body;

    const response = await axios.put(
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(gitlab_project_id)}/issues/${issueIid}`,
      {
        title,
        description,        
        due_date,
        assignee_id,
        labels,
        milestone_id,
        state_event
      },
      {
        headers: { "PRIVATE-TOKEN": gitlab_token }
      }
    );
    res.json({ message: "Issue atualizada!", data: response.data });

  } catch (err) {
    console.error("❌ Erro ao atualizar issue:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao atualizar a issue." });
  }
});

router.get('/project-name', async (req, res) => {
  const { teamId, channelId } = req.query;

  try {
    const configRes = await db.query(
      `SELECT gitlab_project_id, gitlab_token FROM projects_config 
       WHERE teams_team_id = $1 AND teams_channel_id = $2 
       LIMIT 1`,
      [teamId, channelId]
    );

    if (configRes.rowCount === 0) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }

    const { gitlab_project_id, gitlab_token } = configRes.rows[0];

    if (!gitlab_project_id || !gitlab_token) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const gitlabRes = await fetch(`https://gitlab.com/api/v4/projects/${gitlab_project_id}`, {
      headers: { 'Private-Token': gitlab_token }
    });

    if (!gitlabRes.ok) {
      return res.status(500).json({ error: 'Erro ao buscar projeto no GitLab' });
    }

    const project = await gitlabRes.json();

    // Verifica se o campo "name" realmente vem
    if (!project.name) {
      return res.status(500).json({ error: 'Nome do projeto não encontrado' });
    }

    res.json({ name: project.name });
  } catch (err) {
    console.error('Erro ao buscar nome do projeto:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ✅ Obter detalhes de uma issue específica
router.get("/:issueIid", async (req, res) => {
  const { teamId, channelId } = req.query;
  const { issueIid } = req.params;

  if (!teamId || !channelId || !issueIid) {
    return res.status(400).json({ error: "Parâmetros obrigatórios em falta." });
  }

  try {
    const result = await pool.query(
      `SELECT gitlab_project_id, gitlab_token FROM projects_config
       WHERE teams_team_id = $1 AND teams_channel_id = $2`,
      [teamId, channelId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Configuração não encontrada." });
    }

    const { gitlab_project_id, gitlab_token } = result.rows[0];

    const issueRes = await axios.get(
      `https://gitlab.com/api/v4/projects/${gitlab_project_id}/issues/${issueIid}`,
      { headers: { "PRIVATE-TOKEN": gitlab_token } }
    );

    res.json(issueRes.data);
  } catch (err) {
    console.error("❌ Erro ao buscar issue:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao buscar detalhes da issue." });
  }
});

router.get("/:issueIid/related_merge_requests", async (req, res) => {
  const { teamId, channelId } = req.query;
  const { issueIid } = req.params;

  if (!teamId || !channelId || !issueIid) {
    return res.status(400).json({ error: "Parâmetros obrigatórios em falta." });
  }

  try {
    const result = await pool.query(
      `SELECT gitlab_project_id, gitlab_token FROM projects_config
       WHERE teams_team_id = $1 AND teams_channel_id = $2`,
      [teamId, channelId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Configuração não encontrada." });
    }

    const { gitlab_project_id, gitlab_token } = result.rows[0];
    const response = await axios.get(
      `https://gitlab.com/api/v4/projects/${gitlab_project_id}/issues/${issueIid}/related_merge_requests`,
      { headers: { "PRIVATE-TOKEN": gitlab_token } }
    );

    res.json(response.data);
  } catch (err) {
    console.error("❌ Erro ao buscar related MRs:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao buscar related merge requests." });
  }
});

// Criar uma nova Issue
router.post("/", async (req, res) => {
  const { teamId, channelId } = req.query;
  const { title, description, due_date, assignee_id, milestone_id, labels } = req.body;

  try {
    const result = await pool.query(`
      SELECT gitlab_project_id, gitlab_token FROM projects_config
      WHERE teams_team_id = $1 AND teams_channel_id = $2
    `, [teamId, channelId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Configuração não encontrada." });
    }

    const { gitlab_project_id, gitlab_token } = result.rows[0];
    const headers = { "PRIVATE-TOKEN": gitlab_token };

    const body = {
      title,
      description,
      labels: labels.join(","),
      assignee_id,
      milestone_id,
      due_date,    
    };

    const response = await axios.post(`https://gitlab.com/api/v4/projects/${gitlab_project_id}/issues`, body, { headers });

    res.json(response.data);

  } catch (err) {
    console.error("❌ Erro ao criar issue:", err.response?.data || err.message);
    res.status(500).json({ error: "Erro ao criar issue." });
  }
});


module.exports = router;
