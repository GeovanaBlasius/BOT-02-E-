const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'geovana03011@',
    database: 'chatbot'
});

connection.connect(err => {
    if (err) {
        console.error('Erro ao conectar ao MySQL:', err.message);
    } else {
        console.log('✅ Conectado ao banco de dados MySQL');
    }
});

module.exports = connection;
