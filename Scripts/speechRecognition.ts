namespace Prototyp {
    //speech recognition versuch 
    // var SpeechRecognition: any = SpeechRecognition;
    //var SpeechGrammarList: any = SpeechGrammarList;
    //var SpeechRecognitionEvent: Event = SpeechRecognitionEvent;
    var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition;
    var SpeechGrammarList = SpeechGrammarList || webkitSpeechGrammarList;
    var SpeechRecognitionEvent = SpeechRecognitionEvent || webkitSpeechRecognitionEvent;


    // let actions: String[] = ["ja", "nein", "rechts", "links", "interagieren", "Inventar", "Aktion", "verlassen", "schließen"];
    // let grammar: String = "#JSGF V1.0; grammar actions; public <color> = " + actions.join(" | ") + " ;";

    var recognition = new SpeechRecognition();

    // var speechRecognitionList = new SpeechGrammarList();
    // speechRecognitionList.addFromString(grammar, 1);
    // recognition.grammars = speechRecognitionList;
    recognition.continuous = false;
    recognition.lang = "de-DE";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    var diagnostic: Element = document.querySelector(".output");
    var bg = document.querySelector("html");
    var hints = document.querySelector(".hints");
    //let spButton: HTMLButtonElement = <HTMLButtonElement>document.querySelector(".sprachActivate");
    //var colorHTML = ""
    //console.log(spButton);
    //spButton.addEventListener("click", starting);

    /*   document.body.onclick = function () {
      recognition.start();
     }; */
    function starting(ev: Event): void {
        console.log("hallo");
        recognition.start();
    }
    recognition.onresult = function (event) {
        let input: string = event.results[0][0].transcript;
        diagnostic.textContent = "Erhaltenes Wort: " + input + ".";
        console.log("Erhaltenes Wort: ", input);
        let output: string = "";
        if (input == "links") {
            output = "left";
        }
        else if (input == "rechts") {
            output = "right";
        }
        else {
            switch (gameInstance.gameState) {
                case GAME_STATE.PLAYING:
                    if (input == "interagieren" || input == "Aktion") {
                        output = "up";
                    }
                    if (input == "Inventar") {
                        output = "down";
                    }
                    if (input == "anwenden" || input == "benutzen" || input == "verwenden"){
                        output = "doubletap";
                    }
                    break;
                case GAME_STATE.INVENTORY:
                    if (input == "schließen" || input == "verlassen") {
                        output = "up";
                    } else if( input == "Equip" || input == "auswählen" || input == "nehmen" || input == "benutzen") {
                        output = "doubletap";
                    }
                    else {
                        output = input;
                    }
            }
        }
        onAction(output);
    };

    recognition.onspeechend = function () {
        recognition.stop();
        /* setTimeout(function () {
            recognition.start();
        },2000); */
    };
    recognition.onnomatch = function (event) {
        diagnostic.textContent = "ich habe das Wort nicht verstanden";
    };
    recognition.onerror = function (event) {

        diagnostic.textContent = "error" + event.error;

    };
}