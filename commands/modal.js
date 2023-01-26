const { SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modal')
        .setDescription('Test modal'),
        /**
         *
         * @param {import('discord.js').Interaction} interaction
         */
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('myModal')
            .setTitle('My Modal');

        const favColorInput = new TextInputBuilder()
            .setCustomId('favColor')
            .setPlaceholder('Enter your favorite color')
            .setStyle(TextInputStyle.Short)
            .setLabel('What\'s your favorite color?');

        const hobbiesInput = new TextInputBuilder()
            .setCustomId('hobbies')
            .setPlaceholder('Enter your hobbies')
            .setStyle(TextInputStyle.Paragraph)
            .setLabel('What are your hobbies?');

        const firstRow = new ActionRowBuilder().addComponents(favColorInput);
        const secondRow = new ActionRowBuilder().addComponents(hobbiesInput);

        modal.addComponents(firstRow, secondRow);

        await interaction.showModal(modal);
        console.log(modal);

        if (interaction.type === InteractionType.ModalSubmit) {
            if (interaction.customId === 'myModal') {
                console.log('hey');
                const favColorResponse = interaction.fields.getTextInputValue('favColor');
                const hobbiesResponse = interaction.fields.getTextInputValue('hobbies');

                interaction.reply('Your favorite color is ' + favColorResponse + ' and your hobbies are ' + hobbiesResponse);
            }
        }

        // const collector = await interaction.channel.createMessageComponentCollector({ componentType: 'TEXT_INPUT', time: 15000 });

        // collector.on('collect', thisModal => {
        //     if (thisModal.isModalSubmit() && thisModal.customId === 'myModal') {
        //         console.log(thisModal);

        //         thisModal.reply('Modal collected');
        //     }
        // });
    },
};