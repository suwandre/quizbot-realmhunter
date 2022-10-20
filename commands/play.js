const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Starts the quiz!'),
    async execute(interaction) {
        await interaction.reply('Quiz started!');
    },
};
