require('dotenv').config();
const { EmbedBuilder } = require('discord.js');

/**
 *
 * @param {String} description
 * @param {Number} startTime
 * @returns
 */
const initialStart = (description, startTime, totalQuestions) => {
    return new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Quiz is starting soon.')
        .setDescription(`This quiz will start in ${startTime} seconds.`)
        .addFields(
            { name: 'Quiz description', value: description },
            { name: 'Total questions', value: totalQuestions },
        )
        .setTimestamp();
};

const questionLoading = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Loading question.')
        .setDescription('Once all reaction emojis are available, the question will be loaded. \n Please do not try to react yet or your points won\'t be calculated properly.');

const leaderboard = (leaderboardValue, isFinal) => {
    return new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle(`${isFinal ? 'Final' : 'Current'} leaderboard`)
        .addFields(
            { name: '‎', value: leaderboardValue },
        );
};

const endQuestion = (question, correctAnswers) => {
    return new EmbedBuilder()
        .setColor(0x0099FF)
        .setAuthor({ name: 'Time\'s up!' })
        .setTitle(`The question was: ${question}`)
        .setFooter({ text: 'Did you get it right?' })
        .addFields(
            { name: '‎', value: `The correct answer(s) is/are: \n ${correctAnswers}` },
        );
};

const nextQuestion = new EmbedBuilder()
    .setColor(0x0099FF)
    .setAuthor({ name: 'Get ready for the next question.' })
    .addFields(
        { name: '‎', value: 'The next question will load in 5 seconds.' },
    );

const quiz = (
    questionId,
    question,
    minimumPoints,
    maximumPoints,
    duration,
    answersAsValue,
) => {
    return new EmbedBuilder()
        .setColor(0x0099FF)
        .setAuthor({ name: `Question ${questionId}` })
        .setTitle(question)
        .setFooter({ text: `Duration: ${duration}s | Each correct answer gives you ${minimumPoints} - ${maximumPoints} points.` })
        .addFields(
            { name: '‎', value: answersAsValue },
        );
};

module.exports = {
    initialStart,
    leaderboard,
    quiz,
    questionLoading,
    endQuestion,
    nextQuestion,
};