const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    // This creates a file named 'database.sqlite' in your project root
    storage: path.join(__dirname, '../database.sqlite'), 
    logging: false 
});

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('SQLite Database Connected (File-based)');
    } catch (error) {
        console.error('SQLite Connection Failed:', error);
        process.exit(1);
    }
};

module.exports = { sequelize, connectDB };