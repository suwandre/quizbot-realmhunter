require('dotenv').config();
const { EmbedBuilder } = require('discord.js');

/**
 *
 * @param {String} description
 * @param {Number} startTime
 * @param {String} totalQuestions as a string
 * @returns
 */
const initialStart = (description, startTime) => {
    return new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Quiz is starting soon.')
        .setDescription(`This quiz will start in ${startTime} seconds.`)
        .addFields(
            { name: 'Quiz description', value: description },
        )
        .setTimestamp();
};

const rules = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('Quiz rules')
        .addFields(
            { name: 'Questions', value: 'There are 25 questions in this quiz.' },
            { name: 'Points', value: 'The amount of points that you can obtain per question can be found in the footer of each question.' },
            { name: 'Points calculation', value: 'The amount of points you can get per question will be decreased linearly depending on the amount of time that you take to answer.' },
            { name: 'Multiple choice', value: `Some questions only have one answer while others have multiple. \n
            Please note that each wrong answer will penalize your points by either the question's maximum points or double that. \n
            So, don't even try to react to all the emojis thinking that you're clever ;)` },
            { name: 'Time', value: 'The amount of time you have for each question is also displayed in the footer of that question.' },
            { name: 'Quiz duration', value: 'This quiz is expected to take maximum 30 minutes.' },
        );

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

const quizEnded = (totalQuestions, maxCorrectAnswers, maxPoints) => {
    return new EmbedBuilder()
        .setColor(0x0099FF)
        .setAuthor({ name: 'We hope you liked it!' })
        .setTitle('Here are some facts about this quiz.')
        .addFields(
            { name: 'Total questions', value: `There were ${totalQuestions} questions in this quiz.` },
            { name: 'Amount of correct answers', value: `There were a total of ${maxCorrectAnswers} that you could've chosen.` },
            { name: 'Maximum points', value: `Assuming you answered every correct answer within 0 seconds, you could've gotten ${maxPoints} points!` },
        );
};

module.exports = {
    initialStart,
    leaderboard,
    quiz,
    questionLoading,
    endQuestion,
    nextQuestion,
    rules,
    quizEnded
};