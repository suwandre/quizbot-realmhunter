require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const express = require('express');
const app = express();
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Moralis = require('moralis-v1/node');

const { initialStart, quiz, questionLoading, leaderboard, endQuestion, nextQuestion } = require('./embeds/quiz');
const { getQuizData } = require('./api/getQuizData');
const { delay } = require('./utils/delay');
const compare = require('./utils/compare');
const serverUrl = process.env.MORALIS_SERVERURL;
const appId = process.env.MORALIS_APPID;
const masterKey = process.env.MORALIS_MASTERKEY;

app.use(cors());
app.use(express.json());

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessageReactions,
    ],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

client.on('ready', () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    try {
        if (message.content.toLowerCase() === '?quiz') {
            // if the messager's role is not `The Creators`, then we send an error msg and return.
            if (!message.member._roles.includes('956946650218237993')) {
                await message.channel.send('You do not have permission to use this role.');
                return;
            }

            // the description of the quiz
            const quizDescription = `This quiz entails general knowledge questions about Realm Hunter. 
                                    Don't worry about not knowing any of the answers, since it's meant to be built like that.
                                    The point is that you have fun and learn something new about us along the way!
                                    P.S. Free alpha pass mints to the top 5 scorers of the quiz!`;

            // the time in seconds before the quiz starts
            const startsIn = 10;

            // announcing that the quiz is commencing
            const quizCommencing = await message.channel.send({ embeds: [initialStart(quizDescription, startsIn)] });

            // we get an array of quiz data objects from `getQuizData`.
            const quizDatas = await getQuizData();

            // we wait 10 seconds before commencing the quiz (and with it deleting the `quizCommencing` message)
            await delay(startsIn * 1000);

            // this array will contain all participant objects for the quiz.
            // Note: in order for a participant to be added, they need to have at least 1 question correct, otherwise it's not saved.
            const participants = [];

            // we start with question 1.
            let currentQuestion = 1;

            // each question can have up to 9 answers. each of them will represent an emoji to react to.
            const answersAsEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

            // delete the `quizCommencing` message after the delay finishes.
            await quizCommencing.delete();

            // we loop through all the quiz data objects.
            // this is where most of the quiz logic will begin.
            for (currentQuestion; currentQuestion < quizDatas.length + 1; currentQuestion++) {
                // we send the `questionLoading` embed to load the question.
                const sendQuiz = await message.channel.send({ embeds: [ questionLoading ] });
                // we get the quiz data for the current question.
                const { questionId, question, answers, correctAnswers, minimumPoints, maximumPoints, duration } = quizDatas[currentQuestion - 1];

                // `answers` contains an array of answers. For each answer available, we assign it an emoji incrementally.
                for (const answer of answers) {
                    await sendQuiz.react(answersAsEmojis[answers.indexOf(answer)]);
                }

                // this is for the quiz embed. we want the answers to be displayed in a single `value` parameter.
                let answersAsValue = '';

                for (let i = 0; i < answers.length; i++) {
                    answersAsValue += `${answersAsEmojis[i]} ${answers[i]}\n`;
                }

                // once the emojis are in place, we send the quiz embed.
                await sendQuiz.edit({ embeds: [ quiz(questionId, question, minimumPoints, maximumPoints, duration, answersAsValue) ] });

                // since it takes time to send the emojis and edit the embed, we want to make the `duration` be more fair.
                // this is where we start counting down the duration for this particular question.
                const actualStartTime = Date.now();

                // we want to store the `correct answers` in the form of their emoji equivalents so we can check
                // for users to guess correctly.
                const correctAnswersAsEmojis = [];
                // we also want to get the correct answers as a string, just like `answersAsValue` above.
                let correctAnswersAsValue = '';

                for (let i = 0; i < correctAnswers.length; i++) {
                    // we want to check for the index of the correct answer in the `answers` array.
                    const index = answers.indexOf(correctAnswers[i]);
                    // if the index isn't -1, that means that it is a match and we can push the emoji equivalent.
                    if (index !== -1) {
                        correctAnswersAsEmojis.push(answersAsEmojis[index]);
                        correctAnswersAsValue += `${answersAsEmojis[index]} ${correctAnswers[i]}\n`;
                    }
                }

                // this is only a testing precautionary measure. this logic will be called when there is only 1 correct answer.
                if (correctAnswers.length === 1) {
                    // we create a filter to only get the correct answer(s) and exclude the bot as part of the reactions.
                    const filter = (reaction, user) => correctAnswersAsEmojis.includes(reaction.emoji.name) && user.id !== client.user.id;

                    // we create a reaction collector to keep track of everyone who reacts to the right answer(s).
                    const collector = sendQuiz.createReactionCollector({ filter, time: duration * 1000, dispose: true });

                    // get the time used for this question for each participant
                    let timeUsed;
                    // get the points earned by the participant for this question
                    let points;

                    // whenever a participant reacts on the correct answer on `collector`, we will edit their data.
                    collector.on('collect', (reaction, user) => {
                        // getting the timestamp of the reaction
                        const answered = Date.now();
                        // time taken for them to react (in seconds)
                        timeUsed = (answered - actualStartTime) / 1000;

                        // calculating the points earned (linear decrease in points based on time used)
                        // if the user somehow still manages to react after the duration, they will get 0 points.
                        points = timeUsed <= duration ? maximumPoints - ((maximumPoints - minimumPoints) / duration * timeUsed) : 0;

                        // we want to check if the participant exists in `participants` (since they can remove the reaction anytime and react again within `duration` seconds)
                        // if the participant doesn't exist, then we will add the participant to the array.
                        const participantFound = participants.find(participant => participant.userId === user.id);

                        // if the participant is NOT found, this logic will run.
                        if (!participantFound) {
                            // this will be created from whichever question the participant answers correctly first (not necessarily the first question)
                            // although this will run from the first question.
                            // we will fill the `participant` object with the following properties and values:
                            const participant = {
                                usertag: user.tag,
                                userId: user.id,
                                // some questions will have more than 1 correct 'choice', so instead of `questionsCorrect` we will use `choicesCorrect`.
                                choicesCorrect: 1,
                                totalPoints: points,
                            };

                            // we push the `participant` object to the `participants` array.
                            participants.push(participant);
                        // if the participant already exists, we will update their data.
                        } else {
                            participants.forEach((participant) => {
                                if (participant.userId === user.id) {
                                    participant.choicesCorrect += 1;
                                    participant.totalPoints += points;
                                }
                            });
                        }
                        console.log(`${user.tag} guessed correctly within ${timeUsed} seconds!.`);
                    });

                    // whenever a participant removes their correct answer, we will update their data accordingly.
                    collector.on('remove', (reaction, user) => {
                        console.log(`${user.tag} removed their reaction.`);
                        // we want to first check if the participant exists.
                        participants.forEach((participant) => {
                            // if the participant exists, we update their `points` and `choicesCorrect`.
                            if (participant.userId === user.id) {
                                // if the participant's points is already 0, we just reduce their `choicesCorrect` by 1.
                                if (participant.totalPoints === 0) {
                                    participant.choicesCorrect -= 1;
                                // if the value after reducing the participant's `totalPoints` by `points` still equals >= 0, we reduce their points by `points`
                                // and also reduce their `choicesCorrect` by 1.
                                } else if ((participant.totalPoints - points) >= 0) {
                                    participant.totalPoints -= points;
                                    participant.choicesCorrect -= 1;
                                // if the value after reducing the participant's `totalPoints` by `points` is negative, we set their `points` to 0 and
                                // reduce their `choicesCorrect` by 1.
                                } else if ((participant.totalPoints - points) < 0) {
                                    participant.totalPoints = 0;
                                    participant.choicesCorrect -= 1;
                                }
                            }
                        });
                    });
                }

                // we wait for the duration of the question to end before moving on.
                await delay(duration * 1000);

                // once the question ends, we will delete the current question embed and show the correct answer.
                await sendQuiz.delete();
                const showAnswer = await message.channel.send({ embeds: [ endQuestion(question, correctAnswersAsValue)] });

                // show the correct answer(s) for 10 seconds.
                await delay(10000);

                // we will now delete the `endQuestion` embed and show the leaderboard.
                await showAnswer.delete();

                // we are going to sort the `participants` array by their `totalPoints` in descending order.
                const sortByPoints = Object.entries(participants).sort((a, b) => b[1].totalPoints - a[1].totalPoints);
                let leaderboardAsValue = '';
                // we will now query through each participant in the newly created, sorted array and return the leaderboard as a string.
                sortByPoints.forEach((participant) => {
                    let ranking = 1;
                    for (ranking; ranking <= sortByPoints.length; ranking++) {
                        leaderboardAsValue = `#${ranking}. ${participant[1].usertag} - ${participant[1].choicesCorrect} choices correct with ${participant[1].totalPoints} points.\n`;
                    }
                });

                const showLeaderboard = await message.channel.send({ embeds: [ leaderboard(leaderboardAsValue) ] });

                // we will show the leaderboard for 5 seconds before deleting it.
                await delay(5000);
                await showLeaderboard.delete();

                // we will show the `next question loading` embed for 5 seconds before deleting it.
                const startNext = await message.channel.send({ embeds: [ nextQuestion ] });
                await delay(5000);
                await startNext.delete();
            }
        }
    } catch (err) {
        console.error(err);
        throw err;
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    // fetch all the commands from the Commands folder (obtained above)
    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} found!`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (err) {
        console.error(err);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

app.listen(5000, async () => {
    console.log('Listening from port 5000');

    client.login(process.env.TOKEN);

    await Moralis.start({
        serverUrl,
        appId,
        masterKey,
    });
});