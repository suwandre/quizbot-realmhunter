require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('fs');

// const clientId = process.env.CLIENT_ID;
const appId = process.env.APP_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.TOKEN;

// an array to put all command files in the `commands` folder
const commands = [];

// grab all command files from the `commands` folder
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
    console.log(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationGuildCommands(appId, guildId),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands!`);
    } catch (err) {
        console.error(err);
        throw err;
    }
})();

