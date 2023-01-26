require('dotenv').config();

const { Client, GatewayIntentBits, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, ActionRow, DataResolver } = require('discord.js');
const express = require('express');
const app = express();
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Moralis = require('moralis-v1/node');

const { initialStart, quiz, questionLoading, leaderboard, endQuestion, nextQuestion, quizEnded } = require('./embeds/quiz');
const { getFirstQuizNotion, getSecondQuizNotion, getThirdQuizNotion } = require('./api/getQuizData');
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
        // ROLL DICE 1-50 LOGIC
        if (message.content.toLowerCase() === '?roll 1-50') {
            console.log('yes');
            // if the messager's role is not `The Creators`, then we send an error msg and return.
            if (!message.member._roles.includes('956946650218237993')) {
                await message.channel.send('You do not have permission to use this role.');
                return;
            }

            await message.channel.send('Rolling the dice...');
            // randomizes a number between 1 - 50
            const result = Math.floor(Math.random() * 50) + 1;

            // wait 5 seconds before showing the result
            await delay(5000);
            await message.channel.send(`The dice rolled: ${result}`);
        }

        // ROLL DICE 51-200 LOGIC
        if (message.content.toLowerCase() === '?roll 51-200') {
            // if the messager's role is not `The Creators`, then we send an error msg and return.
            if (!message.member._roles.includes('956946650218237993')) {
                await message.channel.send('You do not have permission to use this role.');
                return;
            }

            await message.channel.send('Rolling the dice...');
            // randomizes a number between 51 - 200
            const result = Math.floor(Math.random() * 150) + 51;

            // wait 5 seconds before showing the result
            await delay(5000);
            await message.channel.send(`The dice rolled: ${result}`);
        }

        if (message.content.toLowerCase() === '?quizv2') {
            // if the messager's role is not `The Creators`, then we send an error msg and return.
            if (!message.member._roles.includes('956946650218237993')) {
                await message.channel.send('You do not have permission to use this role.');
                return;
            }

            // we get an array of quiz data objects from `getQuizData`.
            // const quizDatas = await getFirstQuizNotion();

            // gets second quiz
            const quizDatas = await getThirdQuizNotion();

            // the description of the quiz
            const quizDescription = 'Guess The Logo fun. You think you know all the logos?';

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

            // delete the `quizCommencing` message after the delay finishes.
            await quizCommencing.delete();

            // we want to show the leaderboard permanently in the channel, so we will initialize it here and edit it after the end of each for loop.
            let showLeaderboard;

            // we loop through all the quiz data objects.
            // this is where most of the quiz logic will begin.
            for (currentQuestion; currentQuestion < quizDatas.length + 1; currentQuestion++) {
                // we get the quiz data for the current question.
                const { questionId, question, correctAnswers, minimumPoints, maximumPoints, duration, image } = quizDatas[currentQuestion - 1];

                // correct answers as a string
                let correctAnswersAsValue = 'Any of: ';
                for (let i = 0; i < correctAnswers.length; i++) {
                    correctAnswersAsValue = correctAnswersAsValue + correctAnswers[i];
                }

                // now, we send the question embed to the channel.
                const sendQuiz = await message.channel.send({ embeds: [quiz(questionId, question, minimumPoints, maximumPoints, duration, null, image)], components: [
                    {
                        // includes a button for answering.
                        type: 1,
                        components: [
                            {
                                type: 2,
                                style: 1,
                                label: 'Answer here',
                                custom_id: `answer${questionId}`,
                            },
                        ],
                    },
                ]});

                // timer starts now
                const actualStartTime = Date.now();

                // isCorrect will be 'true' if the user's answer is correct, otherwise it will be 'false'.
                let isCorrect;

                client.on('interactionCreate', async (interaction) => {
                    // we get the user info who interacted.
                    const user = interaction.user.username + '#' + interaction.user.discriminator;

                    // check how long it takes for the user to submit their answer.
                    let timeUsed;

                    // calculating the points the user gets.
                    let points;

                    // when the 'Answer here' button is clicked
                    if (interaction.isButton()) {
                        if (interaction.customId === `answer${questionId}`) {
                            // show the answer modal
                            const modal = new ModalBuilder()
                            .setCustomId(`answerModal${questionId}`)
                            .setTitle(`Question ${questionId}`)
                            .addComponents([
                                new ActionRowBuilder().addComponents(
                                    new TextInputBuilder()
                                        .setCustomId(`answerInput${questionId}`)
                                        .setLabel('Answer')
                                        .setStyle(TextInputStyle.Short)
                                        .setMinLength(1)
                                        .setRequired(true),
                                    ),
                                ]);
                            await interaction.showModal(modal);
                        }
                    }

                    // when the user submits the answer modal
                    if (interaction.type === InteractionType.ModalSubmit) {
                        // the user's answer time will be calculated.
                        timeUsed = (Date.now() - actualStartTime) / 1000;

                        if (interaction.customId === `answerModal${questionId}`) {
                            // we get the user's answer from the modal
                            const answer = interaction.fields.getTextInputValue(`answerInput${questionId}`);

                            await interaction.reply({ content: `You answered: ${answer}`, ephemeral: true });

                            // now we check if the answer is correct. some answers are accepted.
                            correctAnswers.forEach((correctAnswer) => {
                                if (answer.toLowerCase() === correctAnswer.toLowerCase()) {
                                    isCorrect = true;
                                }
                            });

                            // if user guesses correctly
                            if (isCorrect) {
                                // calculate points
                                points = timeUsed <= duration ? maximumPoints - ((maximumPoints - minimumPoints) / duration * timeUsed) : 0;

                                // check if participant is found in the `participants` array
                                const participantFound = participants.find(participant => participant.user === user);

                                // if not, we add the participant
                                if (!participantFound) {
                                    const participant = {
                                        user: user,
                                        correctAnswers: 1,
                                        wrongAnswers: 0,
                                        totalPoints: points,
                                    };
                                    participants.push(participant);
                                // if participant exists, we update the participant
                                } else {
                                    participants.forEach((participant) => {
                                        if (participant.user === user) {
                                            participant.correctAnswers += 1;
                                            participant.totalPoints += points;
                                        }
                                    });
                                }
                            // if user answers incorrectly
                            } else {
                                // check if participant is found in the `participants` array
                                const participantFound = participants.find(participant => participant.user === user);

                                // if not found, we create the participant and reduce 1000 points.
                                if (!participantFound) {
                                    const participant = {
                                        user: user,
                                        correctAnswers: 0,
                                        wrongAnswers: 1,
                                        totalPoints: -1000,
                                    };
                                    participants.push(participant);
                                } else {
                                    participants.forEach((participant) => {
                                        if (participant.user === user) {
                                            participant.wrongAnswers += 1;
                                            participant.totalPoints -= 1000;
                                        }
                                    });
                                }
                            }
                        }
                    }
                });

                // wait for the duration of the question to end before moving on to the next question.
                await delay(duration * 1000);

                // delete the current question once the timer ends and move on to the next one
                await sendQuiz.delete();

                // show the answer for this question
                const showAnswer = await message.channel.send({ embeds: [ endQuestion(question, correctAnswersAsValue)] });
                await delay(10000);

                await showAnswer.delete();

                console.log('There are: ', participants.length, ' participants.');

                // we are going to sort the participants array by the total points they have.
                const sortedParticipants = Object.entries(participants).sort((a, b) => b[1].totalPoints - a[1].totalPoints);
                
                // slice so we only take top 20 to not mess up the leaderboard and overflow.
                const sortByPoints = sortedParticipants.slice(0, 20);

                let leaderboardAsValue = '';
                let ranking = 1;

                // query through each participant in the new sorted array and return leaderboard as string
                sortByPoints.forEach((participant) => {
                    const totalAnswers = participant[1].correctAnswers + participant[1].wrongAnswers;
                    leaderboardAsValue += `#${ranking}. ${participant[1].user} - ${participant[1].correctAnswers}/${totalAnswers} answer(s) correct with ${participant[1].totalPoints.toFixed(2)} points.\n`;
                    ranking++;
                });

                if (leaderboardAsValue === '') {
                    // just to prevent an error, we will change an empty string to state that there are no participants yet.
                    leaderboardAsValue = 'No active participants on the quiz yet.';
                }

                // show leaderboard from first question and edit with updated data after each question.
                if (currentQuestion === 1) {
                    showLeaderboard = await message.channel.send({ embeds: [ leaderboard(leaderboardAsValue, false) ] });
                } else if (currentQuestion < quizDatas.length) {
                    await showLeaderboard.edit({ embeds: [ leaderboard(leaderboardAsValue, false) ] });
                } else {
                    // if it's the last question, we delete this leaderboard and show the final leaderboard.
                    await showLeaderboard.delete();
                }

                // as long as it's not the last question, we will run this logic.
                if (currentQuestion !== quizDatas.length) {
                    // we will show the 'next question loading' embed for 5 seconds.
                    const startNext = await message.channel.send({ embeds: [ nextQuestion ] });
                    await delay(5000);
                    await startNext.delete();
                } else {
                    // if it's the last question, we will show the final leaderboard.
                    await message.channel.send({ embeds: [ quizEnded(quizDatas.length, totalCorrectAnswers, totalPointsObtainable) ] });
                    await message.channel.send({ embeds: [ leaderboard(leaderboardAsValue, true) ] });

                    // recreate the entire leaderboard to put later on (manually) instead of only showing top 20
                    let finalLeaderboardAsValue = '';
                    let finalRanking = 1;
                    sortedParticipants.forEach((participant) => {
                        const totalChoices = participant[1].choicesCorrect + participant[1].choicesWrong;
                        finalLeaderboardAsValue += `#${finalRanking}. ${participant[1].usertag} - ${participant[1].choicesCorrect}/${totalChoices} choice(s) correct with ${participant[1].totalPoints.toFixed(2)} points.\n`;
                        finalRanking++;
                    });
                    console.log(finalLeaderboardAsValue);
                }
            }
        }

        // QUIZ LOGIC
        if (message.content.toLowerCase() === '?quiz') {
            // if the messager's role is not `The Creators`, then we send an error msg and return.
            if (!message.member._roles.includes('956946650218237993')) {
                await message.channel.send('You do not have permission to use this role.');
                return;
            }

            // we get an array of quiz data objects from `getQuizData`.
            // const quizDatas = await getFirstQuizNotion();

            // gets second quiz
            const quizDatas = await getThirdQuizNotion();

            // the description of the quiz
            const quizDescription = 'Enjoy this general knowledge quiz that covers just about every single topic possible - from easy to hard. Good luck!';

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
                const { questionId, question, answers, correctAnswers, minimumPoints, maximumPoints, duration, image } = quizDatas[currentQuestion - 1];

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
                await sendQuiz.edit({ embeds: [ quiz(questionId, question, minimumPoints, maximumPoints, duration, answersAsValue, image) ] });

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
                            let participant;
                            if (questionId !== quizDatas.length) {
                                participant = {
                                    usertag: user.tag,
                                    userId: user.id,
                                    choicesCorrect: 0,
                                    choicesWrong: 1,
                                    totalPoints: -1000,
                                };
                            // DELETE THIS LOGIC LATER ON. WORKS ONLY FOR THE SECND QUIZ'S LOGIC.
                            } else {
                                participant = {
                                    usertag: user.tag,
                                    userId: user.id,
                                    choicesCorrect: 0,
                                    choicesWrong: 1,
                                    totalPoints: -5000,
                                };
                            }
                            participants.push(participant);
                        // if the participant is found, we will update their data and reduce their points by 1000.
                        } else {
                            participants.forEach((participant) => {
                                if (currentQuestion !== quizDatas.length) {
                                    if (participant.userId === user.id) {
                                        participant.choicesWrong += 1;
                                        participant.totalPoints -= 1000;
                                    }
                                // DELETE THIS LOGIC LATER ON. WORKS ONLY FOR THE SECOND QUIZ'S LOGIC.
                                } else if (currentQuestion === quizDatas.length || currentQuestion === 21) {
                                    if (participant.userId === user.id) {
                                        participant.choicesWrong += 1;
                                        participant.totalPoints -= 5000;
                                    }
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
                        points[reaction.emoji.name] = timeUsed <= duration ? (maximumPoints - ((maximumPoints - minimumPoints) / duration * timeUsed)) : 0;

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

                console.log('There are: ', participants.length, ' participants');

                // we are going to sort the `participants` array by their `totalPoints` in descending order.
                const sortedParticipants = Object.entries(participants).sort((a, b) => b[1].totalPoints - a[1].totalPoints);

                // slice so we take only the top 20 participants and not messy up the leaderboard.
                const sortByPoints = sortedParticipants.slice(0, 20);

                let leaderboardAsValue = '';
                let ranking = 1;

                // we will now query through each participant in the newly created, sorted array and return the leaderboard as a string.
                sortByPoints.forEach((participant) => {
                    const totalChoices = participant[1].choicesCorrect + participant[1].choicesWrong;
                    leaderboardAsValue += `#${ranking}. ${participant[1].usertag} - ${participant[1].choicesCorrect}/${totalChoices} choice(s) correct with ${participant[1].totalPoints.toFixed(2)} points.\n`;
                    ranking++;
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
                } else {
                    // if it's the last question, we show the ending facts embed as well as the leaderboard embed as the final leaderboard embed.
                    await message.channel.send({ embeds: [ quizEnded(quizDatas.length, totalCorrectAnswers, totalPointsObtainable)] });
                    await message.channel.send({ embeds: [ leaderboard(leaderboardAsValue, true) ] });

                    // recreate the entire leaderboard to put later on (manually) instead of only showing top 20.
                    let finalLeaderboardAsValue = '';
                    let finalRanking = 1;
                    sortedParticipants.forEach((participant) => {
                        const totalChoices = participant[1].choicesCorrect + participant[1].choicesWrong;
                        finalLeaderboardAsValue += `#${finalRanking}. ${participant[1].usertag} - ${participant[1].choicesCorrect}/${totalChoices} choice(s) correct with ${participant[1].totalPoints.toFixed(2)} points.\n`;
                        finalRanking++;
                    });
                    console.log(finalLeaderboardAsValue);
                }
            }
        }
    } catch (err) {
        console.error(err);
        throw err;
    }
});

client.on('interactionCreate', async (interaction) => {
    console.log('interaction!');

    if (interaction.isButton()) {
        // // check for every answer button's id
        // if (interaction.customId.startsWith('answer')) {
        //     const quizData = await getThirdQuizNotion();

        //     for (let i = 1; i <= 25; i++) {
        //         // getting the current answer button's id
        //         if (interaction.customId === `answer${i}`) {
        //             // const answer = 
        //         }
        //     }
        // }
        // if (interaction.customId === 'answer') {
            // const modal = new ModalBuilder()
            //     .setCustomId('answerModal')
            //     .setTitle('Guess The Logo answer')
            //     .addComponents([
            //         new ActionRowBuilder().addComponents(
            //             new TextInputBuilder()
            //                 .setCustomId('answerInput')
            //                 .setLabel('Answer')
            //                 .setStyle(TextInputStyle.Short)
            //                 .setRequired(true),
            //         ),
            //     ]);
            // await interaction.showModal(modal);
        // }

        if (interaction.customId === 'testButton') {
            const modal = new ModalBuilder()
                .setCustomId('testModal')
                .setTitle('Test Modal')
                .addComponents([
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('testTextInput')
                            .setLabel('Answer')
                            .setStyle(TextInputStyle.Short)
                            .setMinLength(5)
                            .setMaxLength(10)
                            .setPlaceholder('Enter your answer here')
                            .setRequired(true),
                    ),
                ]);
            await interaction.showModal(modal);
        }
    }

    if (interaction.type === InteractionType.ModalSubmit) {
        if (interaction.customId === 'testModal') {
            const response = interaction.fields.getTextInputValue('testTextInput');
            console.log(response);
            await interaction.reply(`You answered: ${response}`);
        }

        if (interaction.customId === 'answerModal') {
            const response = interaction.fields.getTextInputValue('answerInput');
            console.log(response);
            await interaction.reply(`You answered: ${response}`);
        }
    }
});

// client.on('interactionCreate', async (interaction) => {
//     if (!interaction.isCommand()) return;

//     // fetch all the commands from the Commands folder (obtained above)
//     const command = client.commands.get(interaction.commandName);

//     if (!command) {
//         console.error(`No command matching ${interaction.commandName} found!`);
//         return;
//     }

//     try {
//         if (interaction.isButton()) {
//             if (interaction.customId === 'testButton') {
//                 const modal = new ModalBuilder()
//                     .setCustomId('testModal')
//                     .setTitle('Test Modal')
//                     .addComponents([
//                         new ActionRowBuilder().addComponents(
//                             new TextInputBuilder()
//                                 .setCustomId('testTextInput')
//                                 .setLabel('Answer')
//                                 .setStyle(TextInputStyle.Short)
//                                 .setMinLength(5)
//                                 .setMaxLength(10)
//                                 .setPlaceholder('Enter your answer here')
//                                 .setRequired(true),
//                         ),
//                     ]);
//                 await interaction.showModal(modal);
//             }
//         }

//         if (interaction.type === InteractionType.ModalSubmit) {
//             if (interaction.customId === 'testModal') {
//                 const response = interaction.fields.getTextInputValue('testTextInput');
//                 console.log(response);
//                 await interaction.reply(`You answered: ${response}`);
//             }
//         }

//         await command.execute(interaction);
//     } catch (err) {
//         console.error(err);
//         await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
//     }
// });

app.listen(5000, async () => {
    console.log('Listening from port 5000');

    client.login(process.env.TOKEN);

    await Moralis.start({
        serverUrl,
        appId,
        masterKey,
    });
});