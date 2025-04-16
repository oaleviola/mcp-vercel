// MCP Auto Fixer
// Implementa correções automáticas com base nas sugestões da Windsurf AI

const { Octokit } = require('@octokit/rest');
const axios = require('axios');

// Configurações
const config = {
  // Token de acesso ao GitHub
  githubToken: process.env.GITHUB_TOKEN,
  
  // Token de acesso à Vercel
  vercelToken: process.env.VERCEL_TOKEN,
  
  // ID do projeto na Vercel
  vercelProjectId: process.env.VERCEL_PROJECT_ID,
  
  // URL base da API da Vercel
  vercelApiUrl: 'https://api.vercel.com',
  
  // Configuração do repositório
  repo: {
    owner: 'oaleviola',
    name: 'memberbot'
  }
};

// Inicializa o cliente do GitHub
const octokit = new Octokit({
  auth: config.githubToken
});

/**
 * Cria uma branch para aplicar correções
 * @param {string} baseBranch - Branch base (geralmente 'main')
 * @param {string} errorId - ID único do erro para identificar a branch
 * @returns {Promise<string>} - Nome da branch criada
 */
async function createFixBranch(baseBranch, errorId) {
  try {
    // Obtém o SHA do último commit na branch base
    const { data: refData } = await octokit.git.getRef({
      owner: config.repo.owner,
      repo: config.repo.name,
      ref: `heads/${baseBranch}`
    });
    
    const sha = refData.object.sha;
    
    // Cria nome da branch baseado no erro e timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const branchName = `fix-${errorId}-${timestamp}`;
    
    // Cria a nova branch
    await octokit.git.createRef({
      owner: config.repo.owner,
      repo: config.repo.name,
      ref: `refs/heads/${branchName}`,
      sha
    });
    
    return branchName;
  } catch (error) {
    console.error('Erro ao criar branch de correção:', error);
    throw new Error(`Falha ao criar branch: ${error.message}`);
  }
}

/**
 * Aplica correções a um arquivo
 * @param {string} branch - Nome da branch
 * @param {string} filePath - Caminho do arquivo
 * @param {Array<Object>} corrections - Lista de correções a aplicar
 * @returns {Promise<Object>} - Resultado da operação
 */
async function applyFileCorrections(branch, filePath, corrections) {
  try {
    // Obtém o conteúdo atual do arquivo
    const { data: fileData } = await octokit.repos.getContent({
      owner: config.repo.owner,
      repo: config.repo.name,
      path: filePath,
      ref: branch
    });
    
    // Decodifica o conteúdo do arquivo
    const content = Buffer.from(fileData.content, 'base64').toString();
    
    // Aplica todas as correções
    let updatedContent = content;
    for (const correction of corrections) {
      switch (correction.type) {
        case 'REPLACE':
          // Substitui o conteúdo especificado
          updatedContent = updatedContent.replace(
            correction.target,
            correction.replacement
          );
          break;
          
        case 'ADD_IMPORT':
          // Adiciona uma importação ao topo do arquivo
          updatedContent = `${correction.importStatement}\n${updatedContent}`;
          break;
          
        case 'ADD_DEPENDENCY':
          // Para package.json, adiciona uma dependência
          if (filePath === 'package.json') {
            const pkg = JSON.parse(updatedContent);
            pkg.dependencies[correction.name] = correction.version || 'latest';
            updatedContent = JSON.stringify(pkg, null, 2);
          }
          break;
      }
    }
    
    // Atualiza o arquivo no repositório
    await octokit.repos.createOrUpdateFileContents({
      owner: config.repo.owner,
      repo: config.repo.name,
      path: filePath,
      message: `Fix: Correção automática para ${filePath}`,
      content: Buffer.from(updatedContent).toString('base64'),
      branch,
      sha: fileData.sha
    });
    
    return {
      success: true,
      filePath,
      message: `Arquivo ${filePath} atualizado com sucesso`
    };
  } catch (error) {
    console.error(`Erro ao corrigir arquivo ${filePath}:`, error);
    return {
      success: false,
      filePath,
      error: error.message
    };
  }
}

/**
 * Cria um Pull Request com as correções
 * @param {string} branch - Nome da branch com as correções
 * @param {string} errorType - Tipo de erro corrigido
 * @param {string} description - Descrição detalhada das correções
 * @returns {Promise<Object>} - Dados do PR criado
 */
async function createPullRequest(branch, errorType, description) {
  try {
    const { data } = await octokit.pulls.create({
      owner: config.repo.owner,
      repo: config.repo.name,
      title: `[Auto Fix] Correção para erro de ${errorType}`,
      body: description,
      head: branch,
      base: 'main'
    });
    
    return {
      success: true,
      pullRequestUrl: data.html_url,
      pullRequestNumber: data.number
    };
  } catch (error) {
    console.error('Erro ao criar PR:', error);
    throw new Error(`Falha ao criar Pull Request: ${error.message}`);
  }
}

/**
 * Inicia um novo deploy na Vercel para testar as correções
 * @param {string} branch - Nome da branch a ser deployada
 * @returns {Promise<Object>} - Dados do deploy iniciado
 */
async function triggerVercelDeploy(branch) {
  try {
    const response = await axios.post(
      `${config.vercelApiUrl}/v13/deployments`,
      {
        name: config.repo.name,
        target: 'preview',
        gitSource: {
          type: 'github',
          repo: `${config.repo.owner}/${config.repo.name}`,
          ref: branch
        }
      },
      {
        headers: {
          Authorization: `Bearer ${config.vercelToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return {
      success: true,
      deploymentId: response.data.id,
      deploymentUrl: response.data.url
    };
  } catch (error) {
    console.error('Erro ao iniciar deploy na Vercel:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Processa correções sugeridas pela IA
 * @param {Object} aiSuggestions - Sugestões de correção da IA
 * @param {Object} deploymentData - Dados do deploy que falhou
 * @returns {Promise<Object>} - Resultado do processo de correção
 */
async function processCorrections(aiSuggestions, deploymentData) {
  try {
    // Cria uma branch para as correções
    const fixBranch = await createFixBranch('main', aiSuggestions.errorId);
    console.log(`Branch criada: ${fixBranch}`);
    
    // Aplica as correções a cada arquivo
    const results = [];
    for (const fileCorrection of aiSuggestions.fileCorrections) {
      const result = await applyFileCorrections(
        fixBranch,
        fileCorrection.path,
        fileCorrection.corrections
      );
      results.push(result);
    }
    
    // Verifica se todas as correções foram aplicadas com sucesso
    const allSuccessful = results.every(r => r.success);
    
    if (allSuccessful) {
      // Cria um Pull Request com as correções
      const prResult = await createPullRequest(
        fixBranch,
        aiSuggestions.errorType,
        aiSuggestions.description
      );
      
      // Inicia um deploy de teste na Vercel
      const deployResult = await triggerVercelDeploy(fixBranch);
      
      return {
        success: true,
        branch: fixBranch,
        corrections: results,
        pullRequest: prResult,
        deployment: deployResult
      };
    } else {
      return {
        success: false,
        branch: fixBranch,
        corrections: results,
        error: 'Nem todas as correções puderam ser aplicadas'
      };
    }
  } catch (error) {
    console.error('Erro ao processar correções:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  processCorrections,
  createFixBranch,
  applyFileCorrections,
  createPullRequest,
  triggerVercelDeploy
};
