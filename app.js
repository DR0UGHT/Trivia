const express = require('express');
const app = express();
const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://username:1FpXKTtplLkXX38e@cluster0.stlzdn3.mongodb.net/';
const client = new MongoClient(uri);

const bodyParser = require('body-parser');
const { count } = require('console');

const PORT = process.env.PORT || 3001;
const database = client.db('FlagGame');
const flagGame = database.collection('Trivia');

app.listen(PORT, () => {
    // color the text in the console
    console.log('\x1b[35m%s\x1b[0m', `Server is running on port ${PORT}`);
});
app.use(express.static('public'));
app.use(bodyParser.json());
app.get('/', (req, res) => {
    // load the index.html file from the public directory
    res.sendFile(__dirname + '/public/index.html');
});

// disconnect from the database when the app is closed
process.on('SIGINT', () => {
    client.close();
    process.exit();
});


app.post('/createLobby', async(req, res) => {
    try{
        const name = req.body.name;
        const lobbyCode = req.body.lobbyCode;
        const latestID = await GetLatestIDFromDatabase();
        // create the game object
        const game = {
            lobbyID: latestID + 1,
            lobbyCode: lobbyCode,
            numOfPlayers: 1,
            playerNames: [name],
            finished: false,
            playerFinished: [false, false],
            playerReady: [false, false],
            playerAnswer: ["", ""],
            playerScore: [0, 0],
            questions: req.body.questions,            
        }
        // make loby code green
        console.log('\x1b[32m%s\x1b[0m', "Creating lobby with code: " + lobbyCode);
        const result = await flagGame.insertOne(game);

        res.json({code : result.acknowledged ? 1 : 0});
    }catch(err){
        res.json({code : -1});
        // red text
        console.log('\x1b[31m%s\x1b[0m', "Could not create lobby: " + err);
    }
});

app.post('/joinLobby', async(req, res) => {
    try{
        const name = req.body.name;
        const lobbyCode = req.body.lobbyCode;
        const game = await FindLobby(lobbyCode);
        if(game.playerNames.length < 2){
            game.playerNames.push(name);
            game.numOfPlayers++;
            await flagGame.updateOne({lobbyCode: lobbyCode}, {$set: {playerNames: game.playerNames, numOfPlayers: game.numOfPlayers}});
            res.json({code: 1, players: game.playerNames});
        }else{
            res.json({code: 2});
        }
    }catch(err){
        res.json({code: 0});
        console.log('\x1b[31m%s\x1b[0m', "Could not join lobby: " + err);
    }
});

app.post('/getReadyStatus', async(req, res) => {
    try{
        await client.connect();
        const game = await flagGame.findOne({lobbyCode: req.body.lobbyCode});
        res.json({code: game === null ? 2 : 1, playerReady: game.playerReady});
    }catch(err){
        res.json({code: 0});
        console.log('\x1b[31m%s\x1b[0m', "Could not check if host is ready: " + err);
    }
});

app.post('/readyUp', async(req, res) => {
    try{
        await client.connect();
        const gameX = await FindLobby(req.body.lobbyCode);
        const game = await flagGame.updateOne({lobbyCode: req.body.lobbyCode}, {$set: {playerReady: 
            !req.body.host ? [gameX.playerReady[0], true] : [true, gameX.playerReady[1]]}});
        res.json({code: game.acknowledged ? 1 : 0});
    }catch(err){
        res.json({code: 0});
        console.log('\x1b[31m%s\x1b[0m', "Could not check if host is ready: " + err);
    }
});


app.post('/player2JoinedYet', async(req, res) => {
    try{
        await client.connect();
        const game = await flagGame.findOne({lobbyCode: req.body.lobbyCode});
        res.json({code: game.playerNames.length > 1 ? 1 : 0, playerTwoName: game.playerNames[1]});
    }catch(err){
        res.json({code: 0});
        console.log('\x1b[31m%s\x1b[0m', "Could not check if player 2 joined: " + err);
    }
});

app.post('/playersReadyForNextRound', async(req, res) => {
    try{
        await client.connect();
        const game = await flagGame.findOne({lobbyCode: req.body.lobbyCode});
        res.json({code: game.playerReady[0] && game.playerReady[1] ? 1 : 0});
    }catch(err){
        res.json({code: 0});
        console.log('\x1b[31m%s\x1b[0m', "Could not check if players are ready for the next round: " + err);
    }
});

app.post('/clearAnswers', async(req, res) => {
    try{
        await client.connect();
        const game = await flagGame.findOne({lobbyCode: req.body.lobbyCode});
        if(game === null){
            res.json({code: 2});
        }else{
            const newValues = {$set: {playerAnswer: ["", ""]}};
            const result = await flagGame.updateOne({lobbyCode: req.body.lobbyCode}, newValues);
            res.json({code: result.acknowledged ? 1 : 0});
        }
    }catch(err){
        res.json({code: 0});
        console.log('\x1b[31m%s\x1b[0m', "Could not clear answers: " + err);
    }
});

app.post('/submitAnswer', async(req, res) => {
    try{
        await client.connect();
        const game = await flagGame.findOne({lobbyCode: req.body.lobbyCode});
        newValues = {$set: {playerAnswer: req.body.host ? [req.body.answer, game.playerAnswer[1]] : [game.playerAnswer[0], req.body.answer]}};
        const result = await flagGame.updateOne({lobbyCode: req.body.lobbyCode}, newValues);
        res.json({code: result.acknowledged ? 1 : 0});
    }catch(err){
        res.json({code: 0});
        console.log('\x1b[31m%s\x1b[0m', "Could not submit answer: " + err);
    }
});

app.post('/clearFinishRound', async(req, res) => {
    try{
        await client.connect();
        const newValues = {$set: {playerFinished: [false, false]}}
        const result = await flagGame.updateOne({lobbyCode: req.body.lobbyCode}, newValues);
        res.json({code: result.acknowledged ? 1 : 0});
    }catch(err){
        res.json({code: 0});
        console.log('\x1b[31m%s\x1b[0m', "Could not clear finish round: " + err);
    }
});


app.post('/clearReady', async(req, res) => {
    try{
        await client.connect();
        const game = await flagGame.findOne({lobbyCode: req.body.lobbyCode});
        const newValues = {$set: {playerReady: [false, false]}};
        const result = await flagGame.updateOne({lobbyCode: req.body.lobbyCode}, newValues);
        res.json({code: result.acknowledged ? 1 : 0});
    }catch(err){
        res.json({code: 0});
        console.log('\x1b[31m%s\x1b[0m', "Could not clear ready status: " + err);
    }
});

app.post('/finishRound', async(req, res) => {
    try{
        await client.connect();
        const game = await flagGame.findOne({lobbyCode: req.body.lobbyCode});
        const newValues = {$set: {playerFinished: req.body.host ? [true, game.playerFinished[1]] : [game.playerFinished[0], true]}};
        const result = await flagGame.updateOne({lobbyCode: req.body.lobbyCode}, newValues);
        res.json({code: result.acknowledged ? 1 : 0});
    }catch(err){
        res.json({code: 0});
        console.log('\x1b[31m%s\x1b[0m', "Could not finish round: " + err);
    }
});

app.post('/addPoint', async(req, res) => {
    try{
        await client.connect();
        const game = await flagGame.findOne({lobbyCode: req.body.lobbyCode});
        const newValues = {$set: {playerScore: req.body.host ? [game.playerScore[0] + 1, game.playerScore[1]] : [game.playerScore[0], game.playerScore[1] + 1]}};
        const result = await flagGame.updateOne({lobbyCode : req.body.lobbyCode}, newValues);
        res.json({code: result.acknowledged ? 1 : 0});
    }catch(err){
        res.json({code: 0});
        console.log('\x1b[31m%s\x1b[0m', "Could not add points: " + err);
    }
});

app.post('/getFinishRound', async(req, res) => {
    try{
        await client.connect();
        const game = await flagGame.findOne({lobbyCode: req.body.lobbyCode});
        res.json({code: game != null && game.playerFinished[0] && game.playerFinished[1] ? 1 : 0});
    }catch(err){
        res.json({code: 0});
        console.log('\x1b[31m%s\x1b[0m', "Could not get finish round: " + err);
    }
});

app.post('/getQuestions', async(req, res) => {
    try{
        await client.connect();
        const game = await flagGame.findOne({lobbyCode: req.body.lobbyCode});
        res.json({code: game != null ? 1 : 0, questions: game.questions});
    }catch(err){
        res.json({code: 0});
        console.log('\x1b[31m%s\x1b[0m', "Could not get questions: " + err);
    }
});

app.post('/getScore', async(req, res) => {
    try{
        await client.connect();
        const game = await flagGame.findOne({lobbyCode: req.body.lobbyCode});
        res.json({code: game != null ? 1 : 0, scores: game.playerScore});
    }catch(err){
        res.json({code: 0});
        console.log('\x1b[31m%s\x1b[0m', "Could not get score: " + err);
    }
});

app.post('/getAnswers', async(req, res) => {
    try{
        await client.connect();
        const game = await flagGame.findOne({lobbyCode: req.body.lobbyCode});
        res.json({code: game != null ? 1 : game.acknowledged ? 1 : 0, answers: game.playerAnswer});
    }catch(err){
        res.json({code: 0});
        console.log('\x1b[31m%s\x1b[0m', "Could not get answers: " + err);
    }
});



async function GetLatestIDFromDatabase(){
    await client.connect();
    const querry = {};
    const options = {
        sort: {"lobbyID": -1},
        limit: 1,
        projection: {"lobbyID": 1, "_id": 0}
    }
    const cursor = await flagGame.findOne(querry, options);
    if(cursor === null) return 0;
    return cursor.lobbyID;
}

async function FindLobby(id){
    await client.connect();
    const querry = {lobbyCode: id};
    const cursor = await flagGame.findOne(querry);
    return cursor;
}