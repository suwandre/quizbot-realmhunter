const { SlashCommandBuilder } = require('discord.js');
const { initialStart } = require('../embeds/quiz');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Not built for now. Don\'t use!'),
        /**
         *
         * @param {import('discord.js').Interaction} interaction
         */
    async execute(interaction) {
        // TO DO: add quiz logic from index.js to here.
        // await interaction.channel.send({ embeds: [initialStart('what', 10)] });
        const msg = await interaction.channel.send('yow!');
        await msg.edit('yow yow!!');
    },
};
