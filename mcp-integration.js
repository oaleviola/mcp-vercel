// MCP Integration
// Integra o sistema de monitoramento, análise e correção ao servidor MCP-Vercel

const express = require('express');
const bodyParser = require('body-parser');
const { handleVercelErrorWebhook } = require('./mcp-error-handler');
const { processCorrections } = require('./mcp-auto-fixer');

// Função para configurar as rotas de monitoramento e correção
function setupMonitoringRoutes(app) {
  // Middleware para processar JSON
  app.use(bodyParser.json());
  
  // Endpoint para receber webhooks de erro da Vercel
  app.post('/api/vercel-errors', handleVercelErrorWebhook);
  
  // Endpoint para receber sugestões de correção da Windsurf AI
  app.post('/api/apply-corrections', async (req, res) => {
    try {
      const { aiSuggestions, deploymentData } = req.body;
      
      // Valida os dados recebidos
      if (!aiSuggestions || !deploymentData) {
        return res.status(400).json({
          error: 'Dados inválidos. Necessário aiSuggestions e deploymentData'
        });
      }
      
      // Processa as correções sugeridas
      const result = await processCorrections(aiSuggestions, deploymentData);
      
      // Responde com o resultado
      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error('Erro ao aplicar correções:', error);
      res.status(500).json({
        error: 'Erro interno ao aplicar correções',
        message: error.message
      });
    }
  });
  
  // Endpoint para verificar o status do sistema
  app.get('/api/monitor/status', (req, res) => {
    res.status(200).json({
      status: 'online',
      version: '1.0.0',
      components: {
        errorHandler: 'active',
        autoFixer: 'active'
      },
      timestamp: new Date().toISOString()
    });
  });
  
  // Rota para testes de integração
  app.post('/api/monitor/test', (req, res) => {
    const { testType } = req.body;
    
    switch (testType) {
      case 'error-detection':
        // Simula detecção de erro
        res.status(200).json({
          test: 'error-detection',
          result: 'success',
          detectedPatterns: ['MISSING_DEPENDENCY', 'SYNTAX_ERROR']
        });
        break;
        
      case 'correction-flow':
        // Simula fluxo de correção
        res.status(200).json({
          test: 'correction-flow',
          result: 'success',
          steps: [
            { name: 'create-branch', status: 'completed' },
            { name: 'apply-corrections', status: 'completed' },
            { name: 'create-pr', status: 'completed' },
            { name: 'trigger-deploy', status: 'completed' }
          ]
        });
        break;
        
      default:
        res.status(400).json({
          error: 'Tipo de teste desconhecido',
          validTypes: ['error-detection', 'correction-flow']
        });
    }
  });
  
  console.log('Rotas de monitoramento e correção configuradas');
  return app;
}

module.exports = {
  setupMonitoringRoutes
};
