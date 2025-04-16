// MCP-Vercel Configuration

module.exports = {
  // Vercel Team/Account config
  teamId: null,  // Deixe como null para usar sua conta pessoal
  
  // Projeto MemberVIP
  projects: [
    {
      id: "prj_J4ZzofNzxXZT6a1UUjlO6nZR8LUP", // Project ID do MemberVIP
      name: "v0-member-vip",
      repos: [{
        owner: "oaleviola",
        name: "memberbot",
        branch: "main", // Branch principal a ser monitorada
        directory: "/"  // Diretório raiz do projeto
      }]
    }
  ],
  
  // Configurações de webhook
  webhookSecret: process.env.WEBHOOK_SECRET,
  
  // Configurações de deploy
  deployConfig: {
    target: "production", // Ambiente alvo (production, preview, development)
    autoApprove: true,    // Aprovar deploys automaticamente
    withAnalytics: true   // Incluir análises
  }
};
