// MCP Error Handler
// Recebe webhooks da Vercel relacionados a erros de build ou runtime

const crypto = require('crypto');
const axios = require('axios');

// Configuração
const config = {
  // Secret compartilhado com a Vercel para validar webhooks
  webhookSecret: process.env.WEBHOOK_SECRET,
  
  // URL da API Cascade para acionar a IA
  cascadeApiUrl: process.env.CASCADE_API_URL,
  
  // Token de autenticação para a API Cascade
  cascadeApiToken: process.env.CASCADE_API_TOKEN,
  
  // Repositório do GitHub para aplicar correções
  githubRepo: 'oaleviola/memberbot',
  
  // Token de acesso ao GitHub
  githubToken: process.env.GITHUB_TOKEN
};

/**
 * Verifica a assinatura do webhook da Vercel
 * @param {string} signature - Assinatura recebida no header
 * @param {string} body - Corpo da requisição
 * @returns {boolean} - Se a assinatura é válida
 */
function verifySignature(signature, body) {
  const hmac = crypto.createHmac('sha256', config.webhookSecret);
  const digest = hmac.update(body).digest('hex');
  return signature === `sha256=${digest}`;
}

/**
 * Analisa logs de erro para identificar problemas comuns
 * @param {Object} logs - Logs do deploy da Vercel
 * @returns {Object} - Análise do erro com tipo e possível solução
 */
function analyzeError(logs) {
  // Implementação básica para detecção de padrões de erro comuns
  const errorPatterns = [
    {
      pattern: /Cannot find module '([^']+)'/,
      type: 'MISSING_DEPENDENCY',
      fix: matches => ({
        type: 'ADD_DEPENDENCY',
        dependency: matches[1]
      })
    },
    {
      pattern: /Failed to compile.*Module not found: Error: Can't resolve '([^']+)'/,
      type: 'IMPORT_ERROR',
      fix: matches => ({
        type: 'FIX_IMPORT',
        module: matches[1]
      })
    },
    {
      pattern: /SyntaxError: (.*) \((\d+):(\d+)\)/,
      type: 'SYNTAX_ERROR',
      fix: matches => ({
        type: 'SYNTAX_FIX',
        error: matches[1],
        line: parseInt(matches[2]),
        column: parseInt(matches[3])
      })
    }
  ];

  // Procura por padrões nos logs
  for (const entry of errorPatterns) {
    const matches = logs.match(entry.pattern);
    if (matches) {
      return {
        type: entry.type,
        details: entry.fix(matches),
        rawError: matches[0]
      };
    }
  }

  // Se nenhum padrão for encontrado, retorna erro genérico
  return {
    type: 'UNKNOWN_ERROR',
    details: {
      logs: logs.slice(0, 1000) // Primeiros 1000 caracteres dos logs
    }
  };
}

/**
 * Aciona a Windsurf AI via Cascade para analisar e corrigir o erro
 * @param {Object} errorAnalysis - Análise do erro
 * @param {Object} deployData - Dados do deploy que falhou
 * @returns {Promise<Object>} - Resposta da AI com sugestões de correção
 */
async function invokeAI(errorAnalysis, deployData) {
  try {
    const response = await axios.post(
      config.cascadeApiUrl,
      {
        errorAnalysis,
        deployData,
        repo: config.githubRepo,
        timestamp: new Date().toISOString()
      },
      {
        headers: {
          'Authorization': `Bearer ${config.cascadeApiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Erro ao acionar a AI:', error.message);
    throw new Error('Falha ao comunicar com a Cascade API');
  }
}

/**
 * Handler principal para webhooks de erro
 * @param {Object} req - Requisição HTTP
 * @param {Object} res - Resposta HTTP
 */
async function handleVercelErrorWebhook(req, res) {
  try {
    // Verificar assinatura do webhook
    const signature = req.headers['x-vercel-signature'];
    const isValid = verifySignature(signature, JSON.stringify(req.body));
    
    if (!isValid) {
      return res.status(401).json({ error: 'Assinatura inválida' });
    }
    
    // Extrair dados relevantes do webhook
    const { deployment, logs } = req.body;
    
    // Analisar o erro
    const errorAnalysis = analyzeError(logs);
    
    // Acionar a AI com o contexto do erro
    const aiResponse = await invokeAI(errorAnalysis, deployment);
    
    // Responder ao webhook
    res.status(200).json({
      received: true,
      analysis: errorAnalysis,
      aiTriggered: true
    });
    
    // Iniciar processo de correção em background
    // (Isso seria implementado como uma função separada)
    // applyFixes(aiResponse, deployment);
    
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({ error: 'Erro interno ao processar webhook' });
  }
}

module.exports = {
  handleVercelErrorWebhook,
  analyzeError,
  invokeAI
};
