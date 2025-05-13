const express = require('express');
const db = require('./db');
const app = express();
const PORT = 3000;

db.connect(err => {
    if (err) {
        console.error('Erro ao conectar ao banco de dados:', err.message);
        return;
    }
    console.log('✅ Conectado ao banco de dados MySQL!');
});

app.get('/', (req, res) => {
    db.query('SELECT * FROM historico ORDER BY horario DESC LIMIT 10', (err, resultados) => {
        if (err) {
            return res.send('<h2 style="color:red;">❌ Erro ao buscar atendimentos.</h2>');
        }

        const total = resultados.length;

        const produtosContagem = {};
        resultados.forEach(r => {
            if (r.produto) {
                produtosContagem[r.produto] = (produtosContagem[r.produto] || 0) + 1;
            }
        });

        const topProdutos = Object.entries(produtosContagem)
            .sort((a, b) => b[1] - a[1])
            .map(([nome, qtd]) => `<li>🛢️ <strong>${nome}</strong> — ${qtd}x</li>`)
            .join('');

        const html = `
            <html>
            <head>
                <title>Painel de Atendimentos - Blasfen</title>
                <meta charset="UTF-8">
            </head>
            <body style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 20px;">
                <div style="max-width: 900px; margin: auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                    <h1 style="color: #1e88e5;">📊 Painel de Atendimentos - <span style="color:#333;">Blasfen</span></h1>

                    <p style="font-size: 18px;">Total de atendimentos recentes: <strong>${total}</strong></p>

                    <h2 style="margin-top: 30px;">🕘 Últimos Atendimentos</h2>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <thead>
                            <tr style="background: #e0e0e0;">
                                <th style="padding: 8px; text-align: left;">📅 Horário</th>
                                <th style="padding: 8px; text-align: left;">📱 Número</th>
                                <th style="padding: 8px; text-align: left;">💬 Mensagem</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${resultados.map(h => `
                                <tr style="border-bottom: 1px solid #ddd;">
                                    <td style="padding: 8px;">${new Date(h.horario).toLocaleString()}</td>
                                    <td style="padding: 8px;">${h.numero}</td>
                                    <td style="padding: 8px;">${h.mensagem}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <h2 style="margin-top: 30px;">🔥 Produtos Mais Buscados</h2>
                    <ul style="font-size: 18px; line-height: 1.6;">
                        ${topProdutos || '<li>❌ Nenhum produto registrado</li>'}
                    </ul>
                </div>
            </body>
            </html>
        `;

        res.send(html);
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Painel rodando em: http://localhost:${PORT}`);
});

 //inicialização node painel.js