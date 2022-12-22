require('dotenv').config();
const Moralis = require('moralis-v1/node');
const { parseJSON } = require('../utils/jsonParser');
const axios = require('axios').default;

const serverUrl = process.env.MORALIS_SERVERURL;
const appId = process.env.MORALIS_APPID;
const masterKey = process.env.MORALIS_MASTERKEY;

/**
 *
 * @returns {Array} - an array of quiz data objects for each question.
 */
// const getQuizData = async () => {
//     try {
//         await Moralis.start({
//             serverUrl,
//             appId,
//             masterKey,
//         });

//         const Quiz = new Moralis.Query('RealmHunterQuizBot');
//         const query = await Quiz.find({ useMasterKey: true });

//         if (!query) {
//             throw new Error('Cannot find results. Please check the QuizBot class again.');
//         }

//         const result = parseJSON(query);

//         // an array of question data objects which include the question, answer(s), and other important data.
//         const questionDatas = [];

//         // we loop through each `item` in `result` to create a `questionData` object and we push it to `questionDatas`.
//         result.forEach((questionItem) => {
//             const questionData = {
//                 questionId: questionItem.questionId,
//                 question: questionItem.question,
//                 answers: questionItem.answers,
//                 correctAnswers: questionItem.correctAnswers,
//                 minimumPoints: questionItem.minimumPoints,
//                 maximumPoints: questionItem.maximumPoints,
//                 duration: questionItem.duration,
//             };
//             questionDatas.push(questionData);
//         });

//         return questionDatas;
//     } catch (err) {
//         console.error(err);
//         throw err;
//     }
// };

/**
 * @dev alternative version of `getQuizData` where the data is obtained from Notion instead (FOR FIRST QUIZ TRIAL).
 */
const getFirstQuizNotion = async () => {
    try {
        const config = {
            method: 'post',
            url: `https://api.notion.com/v1/databases/${process.env.FIRST_TRIALQUIZ_ID}/query`,
            headers: {
                'Notion-Version': '2022-06-28',
                'Authorization': process.env.NOTION_TOKEN,
            },
        };

        const response = await axios(config).catch((err) => {
            if (err.response) {
                throw new Error(`Error: ${err.response.data.errorMessage}`);
            } else if (err.request) {
                throw new Error(`Error: ${err.request.data.errorMessage}`);
            } else {
                throw new Error(`Error: ${err}`);
            }
        });

        // getting the results obtained from the axios response if no errors are thrown.
        const results = response.data.results;

        // an array of question data objects which include the question, answer(s), and other important data.
        const questionDatas = [];

        results.forEach((result) => {
            // console.log(result.properties['Image'].files.length === 0);
            // returns an array of answers
            const answers = result.properties['Answers'].rich_text[0].plain_text.split('", ');

            // returns an array of correct answers
            const correctAnswers = result.properties['Correct Answers'].rich_text[0].plain_text.split('", ');

            // removes the initial double quote from each answer
            for (let i = 0; i < answers.length; i++) {
                answers[i] = answers[i].replace(/[""]/g, '');
            }

            // removes the initial double quote from each correct answer
            for (let j = 0; j < correctAnswers.length; j++) {
                correctAnswers[j] = correctAnswers[j].replace(/[""]/g, '');
            }

            // if the question has an image, it will be added here.
            const image = result.properties['Image'].files.length === 0 ? null : result.properties['Image'].files[0].file.url;

            const questionData = {
                questionId: result.properties['ID'].title[0].plain_text,
                question: result.properties['Question'].rich_text[0].plain_text,
                answers: answers,
                correctAnswers: correctAnswers,
                minimumPoints: result.properties['Minimum Points'].number,
                maximumPoints: result.properties['Maximum Points'].number,
                duration: result.properties['Duration'].number,
                image: image,
            };
            questionDatas.push(questionData);
        });

        // returns the question datas sorted by ascending order of questionId
        return questionDatas.sort((a, b) => a.questionId - b.questionId);
    } catch (err) {
        console.error(err);
        throw err;
    }
};

module.exports = {
    // getQuizData,
    getFirstQuizNotion,
};