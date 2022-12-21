require('dotenv').config();

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const express = require('express');
const app = express();
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Moralis = require('moralis-v1/node');

const { initialStart, quiz, questionLoading, leaderboard, endQuestion, nextQuestion, rules, quizEnded } = require('./embeds/quiz');
const { getFirstQuizNotion } = require('./api/getQuizData');
const { delay } = require('./utils/delay');
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

            // we get an array of quiz data objects from `getQuizData`.
            const quizDatas = await getFirstQuizNotion();

            // the description of the quiz
            const quizDescription = `This quiz will grant you general knowledge about Realm Hunter's basics. 
                                    Don't worry about not knowing any of the answers, since it's meant to be built like that.
                                    The point is to have interactive fun and gather a bit of knowledge about the game along the way!`;

            // the time in seconds before the quiz starts
            const startsIn = 10;

            // announcing that the quiz is commencing
            const quizCommencing = await message.channel.send({ embeds: [initialStart(quizDescription, startsIn)] });

            // we wait 10 seconds before commencing the quiz (and with it deleting the `quizCommencing` message)
            await delay(startsIn * 1000);

            // this array will contain all participant objects for the quiz.
            // Note: in order for a participant to be added, they need to have at least 1 question correct, otherwise it's not saved.
            const participants = [];

            // we start with question 1.
            let currentQuestion = 1;

            // we get the amount of correct answers for each question to see how many correct answers are in the quiz after it ends.
            let totalCorrectAnswers = 0;

            // we also want to get the amount of points obtainable in this quiz in total after it ends.
            let totalPointsObtainable = 0;

            // each question can have up to 9 answers. each of them will represent an emoji to react to.
            const answersAsEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

            // delete the `quizCommencing` message after the delay finishes.
            await quizCommencing.delete();

            // // before commencing the quiz, we send the rules of the quiz for 30 seconds.
            // const showRules = await message.channel.send({ embeds: [rules] });
            // await delay(30000);
            // await showRules.delete();

            // we want to show the leaderboard permanently in the channel, so we will initialize it here and edit it after the end of each for loop.
            let showLeaderboard;

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
                // we add `totalCorrectAnswers` by the amount of correct answers there are for this question.
                totalCorrectAnswers += correctAnswers.length;
                // we add `totalPointsObtainable` by the maximum points for each correect answer for this question.
                totalPointsObtainable += (maximumPoints * correctAnswers.length);

                for (let i = 0; i < correctAnswers.length; i++) {
                    // we want to check for the index of the correct answer in the `answers` array.
                    const index = answers.indexOf(correctAnswers[i]);
                    // if the index isn't -1, that means that it is a match and we can push the emoji equivalent.
                    if (index !== -1) {
                        correctAnswersAsEmojis.push(answersAsEmojis[index]);
                        correctAnswersAsValue += `${answersAsEmojis[index]} ${correctAnswers[i]}\n`;
                    }
                }

                // this logic will be called when there is only 1 correct answer.
                if (correctAnswers.length === 1) {
                    // we create two filters, one for the correct answer and one for the wrong answer emojis.
                    const correctFilter = (reaction, user) => correctAnswersAsEmojis.includes(reaction.emoji.name) && !user.bot;
                    const wrongFilter = (reaction, user) => !correctAnswersAsEmojis.includes(reaction.emoji.name) && !user.bot;

                    // we now create two reaction collectors, one for the correct answer and one for the wrong answer emojis.
                    const correctCollector = sendQuiz.createReactionCollector({ filter: correctFilter, time: duration * 1000, dispose: true });
                    const wrongCollector = sendQuiz.createReactionCollector({ filter: wrongFilter, time: duration * 1000, dispose: true });

                    // we get both the time used and points earned by the participant for this question.
                    let timeUsed;
                    let points;

                    // first we will create the logic for the `correctCollector`.
                    // if the user reacts with the correct answer, this logic will run.
                    correctCollector.on('collect', (reaction, user) => {
                        // getting the timestamp of when the user reacted.
                        const reacted = Date.now();
                        // time taken for them to react (in seconds)
                        timeUsed = (reacted - actualStartTime) / 1000;

                        // calculating the points earned by the user (linear decrease in points based on time used)
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
                                choicesWrong: 0,
                                totalPoints: points,
                            };
                            // we push the `participant` object to the `participants` array.
                            participants.push(participant);
                        } else {
                            // if the participant already exists, we will update their data.
                            participants.forEach((participant) => {
                                if (participant.userId === user.id) {
                                    participant.choicesCorrect += 1;
                                    participant.totalPoints += points;
                                }
                                // console.log(participant.totalPoints);
                            });
                        }
                        // console.log(`${user.tag} guessed ${reaction.emoji.name} correctly within ${timeUsed} seconds!.`);
                    });

                    // if the user removes their correct answer reaction, this logic will run.
                    correctCollector.on('remove', (reaction, user) => {
                        // we want to first check if the participant exists.
                        const participantFound = participants.find(participant => participant.userId === user.id);

                        // if the participant exists, we update their `points` and `choicesCorrect`.
                        if (participantFound) {
                            participants.forEach((participant) => {
                                if (participant.userId === user.id) {
                                    participant.choicesCorrect -= 1;
                                    participant.totalPoints -= points;
                                }
                                // console.log(participant.totalPoints);
                            });
                        // this technically should never run since in order for them to have a participant object, they need to react to this emoji.
                        // but just in case, we will create a participant object with 0 points and 0 choices correct.
                        } else {
                            const participant = {
                                usertag: user.tag,
                                userId: user.id,
                                choicesCorrect: 0,
                                totalPoints: 0,
                            };
                            participants.push(participant);
                        }
                        // console.log(`${user.tag} removed their reaction.`);
                    });

                    // this logic will run if the user reacts with any wrong answer.
                    wrongCollector.on('collect', (reaction, user) => {
                        // console.log(`${user.tag} chose the wrong emoji, ${reaction.emoji.name}.`);
                        // we want to check if the participant exists in `participants`.
                        const participantFound = participants.find(participant => participant.userId === user.id);

                        // if the participant is not found, we will create a participant object and give them -1000 points.
                        if (!participantFound) {
                            const participant = {
                                usertag: user.tag,
                                userId: user.id,
                                choicesCorrect: 0,
                                choicesWrong: 1,
                                totalPoints: -1000,
                            };
                            participants.push(participant);
                        // if the participant is found, we will update their data and reduce their points by 1000.
                        } else {
                            participants.forEach((participant) => {
                                if (participant.userId === user.id) {
                                    participant.choicesWrong += 1;
                                    participant.totalPoints -= 1000;
                                }
                                // console.log(participant.totalPoints);
                            });
                        }
                    });

                    // this logic will run if the user removes their wrong answer reaction.
                    wrongCollector.on('remove', (reaction, user) => {
                        // console.log(`${user.tag} removed their wrong emoji choice, ${reaction.emoji.name}`);
                        // we want to check if the participant exists in `participants`.
                        const participantFound = participants.find(participant => participant.userId === user.id);

                        // if the participant is found, we will update their data and regive them their 1000 points back.
                        if (participantFound) {
                            participants.forEach((participant) => {
                                if (participant.userId === user.id) {
                                    participant.choicesWrong -= 1;
                                    participant.totalPoints += 1000;
                                }
                                // console.log(participant.totalPoints);
                            });
                        // if somehow the participant is not found, we will only create a participant object for them and give 0 points.
                        // this is because they didn't 'lose' any points to begin with and they removed their reaction anyway.
                        } else {
                            const participant = {
                                usertag: user.tag,
                                userId: user.id,
                                choicesCorrect: 0,
                                choicesWrong: 0,
                                totalPoints: 0,
                            };
                            participants.push(participant);
                        }
                    });
                }

                // if there is more than 1 correct answer, we will use this logic.
                if (correctAnswers.length > 1) {
                    // we create two filters, one for the correct answer and one for the wrong answer emojis.
                    const correctFilter = (reaction, user) => correctAnswersAsEmojis.includes(reaction.emoji.name) && !user.bot;
                    const wrongFilter = (reaction, user) => !correctAnswersAsEmojis.includes(reaction.emoji.name) && !user.bot;

                    // we now create two reaction collectors, one for the correct answer and one for the wrong answer emojis.
                    const correctCollector = sendQuiz.createReactionCollector({ filter: correctFilter, time: duration * 1000, dispose: true });
                    const wrongCollector = sendQuiz.createReactionCollector({ filter: wrongFilter, time: duration * 1000, dispose: true });

                    // we get both the time used and points earned by the participant for this question.
                    let timeUsed;
                    // since there are multiple correct answers, we need to keep track of the points earned for each correct answer.
                    // this is why instead of a single value, we will create an object of points so we can track properly.
                    const points = {};

                    // if the user reacts with a correct answer, this logic will run.
                    correctCollector.on('collect', (reaction, user) => {
                        // getting the timestamp of when the user reacted.
                        const reacted = Date.now();
                        // time taken for them to react (in seconds)
                        timeUsed = (reacted - actualStartTime) / 1000;

                        // calculating the points earned by the user (linear decrease in points based on time used)
                        // if the user somehow still manages to react after the duration, they will get 0 points.
                        points[reaction.emoji.name] = timeUsed <= duration ? maximumPoints - ((maximumPoints - minimumPoints) / duration * timeUsed) : 0;

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
                                choicesWrong: 0,
                                totalPoints: points[reaction.emoji.name],
                            };
                            // we push the `participant` object to the `participants` array.
                            participants.push(participant);
                        } else {
                            // if the participant already exists, we will update their data.
                            participants.forEach((participant) => {
                                if (participant.userId === user.id) {
                                    participant.choicesCorrect += 1;
                                    participant.totalPoints += points[reaction.emoji.name];
                                }
                                // console.log(participant.totalPoints);
                            });
                        }
                        // console.log(`${user.tag} guessed ${reaction.emoji.name} correctly within ${timeUsed} seconds!.`);
                    });

                    // if the user removes their correct answer reaction, this logic will run.
                    correctCollector.on('remove', (reaction, user) => {
                        // we want to first check if the participant exists.
                        const participantFound = participants.find(participant => participant.userId === user.id);

                        // if the participant exists, we update their `points` and `choicesCorrect`.
                        if (participantFound) {
                            participants.forEach((participant) => {
                                if (participant.userId === user.id) {
                                    participant.choicesCorrect -= 1;
                                    participant.totalPoints -= points[reaction.emoji.name];
                                }
                                // console.log(participant.totalPoints);
                            });
                        // this technically should never run since in order for them to have a participant object, they need to react to this emoji.
                        // but just in case, we will create a participant object with 0 points and 0 choices correct.
                        } else {
                            const participant = {
                                usertag: user.tag,
                                userId: user.id,
                                choicesCorrect: 0,
                                totalPoints: 0,
                            };
                            participants.push(participant);
                        }
                        // console.log(`${user.tag} removed their reaction ${reaction.emoji.name}.`);
                    });

                    // for the wrong answer reactions, we will first check the amount of correct answers available for the question.
                    // if the correct answers are less than or half the amount of the available answers
                    if (correctAnswers.length <= (answers.length / 2)) {
                        wrongCollector.on('collect', (reaction, user) => {
                            // console.log(`${user.tag} chose the wrong emoji, ${reaction.emoji.name}.`);
                            // we want to check if the participant exists in `participants`.
                            const participantFound = participants.find(participant => participant.userId === user.id);

                            // if the participant is not found, we will create a participant object and give them -1000 points.
                            if (!participantFound) {
                                const participant = {
                                    usertag: user.tag,
                                    userId: user.id,
                                    choicesCorrect: 0,
                                    choicesWrong: 1,
                                    totalPoints: -1000,
                                };
                                participants.push(participant);
                            // if the participant is found, we will update their data and reduce their points by 1000.
                            } else {
                                participants.forEach((participant) => {
                                    if (participant.userId === user.id) {
                                        participant.choicesWrong += 1;
                                        participant.totalPoints -= 1000;
                                    }
                                    // console.log(participant.totalPoints);
                                });
                            }
                        });

                        // if the user removes their wrong answer reaction, this logic will run.
                        wrongCollector.on('remove', (reaction, user) => {
                            // console.log(`${user.tag} removed their wrong emoji choice, ${reaction.emoji.name}`);
                            // we want to check if the participant exists in `participants`.
                            const participantFound = participants.find(participant => participant.userId === user.id);

                            // if the participant is found, we will update their data and regive them their 1000 points back.
                            if (participantFound) {
                                participants.forEach((participant) => {
                                    if (participant.userId === user.id) {
                                        participant.choicesWrong -= 1;
                                        participant.totalPoints += 1000;
                                    }
                                    // console.log(participant.totalPoints);
                                });
                            // if somehow the participant is not found, we will only create a participant object for them and give 0 points.
                            // this is because they didn't 'lose' any points to begin with and they removed their reaction anyway.
                            } else {
                                const participant = {
                                    usertag: user.tag,
                                    userId: user.id,
                                    choicesCorrect: 0,
                                    choicesWrong: 0,
                                    totalPoints: 0,
                                };
                                participants.push(participant);
                            }
                        });
                    // if the correct answers are more than half the amount of the available answers
                    } else {
                        // only difference with the code above is that we will give them -2000 points instead of -1000.
                        wrongCollector.on('collect', (reaction, user) => {
                            // console.log(`${user.tag} chose the wrong emoji, ${reaction.emoji.name}.`);
                            // we want to check if the participant exists in `participants`.
                            const participantFound = participants.find(participant => participant.userId === user.id);

                            // if the participant is not found, we will create a participant object and give them -2000 points.
                            if (!participantFound) {
                                const participant = {
                                    usertag: user.tag,
                                    userId: user.id,
                                    choicesCorrect: 0,
                                    choicesWrong: 1,
                                    totalPoints: -2000,
                                };
                                participants.push(participant);
                            // if the participant is found, we will update their data and reduce their points by 2000.
                            } else {
                                participants.forEach((participant) => {
                                    if (participant.userId === user.id) {
                                        participant.choicesWrong += 1;
                                        participant.totalPoints -= 2000;
                                    }
                                    // console.log(participant.totalPoints);
                                });
                            }
                        });

                        // if the user removes their wrong answer reaction, this logic will run.
                        wrongCollector.on('remove', (reaction, user) => {
                            // only difference with the code above is that we will give them +2000 points instead of +1000.
                            // console.log(`${user.tag} removed their wrong emoji choice, ${reaction.emoji.name}`);
                            // we want to check if the participant exists in `participants`.
                            const participantFound = participants.find(participant => participant.userId === user.id);

                            // if the participant is found, we will update their data and regive them their 1000 points back.
                            if (participantFound) {
                                participants.forEach((participant) => {
                                    if (participant.userId === user.id) {
                                        participant.choicesWrong -= 1;
                                        participant.totalPoints += 2000;
                                    }
                                    // console.log(participant.totalPoints);
                                });
                            // if somehow the participant is not found, we will only create a participant object for them and give 0 points.
                            // this is because they didn't 'lose' any points to begin with and they removed their reaction anyway.
                            } else {
                                const participant = {
                                    usertag: user.tag,
                                    userId: user.id,
                                    choicesCorrect: 0,
                                    choicesWrong: 0,
                                    totalPoints: 0,
                                };
                                participants.push(participant);
                            }
                        });
                    }
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
                let ranking = 1;

                // we will now query through each participant in the newly created, sorted array and return the leaderboard as a string.
                sortByPoints.forEach((participant) => {
                    const totalChoices = participant[1].choicesCorrect + participant[1].choicesWrong;
                    leaderboardAsValue += `#${ranking}. ${participant[1].usertag} - ${participant[1].choicesCorrect}/${totalChoices} choice(s) correct with ${participant[1].totalPoints} points.\n`;
                    ranking++;
                    // for (ranking; ranking <= participant[1].length; ranking++) {
                    //     leaderboardAsValue += `#${ranking}. ${participant[1].usertag} - ${participant[1].choicesCorrect}/${totalChoices} choice(s) correct with ${participant[1].totalPoints} points.\n`;
                    // }
                });

                if (leaderboardAsValue === '') {
                    // just to prevent an error, we will change an empty string to state that there are no participants yet.
                    leaderboardAsValue = 'No active participants on the quiz yet.';
                }

                // we want to start showing the leaderboard from the first question and edit it with the updated data after each question.
                if (currentQuestion === 1) {
                    showLeaderboard = await message.channel.send({ embeds: [ leaderboard(leaderboardAsValue, false) ] });
                } else if (currentQuestion < quizDatas.length) {
                    await showLeaderboard.edit({ embeds: [ leaderboard(leaderboardAsValue, false) ] });
                // if it's the last question, we delete this leaderboard and show the `final leaderboard` as the logic shows down below.
                } else {
                    await showLeaderboard.delete();
                }

                // as long as it's not the last question, we will run this logic.
                if (currentQuestion !== quizDatas.length) {
                    // we will show the `next question loading` embed for 5 seconds before deleting it.
                    const startNext = await message.channel.send({ embeds: [ nextQuestion ] });
                    await delay(5000);
                    await startNext.delete();
                    // console.log(totalCorrectAnswers);
                    // console.log(totalPointsObtainable);
                } else {
                    // if it's the last question, we show the ending facts embed as well as the leaderboard embed as the final leaderboard embed.
                    await message.channel.send({ embeds: [ quizEnded(quizDatas.length, totalCorrectAnswers, totalPointsObtainable)] });
                    await message.channel.send({ embeds: [ leaderboard(leaderboardAsValue, true) ] });
                }
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