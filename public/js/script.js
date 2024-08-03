var debugMode = false;

var lobbyCode = "";
var round = 0;
var players = {
    names: ["", ""],
    scores: [0, 0],
    ready: [false, false],
    answers: ["", ""]
}

var currentChoice = "";

var host = false;
var questions = {};

const TIMEOUT = 5;

async function joinLobby() {
    data = await connectToLobby();
    if(data == null) return;
    
    players.names[0] = data.players[0];
    document.getElementById("loading").style.display = "none";
    document.getElementById("game").style.display = "block";
    document.getElementById("lobbyIdSpan").innerHTML = lobbyCode.toString();
    document.getElementById("p1").innerHTML = players.names[1];
    document.getElementById("p2").innerHTML = players.names[0];
    document.getElementById("p1Game").innerHTML = players.names[1];
    document.getElementById("p2Game").innerHTML = players.names[0];
    document.getElementById("p2Waiting").innerHTML = "Waiting for " + players.names[0] + " to ready up...";
    document.getElementById("p1RU").style.display = "block";
    document.getElementById("lobbyIdSpan").innerHTML = "";
    while(!players.ready[0] || !players.ready[1]) {
        await new Promise(r => setTimeout(r, 1000));

        if(!players.ready[0]) {
            const response = await fetch('/getReadyStatus', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({lobbyCode: lobbyCode})
            });

            let data = await response.json();

            if(data.code == 1 && data.playerReady[0]) {
                players.ready[0] = data.playerReady[0];
                document.getElementById("p2Waiting").innerHTML = players.names[0] + " is ready!";
            }
        }
    }

    document.getElementById("readyUpP1").style.display = "none";
    document.getElementById("readyUpP2").style.display = "none";
    document.getElementById("playGameP1").style.display = "flex";
    document.getElementById("playGameP2").style.display = "flex";
    

    //wait for country order
    while(true) {
        await new Promise(r => setTimeout(r, 1000));
        const response2 = await fetch('/getQuestions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({lobbyCode: lobbyCode})
        });

        let data2 = await response2.json();

        if(data2.code == 1) {
            questions = data2.questions;
            break;
        }
    }
    players.ready[0] = false;
    players.ready[1] = false;
    GameLoop()
}

async function createLobby() {
    var name = document.getElementById("playerNameCreate").value;

    if(name.length == 0) {
        alert("Please enter a name.");
        return;
    }

    players.names[0] = name;
    document.getElementById("loading").style.display = "block";
    document.getElementById("menu").style.display = "none";

    //random 16 hex digit lobby code
    lobbyCode = Math.floor(Math.random() * 16**16).toString(16).padStart(16, '0');

    await new Promise(r => setTimeout(r, 1000));
    const response1 = await fetch('https://opentdb.com/api.php?amount=50');
    const data = await response1.json();
    questions = data.results;


    const response = await fetch('/createLobby', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({name: name, lobbyCode: lobbyCode, questions: questions})
    });

    const data1 = await response.json();

    if(data1.code == 1) {
        document.getElementById("loading").style.display = "none";
        document.getElementById("game").style.display = "block";
        document.getElementById("lobbyIdSpan").innerHTML = lobbyCode.toString();
    }else{
        alert("Error creating lobby.");
        document.getElementById("loading").style.display = "none";
        document.getElementById("menu").style.display = "flex";
    }


    //find all class pName and set innerHTML to name
    document.getElementById("p1").innerHTML = name;
    document.getElementById("p1Game").innerHTML = name;
    document.getElementById("p2Waiting").innerHTML = "Waiting for player 2 to join lobby...";
    host = true;

    while(players.names[1] == "") {
        await new Promise(r => setTimeout(r, 1000));

        let response = await fetch('/player2JoinedYet', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({lobbyCode: lobbyCode})
        });

        let data = await response.json();

        if(data.code == 1) {
            players.names[1] = data.playerTwoName;
            document.getElementById("p2").innerHTML = players.names[1];
            document.getElementById("p2Game").innerHTML = players.names[1];
        }
    }

    document.getElementById("lobbyIdSpan").innerHTML = "";
    document.getElementById("p2Waiting").innerHTML = "Waiting for " + players.names[1] + " to ready up...";
    document.getElementById("p1RU").style.display = "block";


    while(!players.ready[0] || !players.ready[1]) {
        await new Promise(r => setTimeout(r, 1000));

        if(!players.ready[1]) {
            const response = await fetch('/getReadyStatus', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({lobbyCode: lobbyCode})
            });

            let data = await response.json();

            if(data.code == 1 && data.playerReady[1]) {
                players.ready[1] = true;
                document.getElementById("p2Waiting").innerHTML = players.names[1] + " is ready!";
            }
        }
    }

    document.getElementById("readyUpP1").style.display = "none";
    document.getElementById("readyUpP2").style.display = "none";
    document.getElementById("playGameP1").style.display = "flex";
    document.getElementById("playGameP2").style.display = "flex";  
    
    GameLoop();
}

async function GameLoop() {
    while(true) {
        SetInfo();
        if(host){
            ClearPlayerAnswers();
            ClearFinishRound();
        }
        await Countdown(15);

        await sendFinishedRound();
        
        await BothPlayersFinishRound();

        await GetPlayerAnswers();
        UpdateAnswerDisplay();

        if(host) {
            ClearPlayerReady();
        }else{
            players.ready[0] = false;
            players.ready[1] = false;
        }
        await new Promise(r => setTimeout(r, 3000));

        round++;
        UpdateScoreDisplay();
        


        await BothPlayersReadyForNextRound();
        
        document.getElementById("p2Result").style.display = "none";
        document.getElementById("empty").style.display = "flex";
        document.getElementById("p1Box").style.display = "flex";
        document.getElementById("p1Result").style.display = "none";

        players.answers[0] = "";
        players.answers[1] = "";

        await new Promise(r => setTimeout(r, 1000));
    }
}

function SetInfo(){
    //category
    document.getElementById("category").innerHTML = questions[round].category;
    //question
    document.getElementById("question").innerHTML = questions[round].question;
    //answers
    let answers = questions[round].incorrect_answers;
    answers.push(questions[round].correct_answer);
    answers.sort(() => Math.random() - 0.5);
    document.getElementById("a1Text").innerHTML = answers[0];
    document.getElementById("a2Text").innerHTML = answers[1];
    document.getElementById("a3Text").innerHTML = answers[2];
    document.getElementById("a4Text").innerHTML = answers[3];

    let radios = document.getElementsByName("answer");
    console.log(radios);
    for(let i = 0; i < radios.length; i++){
        radios[i].checked = false;
        radios[i].disabled = false;
    }
}
async function BothPlayersReadyForNextRound() {
    let d = new Date();
    let ms = d.getMilliseconds();
    await new Promise(r => setTimeout(r, 1000 - ms));
    
    while(true) {
        await new Promise(r => setTimeout(r, 1000));

        const response = await fetch('/playersReadyForNextRound', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({lobbyCode: lobbyCode})
        });

        let data = await response.json();

        if(data.code == 1) break;
    }
}
async function GetPlayerAnswers() {
    const response = await fetch('/getAnswers', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({lobbyCode: lobbyCode})
    });

    const data = await response.json();

    if(data.code != 1) {
        console.log("Error getting answers");
        await new Promise(r => setTimeout(r, 100));
        GetPlayerAnswers();
    }else{
        players.answers[0] = data.answers[0];
        players.answers[1] = data.answers[1];
    }
}

function UpdateAnswerDisplay() {
    document.getElementById("p1Box").style.display = "none";
    document.getElementById("p1Result").style.display = "flex";
    document.getElementById("p1ResultTextAnswer").innerHTML = questions[round].correct_answer;

    console.log(players.answers[host?0:1]);
    console.log(questions[round].correct_answer);
    if(players.answers[host?0:1] == "") {
        document.getElementById("p1ResultText").innerHTML = "No answer";
        document.getElementById("p1ResultText").style.color = "red";
    }else{
        document.getElementById("p1ResultText").innerHTML = players.answers[host?0:1].toLowerCase() == questions[round].correct_answer.toLowerCase() ? "Correct!" : "Incorrect!";
        document.getElementById("p1ResultText").style.color = document.getElementById("p1ResultText").innerHTML == "Correct!" ? "green" : "red";
        players.scores[host?0:1] += document.getElementById("p1ResultText").innerHTML == "Correct!" ? 1 : 0;
        if(host) AddPointToPlayer(host?0:1);
    }

    document.getElementById("p2Result").style.display = "flex";
    document.getElementById("empty").style.display = "none";

    if(players.answers[host?1:0] == "") {
        document.getElementById("p2ResultText").innerHTML = "No answer";
        document.getElementById("p2ResultText").style.color = "red";
    }else{
        document.getElementById("p2ResultText").innerHTML = players.answers[host?1:0].toLowerCase() == questions[round].correct_answer.toLowerCase() ? "Correct!" : "Incorrect!";
        document.getElementById("p2ResultText").style.color = document.getElementById("p2ResultText").innerHTML == "Correct!" ? "green" : "red";
        players.scores[host?1:0] += document.getElementById("p2ResultText").innerHTML == "Correct!" ? 1 : 0;
        if(host) AddPointToPlayer(host?1:0);
    }  
}

async function AddPointToPlayer(shost) {
    const response = await fetch('/addPoint', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({lobbyCode: lobbyCode, host: shost})
    });

    const data = await response.json();

    if(data.code != 1) {
        console.log("Error adding point");
        await new Promise(r => setTimeout(r, 100));
        AddPointToPlayer(host);
    }   

}
    
async function BothPlayersFinishRound() {
    //wait for both players to finish
    let failedcheck = 0;
    while(failedcheck < 15){
        await new Promise(r => setTimeout(r, 500));
        
        const response = await fetch('/getFinishRound', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({lobbyCode: lobbyCode})
        });

        let data = await response.json();

        if(data.code == 1) {
            break;
        }else{
            failedcheck++;
        }
    }

    return true;
}

async function Countdown(startTime){
    let timer = startTime;
    while(timer >= 0) {
        document.getElementById("countDown").innerHTML = timer;
        // document.getElementById("timer").innerHTML = timer;
        await new Promise(r => setTimeout(r, 1000));
        timer--;
    }

    return true;
}

async function sendFinishedRound() {
    //send finished round
    const data = await fetch('/finishRound', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({lobbyCode: lobbyCode, host: host})
    });

    const response = await data.json();

    if(response.code != 1) {
        console.log("Error finishing round " + response);
        await new Promise(r => setTimeout(r, 100));
        sendFinishedRound();
    }
}

async function ClearFinishRound() {
    const data = await fetch('/clearFinishRound', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({lobbyCode: lobbyCode})
    });

    const response = await data.json();

    if(response.code != 1) {
        console.log("Error clearing finish round");
        await new Promise(r => setTimeout(r, 100));
        ClearFinishRound();
    }
}

async function UpdateScoreDisplay() {
    const response = await fetch('/getScore', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({lobbyCode: lobbyCode})
    });

    const data = await response.json();
    
    players.scores[0] = data.scores[0];
    players.scores[1] = data.scores[1];

    document.getElementById("p1Score").innerHTML = players.scores[host?0:1] + '/' + round;
    document.getElementById("p2Score").innerHTML = players.scores[host?1:0] + '/' + round;
}
async function ClearPlayerAnswers() {
    currentChoice = "";
    const response = await fetch('/clearAnswers', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({lobbyCode: lobbyCode})
    });

    const data = await response.json();

    if(data.code != 1) {
        console.log("Error clearing answers");
        await new Promise(r => setTimeout(r, 100));
        ClearPlayerAnswers();
    }
}

async function ClearPlayerReady() {
    players.ready[0] = false;
    players.ready[1] = false;

    const response = await fetch('/clearReady', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({lobbyCode: lobbyCode})
    });

    const data = await response.json();

    if(data.code != 1) {
        console.log("Error clearing ready");
        await new Promise(r => setTimeout(r, 100));
        ClearPlayerReady();
    }
}

async function submitAnswer() {
    if(players.answers[host?0:1] != "") return;
    //get which radio button is checked
    let answer = currentChoice;
    if(answer == undefined || answer == "") {
        //turn red
        document.getElementById("submiter").style.backgroundColor = "red";
        return;
    }

    players.answers[host?0:1] = answer;
    document.getElementById("submiter").style.backgroundColor = "#EECEB9";
    
    //disable radio buttons
    let radios = document.getElementsByName("answer");
    for(let i = 0; i < radios.length; i++){
        radios[i].disabled = true;
    }

    while (true){
        const response = await fetch('/submitAnswer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({lobbyCode: lobbyCode, answer: answer, host: host})
        });

        await response.json();

        if(response.code == 1) break;
        await new Promise(r => setTimeout(r, 500));
    }
}

function clearRed(element){
    element.style.backgroundColor = "white";
}
async function connectToLobby(){
    lobbyCode = document.getElementById("joinLobbyId").value;
    players.names[1] = document.getElementById("playerNamejoin").value;
    if (lobbyCode.length == 0) {
        alert("Please enter a lobby code.");
        return null;
    }

    document.getElementById("loading").style.display = "block";
    document.getElementById("menu").style.display = "none";
    await new Promise(r => setTimeout(r, 1000));

    
    const response = await fetch('/joinLobby', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({lobbyCode: lobbyCode, name: players.names[1]})
    });
    const data = await response.json();
    
    if(data.code == 1) {
        return data;
    }else{
        alert(data.code == 2 ? "Lobby is full." : data.code == 3 ? "Lobby not found" : "Error joining lobby.");
        document.getElementById("loading").style.display = "none";
        document.getElementById("menu").style.display = "flex";
    }

    return null;
}


async function ReadyUp(){
    const response = await fetch('readyUp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({lobbyCode: lobbyCode, playersReady: players.ready, host: host})
    });

    let data = await response.json();

    if(data.code == 1) {
        players.ready[host?0:1] = true;
        document.getElementById("p1Waiting").style.display = "block";
        document.getElementById("p1RU").style.display = "none";
    }
}

function joinLobbyMenu() {
    document.getElementById("firstMenu").style.display = "none";
    document.getElementById("joinLobbyMenu").style.display = "block";
}

function createLobbyMenu() {
    document.getElementById("firstMenu").style.display = "none";
    document.getElementById("createLobbyMenu").style.display = "block";
}

function backToMenu() {
    document.getElementById("joinLobbyMenu").style.display = "none";
    document.getElementById("createLobbyMenu").style.display = "none";
    document.getElementById("firstMenu").style.display = "block";
}


function SetCurrentChoice(choice){
    currentChoice = choice.parentElement.querySelector("label").innerHTML;
}