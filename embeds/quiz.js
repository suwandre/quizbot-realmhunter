const { EmbedBuilder } = require('discord.js');

const quizEmbed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Realm Hunter Quiz')
    .setDescription('This is a Realm Hunter Quiz')
    .addFields(
        { name: 'Yow, I\'m a title', value: 'Yes' },
    )
    .setTimestamp();

module.exports = quizEmbed;