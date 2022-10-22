require('dotenv').config();
const Moralis = require('moralis-v1/node');
const { parseJSON } = require('../utils/jsonParser');

const serverUrl = process.env.MORALIS_SERVERURL;
const appId = process.env.MORALIS_APPID;
const masterKey = process.env.MORALIS_MASTERKEY;

/**
 *
 * @returns {Array} - an array of quiz data objects for each question.
 */
const getQuizData = async () => {
    try {
        await Moralis.start({
            serverUrl,
            appId,
            masterKey,
        });

        const Quiz = new Moralis.Query('RealmHunterQuizBot');
        const query = await Quiz.find({ useMasterKey: true });

        if (!query) {
            throw new Error('Cannot find results. Please check the QuizBot class again.');
        }

        const result = parseJSON(query);

        // an array of question data objects which include the question, answer(s), and other important data.
        const questionDatas = [];

        // we loop through each `item` in `result` to create a `questionData` object and we push it to `questionDatas`.
        result.forEach((questionItem) => {
            const questionData = {
                questionId: questionItem.questionId,
                question: questionItem.question,
                answers: questionItem.answers,
                correctAnswers: questionItem.correctAnswers,
                minimumPoints: questionItem.minimumPoints,
                maximumPoints: questionItem.maximumPoints,
                duration: questionItem.duration,
            };
            questionDatas.push(questionData);
        });

        return questionDatas;
    } catch (err) {
        console.error(err);
        throw err;
    }
};

module.exports = {
    getQuizData,
};