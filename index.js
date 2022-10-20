require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

client.on('ready', () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
    if (message.content.toLowerCase() === 'ping') {
        message.channel.send('pong')
            .then((msg) => {
                msg.react('👍');
            });
    }
});
client.login(process.env.TOKEN);