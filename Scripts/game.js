"use strict";
var Prototyp;
(function (Prototyp) {
    let GAME_STATE;
    (function (GAME_STATE) {
        GAME_STATE[GAME_STATE["PLAYING"] = 0] = "PLAYING";
        GAME_STATE[GAME_STATE["INVENTORY"] = 1] = "INVENTORY";
        GAME_STATE[GAME_STATE["CONTAINER"] = 2] = "CONTAINER";
        GAME_STATE[GAME_STATE["SEARCHING"] = 3] = "SEARCHING";
        GAME_STATE[GAME_STATE["SHOVE"] = 4] = "SHOVE";
        GAME_STATE[GAME_STATE["MENU"] = 5] = "MENU";
    })(GAME_STATE = Prototyp.GAME_STATE || (Prototyp.GAME_STATE = {}));
    // ------ Audio Api Variables -----//
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    let audioBufferMap = new Map();
    let audioSourceMap = new Map();
    let atmoLPFilter = audioContext.createBiquadFilter();
    let currentlyPlayingSound = "";
    atmoLPFilter.frequency.setValueAtTime(20000, 0);
    atmoLPFilter.type = "lowpass";
    async function loadSound(_url) {
        if (audioBufferMap.get(_url) == null) {
            if (_url.includes(".mp3")) {
                let response = await fetch(_url);
                let arraybuffer = await response.arrayBuffer();
                let audioBuffer = await audioContext.decodeAudioData(arraybuffer);
                audioBufferMap.set(_url, audioBuffer);
            }
        }
    }
    function playSound(_url, _loop = false, _duration = 0) {
        let source = audioContext.createBufferSource();
        source.buffer = audioBufferMap.get(_url);
        source.connect(audioContext.destination);
        source.loop = _loop;
        source.start(_duration);
        audioSourceMap.set(_url, source);
    }
    function stopSound(_url) {
        audioSourceMap.get(_url).stop();
        audioSourceMap.delete(_url);
    }
    function addFilter(_url, _filter) {
        let tempsource = audioSourceMap.get(_url);
        tempsource.disconnect();
        tempsource.connect(_filter);
        _filter.connect(audioContext.destination);
    }
    let thingDescriberText = "";
    let hasFoundSpoken = false;
    class Game {
        constructor() {
            this.gameState = GAME_STATE.MENU;
            this.gameProgress = 0;
            this.roomMap = new Map();
            this.locationMap = new Map();
            this.characterMap = new Map();
            this.firstEverFocusedSlot = 0;
            this.maxSlots = 8;
        }
        toJSON() {
            let roomKeys = [];
            let characterKeys = [];
            let iterator = 0;
            for (let [key, value] of this.roomMap) {
                roomKeys[iterator] = key;
                iterator++;
            }
            iterator = 0;
            for (let [key, value] of this.characterMap) {
                characterKeys[iterator] = key;
                iterator++;
            }
            iterator = 0;
            return {
                gameState: this.gameState,
                gameProgress: this.gameProgress,
                currentRoom: this.currentRoom.roomID,
                currentCharacter: this.currentCharacter.characterID,
                rooms: roomKeys,
                characters: characterKeys,
                firstEverFocusedSlot: this.firstEverFocusedSlot,
                saved: true //value if the json was saved to localstorage before or not
            };
        }
    }
    Prototyp.gameInstance = new Game();
    class Item {
        constructor(_itemID, _name, _unlocked = true, _usages, _itemSound) {
            this.itemID = _itemID;
            this.name = _name;
            this.unlocked = _unlocked;
            this.usages = _usages;
            this.itemSound = _itemSound;
        }
    }
    class Inventory {
        constructor(_inventoryID, _items) {
            this.focusedItemIndex = 0;
            this.inventoryID = _inventoryID;
            this.items = _items;
        }
        static fromJson(_json) {
            let items1 = [];
            for (let i = 0; i < _json.items.length; i++) {
                items1[i] = new Item(_json.items[i].itemID, _json.items[i].name, _json.items[i].unlocked, _json.items[i].usages, _json.items[i].itemSound);
            }
            let inventory = new Inventory(_json.inventoryID, items1);
            return inventory;
        }
        nextItemLeft() {
            if (this.focusedItemIndex > 0) {
                this.focusedItemIndex--;
            }
            else {
                this.focusedItemIndex = this.items.length - 1;
            }
        }
        nextItemRight() {
            if (this.focusedItemIndex < this.items.length - 1) {
                this.focusedItemIndex++;
            }
            else {
                this.focusedItemIndex = 0;
            }
        }
        getFocusedItem() {
            return this.items[this.focusedItemIndex];
        }
        isEmpty() {
            if (this.items.length == 0) {
                return true;
            }
            return false;
        }
        removeItem(item) {
            for (let i = 0; i < this.items.length; i++) {
                if (this.items[i].itemID == item) {
                    this.items.splice(i, 1);
                    return;
                }
            }
            ;
        }
    }
    class PlayableCharacter {
        constructor(_characterID, _inventory, _path, _inventoryOpenSound, _inventoryCloseSound, _inventoryEmptySound, _combinationNotPossibleSound, _interactionNotPossibleSound, _containerEmptySound, _soundArrayIndex, _equipedItem = undefined) {
            this.characterID = _characterID;
            this.inventory = _inventory;
            this.path = _path;
            this.inventoryOpenSound = _inventoryOpenSound;
            this.inventoryCloseSound = _inventoryCloseSound;
            this.inventoryEmptySound = _inventoryEmptySound;
            this.combinationNotPossibleSound = _combinationNotPossibleSound;
            this.interactionNotPossibleSound = _interactionNotPossibleSound;
            this.containerEmptySound = _containerEmptySound;
            this.soundArrayIndex = _soundArrayIndex;
            this.equippedItem = _equipedItem;
        }
        static fromJson(_json) {
            let inventory = Inventory.fromJson(_json.inventory);
            let eItem = undefined;
            if (_json.equippedItem != undefined) { ///----------------------
                eItem = new Item(_json.equippedItem.itemID, _json.equippedItem.name, _json.equippedItem.unlocked, _json.equippedItem.usages, _json.equippedItem.itemSound);
            }
            let character = new PlayableCharacter(_json.characterID, inventory, _json.path, _json.inventoryOpenSound, _json.inventoryCloseSound, _json.inventoryEmptySound, _json.combinationNotPossibleSound, _json.interactionNotPossibleSound, _json.containerEmptySound, _json.soundArrayIndex, eItem);
            return character;
        }
    }
    class Interactable {
        constructor(_slotID, _name, _accessCharacter, _interactSound = [], _facingSound = [], _discoverSound = [], _usages = [], _state = 0, _alreadySeen = false, _isVisible = true) {
            this.slotID = _slotID;
            this.name = _name;
            this.accessCharacter = _accessCharacter;
            this.interactSound = _interactSound;
            this.facingSound = _facingSound;
            this.discoverSound = _discoverSound;
            this.usages = _usages;
            this.state = _state;
            this.alreadySeen = _alreadySeen;
            this.isVisible = _isVisible;
        }
        interact() {
            if (this.accessCharacter != undefined) {
                if (this.accessCharacter == Prototyp.gameInstance.currentCharacter.characterID) {
                    if (this.usages[this.state] != undefined) {
                        if (this.usages[this.state].effect == "open_and_increment") {
                            speak(this.usages[this.state].filepath);
                            onUsage(this.usages[this.state]);
                            //Switch to playsound() later
                            return;
                        }
                        speak(this.usages[this.state].filepath);
                        onUsage(this.usages[this.state]);
                        return;
                    }
                }
            }
            if (this.interactSound.length > 0) {
                if (this.interactSound.length == 1) {
                    speak(this.interactSound[0]);
                    return;
                }
                speak(this.interactSound[Prototyp.gameInstance.currentCharacter.soundArrayIndex]);
                return;
            }
            let speechString = "ich interagiere mit " + this.name;
            speak(speechString);
        }
        useItem(itemToUse) {
            let currUsages = itemToUse.usages;
            for (let i = 0; i < currUsages.length; i++) {
                if (currUsages[i].targetSlotID == this.slotID) {
                    // usage effect method()
                    onUsage(currUsages[i]);
                    return currUsages[i].filepath;
                }
            }
            if (Prototyp.gameInstance.currentCharacter.interactionNotPossibleSound) {
                speak(Prototyp.gameInstance.currentCharacter.interactionNotPossibleSound);
                return "";
            }
            else {
                return "das kann ich hier nicht benutzen";
            }
        }
        toJSON() {
            return {
                type: this.constructor.name,
                ...this
            };
        }
    }
    class SearchHint {
        constructor(_hintID, _positionX, _positionY, _hint) {
            this.hintID = _hintID;
            this.positionX = _positionX;
            this.positionY = _positionY;
            this.hint = _hint;
        }
    }
    class SearchField {
        constructor(_fieldID, _hints, _correctHint) {
            this.fieldID = _fieldID;
            this.hints = _hints;
            this.correctHint = _correctHint;
        }
    }
    class Usage {
        constructor(_usageID, _filepath, _targetSlotID, _effect, _effectTargetID, _destroyAfterUse = false, _targetState = undefined) {
            this.usageID = _usageID;
            this.filepath = _filepath;
            this.targetSlotID = _targetSlotID;
            this.effect = _effect;
            this.effectTargetID = _effectTargetID;
            this.destroyAfterUse = _destroyAfterUse;
            this.targetState = _targetState;
        }
    }
    function findUsageSlot(_effectSlotID) {
        for (let room of Prototyp.gameInstance.roomMap) {
            // --> if in case of alot of rooms, specify name of room for efficiency
            for (let i = 0; i < room[1].slots.length; i++) {
                if (room[1].slots[i] != null) {
                    if (room[1].slots[i].slotID == _effectSlotID) {
                        return room[1].slots[i];
                    }
                }
            }
        }
        return null;
    }
    function onUsage(_usage) {
        if (_usage.effect != null) {
            let foundSlot = findUsageSlot(_usage.effectTargetID);
            switch (_usage.effect) {
                case "setVisible":
                    if (!foundSlot.isVisible) {
                        foundSlot.isVisible = true;
                    }
                    break;
                case "setInvisible":
                    if (foundSlot.isVisible) {
                        foundSlot.isVisible = false;
                    }
                    break;
                case "open":
                    let openSlot = foundSlot;
                    openSlot.isOpen = true;
                    break;
                case "increment_state":
                    foundSlot.state++;
                    break;
                case "increment_both":
                    foundSlot.state++;
                    let incr_target1 = findUsageSlot(_usage.targetSlotID);
                    incr_target1.state++;
                    break;
                case "open_and_increment":
                    let openEffectTarget = foundSlot;
                    openEffectTarget.isOpen = true;
                    // targetslot vs effectTargetslot // bezeichnung klären 
                    let incr_target2 = findUsageSlot(_usage.targetSlotID);
                    incr_target2.state++;
                    break;
                case "give_item":
                    Prototyp.gameInstance.currentCharacter.inventory.items.unshift(Prototyp.gameInstance.obtainableItemMap.get(_usage.effectTargetID));
                    let incr_target3 = findUsageSlot(_usage.targetSlotID);
                    incr_target3.state++;
                    // item löschen? muss state incrementiert werden?
                    break;
                case "search":
                    Prototyp.gameInstance.currentSearchField = Prototyp.gameInstance.searchFieldMap.get(_usage.effectTargetID);
                    Prototyp.gameInstance.gameState = GAME_STATE.SEARCHING;
                    atmoLPFilter.frequency.setValueAtTime(320, audioContext.currentTime + 0.2);
                    speak("Fahre mit dem Finger über den Bildschirm um zu suchen.");
                    break;
                case "shove":
                    speak("Fahre langsam mit dem Finger nach oben um zu schieben.");
                    Prototyp.gameInstance.gameState = GAME_STATE.SHOVE;
                    atmoLPFilter.frequency.setValueAtTime(320, audioContext.currentTime + 0.2);
                    break;
            }
            if (_usage.destroyAfterUse) {
                let itemString = Prototyp.gameInstance.currentCharacter.equippedItem.itemID;
                Prototyp.gameInstance.currentCharacter.inventory.removeItem(itemString);
            }
        }
    }
    class Openable {
    }
    class Portal extends Interactable {
        constructor(_slotID, _name, _accessCharacter, _enteringRoomID, _facingSlotInOppositeRoom, _closedSound, _interactSound = [], _isOpen, _facingSound = [], _discoverSound = [], _state = 0, _alreadyseen = false, _isVisible = true) {
            super(_slotID, _name, _accessCharacter, _interactSound, _facingSound, _discoverSound, null, _state, _alreadyseen, _isVisible);
            this.enteringRoomID = _enteringRoomID;
            this.facingSlotInOppositeRoom = _facingSlotInOppositeRoom;
            this.closedSound = _closedSound;
            this.isOpen = _isOpen;
        }
        interact() {
            if (!this.isOpen) {
                if (this.closedSound != undefined) {
                    if (this.closedSound.length == 0) {
                        speak("das ist verschlossen");
                        return;
                    }
                    if (this.interactSound.length == 1) {
                        playSound(this.closedSound[0]);
                        return;
                    }
                    playSound(this.closedSound[Prototyp.gameInstance.currentCharacter.soundArrayIndex]);
                    return;
                }
                speak("das ist verschlossen");
                return;
            }
            if (audioSourceMap.get(Prototyp.gameInstance.currentRoom.atmoSound) != undefined) {
                stopSound(Prototyp.gameInstance.currentRoom.atmoSound);
            }
            playSound(this.interactSound[0]);
            Prototyp.gameInstance.currentRoom = Prototyp.gameInstance.roomMap.get(this.enteringRoomID);
            Prototyp.gameInstance.currentRoom.focusedSlotIndex = this.facingSlotInOppositeRoom;
            let audio = audioBufferMap.get(this.interactSound[0]);
            setTimeout(function () {
                playSound(Prototyp.gameInstance.currentRoom.atmoSound, true);
                addFilter(Prototyp.gameInstance.currentRoom.atmoSound, atmoLPFilter);
            }, audio.duration * 700);
            if (Prototyp.gameInstance.currentRoom.getFocusedSlot().facingSound.length != 0) {
                speakDiscover(Prototyp.gameInstance.currentRoom.getFocusedSlot());
                return;
            }
        }
        toJSON() {
            return {
                type: this.constructor.name,
                ...this,
                isOpen: this.isOpen + ""
            };
        }
    }
    function sleep(milliseconds) {
        const date = Date.now();
        let currentDate = null;
        do {
            currentDate = Date.now();
        } while (currentDate - date < milliseconds);
    }
    class Alter extends Interactable {
        constructor(_slotID, _name, _accessCharacter, _newLocationID, _newCharacterID, _interactSound = [], _facingSound = [], _discoverSound = [], _usages = [], _state = 0, _alreadyseen = false, _isVisible = true) {
            super(_slotID, _name, _accessCharacter, _interactSound, _facingSound, _discoverSound, _usages, _state, _alreadyseen, _isVisible);
            this.newLocationID = _newLocationID;
            this.newCharacterID = _newCharacterID;
        }
        interact() {
            if (this.usages[this.state] != undefined) {
                speak(this.usages[this.state].filepath);
                onUsage(this.usages[this.state]);
                //sleep(audioBufferMap.get())
                sleep(audioBufferMap.get(this.usages[this.state - 1].filepath).duration * 1000);
            }
            let location = Prototyp.gameInstance.locationMap.get(this.newLocationID);
            let character = Prototyp.gameInstance.characterMap.get(this.newCharacterID);
            let newRoom = Prototyp.gameInstance.roomMap.get(location.firstRoom);
            stopSound(Prototyp.gameInstance.currentRoom.atmoSound);
            Prototyp.gameInstance.currentRoom = newRoom;
            playSound(location.arrivingSound);
            playSound(Prototyp.gameInstance.currentRoom.atmoSound, true);
            Prototyp.gameInstance.currentCharacter = Prototyp.gameInstance.characterMap.get(character.characterID);
            thingDescriberText = newRoom.slots[Prototyp.gameInstance.currentRoom.focusedSlotIndex].name;
            // !! attention temporary code --> sleep, will be replaced  later (when voicelines are replaced by audio files)
            sleep(audioBufferMap.get(location.arrivingSound).duration * 1000);
            if (this.usages[this.state] != undefined) {
                playSound(this.usages[this.state].filepath);
                sleep(audioBufferMap.get(this.usages[this.state].filepath).duration * 1000);
                // achtung dieses hier sollte wahrscheinlich danach wieder gelöscht werden
                speakDiscover(Prototyp.gameInstance.currentRoom.getFocusedSlot());
                this.state = 0;
                return "";
            }
            else {
                return "Ich befinde mich nun in " + location.name + " in " + location.firstRoom + " und habe eine neue Stimme.";
            }
        }
    }
    class Pickupable extends Interactable {
        constructor(_slotID, _name, _accessCharacter, _closedSound, _usages, _interactSound = [], _isOpen = true, _facingSound = [], _discoverSound = [], _alreadyseen = false, _isVisible = true, _itemSound) {
            super(_slotID, _name, _accessCharacter, _interactSound, _facingSound, _discoverSound, null, 0, _alreadyseen, _isVisible);
            this.usages = [];
            this.closedSound = _closedSound;
            this.usages = _usages;
            this.isOpen = _isOpen;
            this.itemSound = _itemSound;
        }
        interact() {
            if (!this.isOpen) {
                if (this.closedSound != undefined) {
                    if (this.closedSound.length == 0) {
                        return "das ist verschlossen";
                    }
                    if (this.interactSound.length == 1) {
                        speak(this.closedSound[0]);
                        return "";
                    }
                    speak(this.closedSound[Prototyp.gameInstance.currentCharacter.soundArrayIndex]);
                    return "";
                }
                return "ich kann dies nicht aufheben";
            }
            if (this.accessCharacter != undefined) {
                if (this.accessCharacter == Prototyp.gameInstance.currentCharacter.characterID) {
                    let item = new Item(this.slotID, this.name, this.isOpen, this.usages, this.itemSound);
                    Prototyp.gameInstance.currentCharacter.inventory.items.unshift(item);
                    if (Prototyp.gameInstance.gameState != GAME_STATE.CONTAINER) {
                        Prototyp.gameInstance.currentRoom.slots[Prototyp.gameInstance.currentRoom.focusedSlotIndex];
                        Prototyp.gameInstance.currentRoom.nextSlotRight();
                    }
                    else {
                        let container = Prototyp.gameInstance.currentRoom.slots[Prototyp.gameInstance.currentRoom.focusedSlotIndex];
                        if (container.containerItems.length > 0) {
                            container.containerItems.splice(container.focusedItemIndex, 1);
                            if (container.containerItems.length == 0) {
                                speak(container.name + " ist leer");
                                Prototyp.gameInstance.gameState = GAME_STATE.PLAYING;
                                return "";
                            }
                            container.nextItemRight();
                            if (container.getFocusedItem().facingSound.length > 0) {
                                speakDiscover(container.getFocusedItem());
                            }
                            else {
                                speak(container.getFocusedItem().name);
                            }
                            return "";
                        }
                        else {
                            if (Prototyp.gameInstance.currentCharacter.containerEmptySound) {
                                speak(Prototyp.gameInstance.currentCharacter.containerEmptySound);
                            }
                            else {
                                speak("dieser container ist jetz leer");
                            }
                            return "";
                        }
                    }
                    speak("ich habe" + item.itemID + " aufgesammelt");
                    return "ich habe" + item.itemID + " aufgesammelt";
                }
                if (this.interactSound != undefined) {
                    if (this.interactSound.length == 0) {
                        return "ich kann das als char nicht aufheben";
                    }
                    if (this.interactSound.length == 1) {
                        playSound(this.interactSound[0]);
                        return "";
                    }
                    playSound(this.interactSound[Prototyp.gameInstance.currentCharacter.soundArrayIndex]);
                }
                return "";
            }
            let item = new Item(this.slotID, this.name, this.isOpen, this.usages, this.itemSound);
            Prototyp.gameInstance.currentCharacter.inventory.items.unshift(item);
            Prototyp.gameInstance.currentRoom.slots[Prototyp.gameInstance.currentRoom.focusedSlotIndex] = undefined;
            // error wegen automatisch nextSlotRight//thingdescriber
            Prototyp.gameInstance.currentRoom.nextSlotRight();
            //speak wird nicht ausgeführt
            speak("ich habe" + item.itemID + " aufgesammelt");
            // TODO character spricht / sound das etwas aufgesammelt worden ist
            return "ich habe" + item.itemID + " aufgesammelt";
        }
    }
    class Container extends Interactable {
        constructor(_slotID, _name, _accessCharacter, _containerItems, _focusedItemIndex = 0, _usages, _state = 0, _closedSound, _interactSound = [], _isOpen, _facingSound = [], _discoverSound = [], _alreadyseen = false, _isVisible = true) {
            super(_slotID, _name, _accessCharacter, _interactSound, _facingSound, _discoverSound, _usages, _state, _alreadyseen, _isVisible);
            this.focusedItemIndex = 0;
            this.closedSound = _closedSound;
            this.containerItems = _containerItems;
            this.focusedItemIndex = _focusedItemIndex;
            this.isOpen = _isOpen;
        }
        interact() {
            if (this.isOpen) {
                if (this.containerItems.length == 0) {
                    if (Prototyp.gameInstance.currentCharacter.containerEmptySound) {
                        speak(Prototyp.gameInstance.currentCharacter.containerEmptySound);
                        return "";
                    }
                    else {
                        speak("dieser container ist leer");
                        return "";
                    }
                }
                let currentItemName = this.containerItems[this.focusedItemIndex].name;
                thingDescriberText = currentItemName;
                Prototyp.gameInstance.gameState = GAME_STATE.CONTAINER;
                if (this.getFocusedItem().facingSound.length != 0) {
                    speakDiscover(this.getFocusedItem());
                }
                else {
                    speak(currentItemName);
                }
                return "container open sound " + currentItemName;
            }
            if (this.closedSound != undefined) {
                if (this.closedSound.length == 0) {
                }
                else if (this.interactSound.length == 1) {
                    playSound(this.closedSound[0]);
                }
                else {
                    playSound(this.closedSound[Prototyp.gameInstance.currentCharacter.soundArrayIndex]);
                }
            }
            if (this.usages) {
                if (this.usages.length != 0) {
                    if (this.usages[this.state] != undefined) {
                        if (this.usages[this.state].effect == "open_and_increment") {
                            speak(this.usages[this.state].filepath);
                            onUsage(this.usages[this.state]);
                            return "";
                        }
                        speak(this.usages[this.state].filepath);
                        onUsage(this.usages[this.state]);
                        return "";
                    }
                }
            }
            return "das ist verschlossen";
        }
        nextItemLeft() {
            if (this.focusedItemIndex > 0) {
                this.focusedItemIndex--;
            }
            else {
                this.focusedItemIndex = this.containerItems.length - 1;
            }
            if (this.getFocusedItem().facingSound.length > 0) {
                speakDiscover(this.getFocusedItem());
            }
            else {
                speak(this.getFocusedItem().name);
            }
        }
        nextItemRight() {
            if (this.focusedItemIndex < this.containerItems.length - 1) {
                this.focusedItemIndex++;
            }
            else {
                this.focusedItemIndex = 0;
            }
            if (this.getFocusedItem().facingSound.length > 0) {
                speakDiscover(this.getFocusedItem());
            }
            else {
                speak(this.getFocusedItem().name);
            }
        }
        getFocusedItem() {
            return this.containerItems[this.focusedItemIndex];
        }
    }
    class Room {
        constructor(_RoomID, _name, _slots, _path, _atmoSound, _focusedSlotIndex = 0) {
            if (_slots.length != Prototyp.gameInstance.maxSlots) {
            }
            else {
                this.roomID = _RoomID;
                this.name = _name;
                this.slots = _slots;
                this.focusedSlotIndex = _focusedSlotIndex;
                this.path = _path;
                this.atmoSound = _atmoSound;
            }
        }
        static fromJSON(_json) {
            let slots = [];
            let currentSlot = undefined;
            for (let i = 0; i < Prototyp.gameInstance.maxSlots; i++) {
                currentSlot = _json.slots[i];
                if (currentSlot == undefined) {
                    slots[i] = undefined;
                }
                else {
                    switch (currentSlot.type) { //-- Slot/Item/Thintype is differentiated here
                        case "Interactable":
                            slots[i] = new Interactable(currentSlot.slotID, currentSlot.name, currentSlot.accessCharacter, currentSlot.interactSound, currentSlot.facingSound, currentSlot.discoverSound, currentSlot.usages, currentSlot.state, currentSlot.alreadySeen, currentSlot.isVisible);
                            break;
                        case "Portal":
                            slots[i] = new Portal(currentSlot.slotID, currentSlot.name, currentSlot.accessCharacter, currentSlot.enteringRoomID, currentSlot.facingSlotInOppositeRoom, currentSlot.closedSound, currentSlot.interactSound, currentSlot.isOpen, currentSlot.facingSound, currentSlot.discoverSound, currentSlot.state, currentSlot.alreadySeen, currentSlot.isVisible);
                            //loadSound(currentSlot.interactSound); //as long as we only have door sounds we load them here, so that nothing undefined tries to load 
                            break;
                        case "Pickupable":
                            slots[i] = new Pickupable(currentSlot.slotID, currentSlot.name, currentSlot.accessCharacter, currentSlot.closedSound, currentSlot.usages, currentSlot.interactSound, currentSlot.isOpen, currentSlot.facingSound, currentSlot.discoverSound, currentSlot.alreadySeen, currentSlot.isVisible, currentSlot.itemSound);
                            break;
                        case "Container":
                            let pickupables = [];
                            for (let c = 0; c < currentSlot.containerItems.length; c++) {
                                let tempP = new Pickupable(currentSlot.containerItems[c].slotID, currentSlot.containerItems[c].name, currentSlot.containerItems[c].accessCharacter, currentSlot.containerItems[c].closedSound, currentSlot.containerItems[c].usages, currentSlot.containerItems[c].interactSound, currentSlot.containerItems[c].isOpen, currentSlot.containerItems[c].facingSound, currentSlot.containerItems[c].discoverSound, currentSlot.containerItems[c].alreadySeen, currentSlot.containerItems[c].isVisible, currentSlot.containerItems[c].itemSound);
                                pickupables.unshift(tempP);
                            }
                            //let containerItems: Pickupable[] = currentSlot.containerItems;
                            slots[i] = new Container(currentSlot.slotID, currentSlot.name, currentSlot.accessCharacter, pickupables, currentSlot.focusedItemIndex, currentSlot.usages, currentSlot.state, currentSlot.closedSound, currentSlot.interactSound, currentSlot.isOpen, currentSlot.facingSound, currentSlot.discoverSound, currentSlot.alreadySeen, currentSlot.isVisible);
                            break;
                        case "Alter":
                            slots[i] = new Alter(currentSlot.slotID, currentSlot.name, currentSlot.accessCharacter, currentSlot.newLocationID, currentSlot.newCharacterID, currentSlot.interactSound, currentSlot.facingSound, currentSlot.discoverSound, currentSlot.usages, currentSlot.state, currentSlot.alreadySeen, currentSlot.isVisible);
                            break;
                    }
                }
            }
            let newRoom = new Room(_json.roomID, _json.name, slots, _json.path, _json.atmoSound, _json.focusedSlotIndex);
            return newRoom;
        }
        getFocusedSlot() {
            return this.slots[this.focusedSlotIndex];
        }
        nextSlotLeft() {
            if (this.focusedSlotIndex > 0) {
                this.focusedSlotIndex--;
            }
            else {
                this.focusedSlotIndex = Prototyp.gameInstance.maxSlots - 1;
            }
            if ((this.getFocusedSlot() == undefined) || (!this.getFocusedSlot().isVisible)) {
                this.nextSlotLeft();
            }
            else {
                speakDiscover(this.getFocusedSlot());
            }
        }
        nextSlotRight() {
            if (this.focusedSlotIndex < Prototyp.gameInstance.maxSlots - 1) {
                this.focusedSlotIndex++;
            }
            else {
                this.focusedSlotIndex = 0;
            }
            if ((this.slots[this.focusedSlotIndex] == undefined) || (!this.getFocusedSlot().isVisible)) {
                this.nextSlotRight();
            }
            else {
                speakDiscover(this.getFocusedSlot());
            }
        }
    }
    class Location {
        constructor(_locationID, _name, _firstRoom, _arrivingSound) {
            this.locationID = _locationID;
            this.firstRoom = _firstRoom;
            this.arrivingSound = _arrivingSound;
            this.name = _name;
        }
    }
    //-------------------------------------------------main Programm------------------------------------------------//
    //------------------- Loading Rooms from Json Data ----------------------------//
    function loadJsonFromLS(_key) {
        let obj = undefined;
        try {
            obj = JSON.parse(localStorage.getItem(_key));
        }
        catch (error) {
            console.log(error);
        }
        return obj;
    }
    async function loadJson(_path) {
        let response = await fetch(_path);
        let json = await response.json();
        return json;
    }
    async function loadObtainableItemMap() {
        let arrayObject = await loadJson("../Data/Game/obtainable_items.json");
        let tempItemMap = new Map();
        for (let i = 0; i < arrayObject.length; i++) {
            let item = new Item(arrayObject[i].itemID, arrayObject[i].name, arrayObject[i].unlocked, arrayObject[i].usages, arrayObject[i].itemSound);
            tempItemMap.set(item.itemID, item);
            if (item.itemSound) {
                loadSound(item.itemSound);
            }
        }
        return tempItemMap;
    }
    async function loadSearchHintMap() {
        let arrayObject = await loadJson("../Data/Game/searchhints.json");
        let tempHintMap = new Map();
        for (let i = 0; i < arrayObject.length; i++) {
            let hint = new SearchHint(arrayObject[i].hintID, arrayObject[i].positionX, arrayObject[i].positionY, arrayObject[i].hint);
            tempHintMap.set(hint.hintID, hint);
        }
        return tempHintMap;
    }
    async function loadSearchFieldMap() {
        let arrayObject = await loadJson("../Data/Game/searchfields.json");
        let tempFieldMap = new Map();
        for (let i = 0; i < arrayObject.length; i++) {
            let field = new SearchField(arrayObject[i].fieldID, arrayObject[i].hints, arrayObject[i].correctHint);
            tempFieldMap.set(field.fieldID, field);
        }
        return tempFieldMap;
    }
    async function loadLocationMap() {
        let arrayObject = await loadJson("../Data/Game/locations.json");
        let tempLocationMap = new Map();
        for (let i = 0; i < arrayObject.length; i++) {
            let loc = new Location(arrayObject[i].locationID, arrayObject[i].name, arrayObject[i].firstRoom, arrayObject[i].arrivingSound);
            tempLocationMap.set(loc.locationID, loc);
        }
        return tempLocationMap;
    }
    async function loadMapFromArray(_path) {
        let mapObject = await loadJson(_path);
        return new Map(Object.entries(mapObject));
    }
    async function loadGamefromJSON(_json) {
        console.log("loading...");
        let tempGameInstance = new Game();
        tempGameInstance.combinationsMap = await loadMapFromArray("../Data/Game/combinations.json");
        tempGameInstance.obtainableItemMap = await loadObtainableItemMap();
        tempGameInstance.searchHintMap = await loadSearchHintMap();
        tempGameInstance.searchFieldMap = await loadSearchFieldMap();
        tempGameInstance.locationMap = await loadLocationMap();
        tempGameInstance.gameProgress = _json.gameProgress;
        tempGameInstance.firstEverFocusedSlot = _json.firstEverFocusedSlot;
        tempGameInstance.gameState = GAME_STATE.MENU;
        let prgBar = document.getElementById("myBar");
        let soundCount = 14;
        let prgwidth = 0;
        let loadSpace = 100 / soundCount;
        let locations = Array.from(tempGameInstance.locationMap.values());
        for (let i = 0; i < locations.length; i++) {
            await loadSound(locations[i].arrivingSound);
            prgwidth += loadSpace;
            prgBar.style.width = prgwidth + "%";
        }
        let sounds = [];
        if (_json.saved != true) {
            for (let i = 0; i < _json.rooms.length; i++) {
                let tempRoom = Room.fromJSON(await loadJson(_json.rooms[i]));
                tempGameInstance.roomMap.set(tempRoom.roomID, tempRoom);
                await loadSound(tempRoom.atmoSound);
                prgwidth += loadSpace;
                prgBar.style.width = prgwidth + "%";
                for (let ii = 0; ii < tempRoom.slots.length; ii++) {
                    if (tempRoom.slots[ii] != undefined) {
                        if (tempRoom.slots[ii].interactSound != undefined) {
                            sounds = tempRoom.slots[ii].interactSound;
                            for (let j = 0; j < tempRoom.slots[ii].interactSound.length; j++) {
                                await loadSound(tempRoom.slots[ii].interactSound[j]);
                            }
                            prgwidth += loadSpace;
                            prgBar.style.width = prgwidth + "%";
                        }
                        let serializedSlot = tempRoom.slots[ii];
                        if (serializedSlot.closedSound != undefined) {
                            for (let j = 0; j < serializedSlot.closedSound.length; j++) {
                                await loadSound(serializedSlot.closedSound[j]);
                            }
                        }
                        if (serializedSlot.containerItems) {
                            for (let c = 0; c < serializedSlot.containerItems.length; c++) {
                                if (serializedSlot.containerItems[c].facingSound.length > 0) {
                                    for (let fc = 0; fc < serializedSlot.containerItems[c].facingSound.length; fc++) {
                                        await loadSound(serializedSlot.containerItems[c].facingSound[fc]);
                                    }
                                }
                                if (serializedSlot.containerItems[c].discoverSound.length > 0) {
                                    for (let dc = 0; dc < serializedSlot.containerItems[c].discoverSound.length; dc++) {
                                        await loadSound(serializedSlot.containerItems[c].discoverSound[dc]);
                                    }
                                }
                                if (serializedSlot.containerItems[c].itemSound) {
                                    await loadSound(serializedSlot.containerItems[c].itemSound);
                                }
                            }
                        }
                        if (serializedSlot.itemSound != undefined) {
                            await loadSound(serializedSlot.itemSound);
                        }
                        for (let j = 0; j < tempRoom.slots[ii].facingSound.length; j++) {
                            await loadSound(tempRoom.slots[ii].facingSound[j]);
                        }
                        for (let d = 0; d < tempRoom.slots[ii].discoverSound.length; d++) {
                            await loadSound(tempRoom.slots[ii].discoverSound[d]);
                        }
                        if (tempRoom.slots[ii].usages != undefined) {
                            let usages = tempRoom.slots[ii].usages;
                            for (let iii = 0; iii < usages.length; iii++) {
                                if (usages[iii] != null) {
                                    if (usages[iii].filepath.includes("mp3")) {
                                        await loadSound(usages[iii].filepath);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            for (let i = 0; i < _json.characters.length; i++) {
                let tempCharacter = PlayableCharacter.fromJson(await loadJson(_json.characters[i]));
                tempGameInstance.characterMap.set(tempCharacter.characterID, tempCharacter);
                await loadSound(tempCharacter.inventoryOpenSound);
                prgwidth += loadSpace;
                prgBar.style.width = prgwidth + "%";
                await loadSound(tempCharacter.inventoryCloseSound);
                prgwidth += loadSpace;
                prgBar.style.width = prgwidth + "%";
                if (tempCharacter.inventoryEmptySound) {
                    await loadSound(tempCharacter.inventoryEmptySound);
                }
                if (tempCharacter.combinationNotPossibleSound) {
                    await loadSound(tempCharacter.combinationNotPossibleSound);
                }
                if (tempCharacter.interactionNotPossibleSound) {
                    await loadSound(tempCharacter.interactionNotPossibleSound);
                }
                if (tempCharacter.containerEmptySound) {
                    await loadSound(tempCharacter.containerEmptySound);
                }
                for (let item of tempCharacter.inventory.items) {
                    if (item.itemSound) {
                        loadSound(item.itemSound);
                    }
                }
            }
        }
        else {
            for (let i = 0; i < _json.rooms.length; i++) {
                let tempRoom = Room.fromJSON(loadJsonFromLS(_json.rooms[i]));
                tempGameInstance.roomMap.set(tempRoom.roomID, tempRoom);
                await loadSound(tempRoom.atmoSound);
                prgwidth += loadSpace;
                prgBar.style.width = prgwidth + "%";
                for (let ii = 0; i < tempRoom.slots.length; i++) {
                    if (tempRoom.slots[ii] != undefined) {
                        for (let j = 0; j < tempRoom.slots[ii].interactSound.length; j++) {
                            await loadSound(tempRoom.slots[ii].interactSound[j]);
                        }
                        prgwidth += loadSpace;
                        prgBar.style.width = prgwidth + "%";
                        for (let j = 0; j < tempRoom.slots[ii].facingSound.length; j++) {
                            await loadSound(tempRoom.slots[ii].facingSound[j]);
                        }
                        let serializedSlot = tempRoom.slots[ii];
                        if (serializedSlot.closedSound != undefined) {
                            for (let j = 0; j < serializedSlot.closedSound.length; j++) {
                                await loadSound(serializedSlot.closedSound[j]);
                            }
                        }
                        if (serializedSlot.containerItems) {
                            for (let c = 0; c < serializedSlot.containerItems.length; c++) {
                                if (serializedSlot.containerItems[c].facingSound) {
                                    await loadSound(serializedSlot.containerItems[c].facingSound);
                                }
                                if (serializedSlot.containerItems[c].discoverSound) {
                                    await loadSound(serializedSlot.containerItems[c].discoverSound);
                                }
                                if (serializedSlot.containerItems[c].itemSound) {
                                    await loadSound(serializedSlot.containerItems[c].itemSound);
                                }
                            }
                        }
                        if (serializedSlot.itemSound != undefined) {
                            loadSound(serializedSlot.itemSound);
                        }
                        for (let d = 0; d < tempRoom.slots[ii].discoverSound.length; d++) {
                            await loadSound(tempRoom.slots[ii].discoverSound[d]);
                        }
                    }
                }
            }
            for (let i = 0; i < _json.characters.length; i++) {
                let tempCharacter = PlayableCharacter.fromJson(loadJsonFromLS(_json.characters[i]));
                tempGameInstance.characterMap.set(tempCharacter.characterID, tempCharacter);
                await loadSound(tempCharacter.inventoryOpenSound);
                prgwidth += loadSpace;
                prgBar.style.width = prgwidth + "%";
                await loadSound(tempCharacter.inventoryCloseSound);
                prgwidth += loadSpace;
                prgBar.style.width = prgwidth + "%";
                if (tempCharacter.inventoryEmptySound) {
                    await loadSound(tempCharacter.inventoryEmptySound);
                }
                if (tempCharacter.combinationNotPossibleSound) {
                    await loadSound(tempCharacter.combinationNotPossibleSound);
                }
                if (tempCharacter.interactionNotPossibleSound) {
                    await loadSound(tempCharacter.interactionNotPossibleSound);
                }
                if (tempCharacter.containerEmptySound) {
                    await loadSound(tempCharacter.containerEmptySound);
                }
                for (let item of tempCharacter.inventory.items) {
                    if (item.itemSound) {
                        loadSound(item.itemSound);
                    }
                }
            }
        }
        let currentRoomKey = _json.currentRoom;
        tempGameInstance.currentRoom = tempGameInstance.roomMap.get(currentRoomKey);
        let currentCharacterKey = _json.currentCharacter;
        tempGameInstance.currentCharacter = tempGameInstance.characterMap.get(currentCharacterKey);
        console.log("finished");
        prgBar.id = "myBarFinished";
        return tempGameInstance;
    }
    async function setGame() {
        Prototyp.gameInstance = await loadGamefromJSON(await loadJson("../Data/Game/game.json"));
        // speak("finde die 2 beweismittel und untersuche sie unter dem mikroskop");
    }
    function saveGame() {
        let gameInstanceString = JSON.stringify(Prototyp.gameInstance);
        localStorage.setItem("gameInstance", gameInstanceString);
        let tempRoom = undefined;
        for (let [key, value] of Prototyp.gameInstance.roomMap) {
            tempRoom = value;
            let roomString = JSON.stringify(tempRoom);
            localStorage.setItem(key, roomString);
        }
        let tempCharacter = undefined;
        for (let [key, value] of Prototyp.gameInstance.characterMap) {
            tempCharacter = value;
            let characterString = JSON.stringify(tempCharacter);
            localStorage.setItem(key, characterString);
        }
    }
    const thingDescriber = document.getElementById("thingText");
    async function loadGame() {
        let gameJSON = JSON.parse(localStorage.getItem("gameInstance"));
        Prototyp.gameInstance = await loadGamefromJSON(gameJSON);
        Prototyp.gameInstance.gameState = GAME_STATE.PLAYING;
        thingDescriber.textContent = Prototyp.gameInstance.currentRoom.getFocusedSlot().name;
    }
    async function clearGame() {
        localStorage.clear();
        Prototyp.gameInstance = await loadGamefromJSON(await loadJson("../Data/Game/game.json"));
        thingDescriber.textContent = Prototyp.gameInstance.currentRoom.getFocusedSlot().name;
    }
    let saveButton = document.getElementById("saveGame");
    let loadButton = document.getElementById("loadGame");
    let clearButton = document.getElementById("clearGame");
    setGame().then(main);
    //------------------------------------- Game Possible actions -  Test -------------------------------------//
    /*
        -> talk with man_with_hat in kitchen, he will open the closet (livingroom). In this closet
        there is a key with which u can open the bathroom door(livingroom).
    
        -> if u shower(interact w shower) and talk to man with hat again he will open the forensics door
        -> if u combine stick + line from the inventory you can use the fishing rod on the sink(bathroom) and get
        a boot from it.
    
    */
    //---------------------------------------------------------------------------------------------------------//
    let startBtn = document.getElementById("startBtn");
    function main() {
        startBtn.className = "";
        //UI dependent code for prototype only
        startBtn.addEventListener("click", startGame);
        //saveButton.addEventListener("click", saveGame);
        //saveButton.addEventListener("touch", saveGame);
        //loadButton.addEventListener("click", loadGame);
        //clearButton.addEventListener("click", clearGame);
    }
    function startGame(e) {
        startBtn.disabled = true;
        onAction("startgame");
    }
    let caseDecider;
    function speakFacing(slot) {
        if (slot.facingSound.length == 0) {
            speak(slot.name);
            return;
        }
        if (slot.facingSound.length > 1) {
            currentlyPlayingSound = slot.facingSound[Prototyp.gameInstance.currentCharacter.soundArrayIndex];
            playSound(slot.facingSound[Prototyp.gameInstance.currentCharacter.soundArrayIndex]);
        }
        else {
            currentlyPlayingSound = slot.facingSound[0];
            playSound(slot.facingSound[0]);
        }
    }
    function speakDiscover(slot) {
        if (slot.alreadySeen) {
            speakFacing(slot);
        }
        else {
            if (slot.discoverSound.length == 0) {
                speakFacing(slot);
            }
            if (slot.discoverSound.length > 1) {
                currentlyPlayingSound = slot.discoverSound[Prototyp.gameInstance.currentCharacter.soundArrayIndex];
                playSound(slot.discoverSound[Prototyp.gameInstance.currentCharacter.soundArrayIndex]);
            }
            else {
                if (slot.facingSound.length > 1) {
                    speakFacing(slot);
                }
                else {
                    currentlyPlayingSound = slot.discoverSound[0];
                    playSound(slot.discoverSound[0]);
                }
            }
            slot.alreadySeen = true;
        }
    }
    function handleCombination() {
        let currentInventory = Prototyp.gameInstance.currentCharacter.inventory;
        if (Prototyp.gameInstance.combiningItem == undefined) {
            //play combination starting sound
            Prototyp.gameInstance.combiningItem = currentInventory.getFocusedItem();
            speak("ich will " + Prototyp.gameInstance.combiningItem.name + " kombinieren");
        }
        else {
            let selectedItem = currentInventory.getFocusedItem().itemID;
            let combineItem = Prototyp.gameInstance.combiningItem.itemID;
            if (combineItem == selectedItem) {
                if (Prototyp.gameInstance.currentCharacter.combinationNotPossibleSound) {
                    speak(Prototyp.gameInstance.currentCharacter.combinationNotPossibleSound);
                }
                else {
                    speak("dass scheint nicht zu funktionieren");
                }
                Prototyp.gameInstance.combiningItem = undefined;
            }
            else if (!Prototyp.gameInstance.combinationsMap.has(selectedItem) || !Prototyp.gameInstance.combinationsMap.has(combineItem)) {
                if (Prototyp.gameInstance.currentCharacter.combinationNotPossibleSound) {
                    speak(Prototyp.gameInstance.currentCharacter.combinationNotPossibleSound);
                }
                else {
                    speak("dass scheint nicht zu funktionieren");
                }
                Prototyp.gameInstance.combiningItem = undefined;
            }
            else {
                if (Prototyp.gameInstance.combinationsMap.get(combineItem) != Prototyp.gameInstance.combinationsMap.get(selectedItem)) {
                    if (Prototyp.gameInstance.currentCharacter.combinationNotPossibleSound) {
                        speak(Prototyp.gameInstance.currentCharacter.combinationNotPossibleSound);
                    }
                    else {
                        speak("dass lässt sich nicht kombinieren");
                    }
                }
                else {
                    let aquiredItem = Prototyp.gameInstance.obtainableItemMap.get(Prototyp.gameInstance.combinationsMap.get(combineItem));
                    speak("ich habe" + Prototyp.gameInstance.combiningItem.name + "mit" + currentInventory.getFocusedItem().name + " kombiniert und erhalte:"
                        + aquiredItem.name);
                    currentInventory.items.unshift(aquiredItem);
                    currentInventory.removeItem(selectedItem);
                    currentInventory.removeItem(combineItem);
                    currentInventory.focusedItemIndex = 0;
                    thingDescriberText = currentInventory.getFocusedItem().name;
                    Prototyp.gameInstance.combiningItem = undefined;
                }
            }
        }
    }
    let gameStarted = false;
    function onAction(_action) {
        cancelVoiceIfSpeaking();
        switch (Prototyp.gameInstance.gameState) {
            case GAME_STATE.MENU:
                if (_action == "startgame") {
                    thingDescriberText = Prototyp.gameInstance.currentRoom.getFocusedSlot().name;
                    speakDiscover(Prototyp.gameInstance.currentRoom.getFocusedSlot());
                    //speak(thingDescriberText);
                    playSound(Prototyp.gameInstance.currentRoom.atmoSound, true);
                    addFilter(Prototyp.gameInstance.currentRoom.atmoSound, atmoLPFilter);
                    let preElements = document.getElementById("preGrameElements");
                    preElements.className = "invisible";
                    document.getElementById("screen").className = "";
                    Prototyp.gameInstance.gameState = GAME_STATE.PLAYING;
                }
                break;
            case GAME_STATE.PLAYING:
                if (!gameStarted) {
                    gameStarted = true;
                }
                if (_action == "left") {
                    if (audioSourceMap.get(currentlyPlayingSound) != undefined) {
                        let playingSource = audioSourceMap.get(currentlyPlayingSound);
                        playingSource.stop();
                    }
                    Prototyp.gameInstance.currentRoom.nextSlotLeft();
                    //gameInstance.currentRoom.slots[gameInstance.currentRoom.focusedSlotIndex];
                    //speakFacing(gameInstance.currentRoom.getFocusedSlot());
                    //speak(gameInstance.currentRoom.getFocusedSlot().name);
                    thingDescriberText = Prototyp.gameInstance.currentRoom.getFocusedSlot().name;
                }
                else if (_action == "right") {
                    if (audioSourceMap.get(currentlyPlayingSound) != undefined) {
                        let playingSource = audioSourceMap.get(currentlyPlayingSound);
                        playingSource.stop();
                    }
                    /*if (audioSourceMap.get(gameInstance.currentRoom.getFocusedSlot().discoverSound) != undefined) {
                        let playingSource: AudioBufferSourceNode = audioSourceMap.get(gameInstance.currentRoom.getFocusedSlot().discoverSound);
                        playingSource.stop();
                    }*/
                    Prototyp.gameInstance.currentRoom.nextSlotRight();
                    //speakFacing(gameInstance.currentRoom.getFocusedSlot());
                    //speak(gameInstance.currentRoom.getFocusedSlot().name);
                    thingDescriberText = Prototyp.gameInstance.currentRoom.getFocusedSlot().name;
                }
                else if (_action == "up") {
                    if (audioSourceMap.get(currentlyPlayingSound) != undefined) {
                        let playingSource = audioSourceMap.get(currentlyPlayingSound);
                        playingSource.stop();
                    }
                    let slot = Prototyp.gameInstance.currentRoom.getFocusedSlot();
                    slot.interact();
                    if (slot.toJSON().type == "Portal") {
                        thingDescriberText = Prototyp.gameInstance.currentRoom.getFocusedSlot().name;
                    }
                }
                else if (_action == "down") {
                    if (audioSourceMap.get(currentlyPlayingSound) != undefined) {
                        let playingSource = audioSourceMap.get(currentlyPlayingSound);
                        playingSource.stop();
                    }
                    if (Prototyp.gameInstance.currentCharacter.inventory.isEmpty()) {
                        if (Prototyp.gameInstance.currentCharacter.inventoryEmptySound) {
                            speak(Prototyp.gameInstance.currentCharacter.inventoryEmptySound);
                        }
                        else {
                            speak("Es befindet sich nichts im Inventar");
                        }
                    }
                    else {
                        Prototyp.gameInstance.gameState = GAME_STATE.INVENTORY;
                        playSound(Prototyp.gameInstance.currentCharacter.inventoryOpenSound);
                        //set dämpfung
                        atmoLPFilter.frequency.setValueAtTime(320, audioContext.currentTime + 0.2);
                        let currentItem = Prototyp.gameInstance.currentCharacter.inventory.items[Prototyp.gameInstance.currentCharacter.inventory.focusedItemIndex];
                        let currentItemName = Prototyp.gameInstance.currentCharacter.inventory.items[Prototyp.gameInstance.currentCharacter.inventory.focusedItemIndex].name;
                        thingDescriberText = currentItemName;
                        if (currentItem.itemSound) {
                            speak(currentItem.itemSound);
                        }
                        else {
                            speak(currentItemName);
                        }
                    }
                }
                else if (_action == "doubletap") {
                    if (Prototyp.gameInstance.currentCharacter.equippedItem == undefined) {
                        speak("Ich habe nichts in der Hand");
                        thingDescriberText = Prototyp.gameInstance.currentRoom.getFocusedSlot().name;
                    }
                    else {
                        speak(Prototyp.gameInstance.currentRoom.getFocusedSlot().useItem(Prototyp.gameInstance.currentCharacter.equippedItem));
                        thingDescriberText = Prototyp.gameInstance.currentRoom.getFocusedSlot().name;
                    }
                }
                break;
            case GAME_STATE.INVENTORY:
                let currentInventory = Prototyp.gameInstance.currentCharacter.inventory;
                if (audioSourceMap.get(currentlyPlayingSound) != undefined) {
                    let playingSource = audioSourceMap.get(currentlyPlayingSound);
                    playingSource.stop();
                }
                if (_action == "left") {
                    currentInventory.nextItemLeft();
                    if (currentInventory.getFocusedItem().itemSound) {
                        speak(currentInventory.getFocusedItem().itemSound);
                    }
                    else {
                        speak(currentInventory.getFocusedItem().name);
                    }
                    thingDescriberText = currentInventory.getFocusedItem().name;
                }
                else if (_action == "right") {
                    currentInventory.nextItemRight();
                    if (currentInventory.getFocusedItem().itemSound) {
                        speak(currentInventory.getFocusedItem().itemSound);
                    }
                    else {
                        speak(currentInventory.getFocusedItem().name);
                    }
                    thingDescriberText = currentInventory.getFocusedItem().name;
                }
                else if (_action == "up") {
                    if (Prototyp.gameInstance.combiningItem == undefined) {
                        playSound(Prototyp.gameInstance.currentCharacter.inventoryCloseSound);
                        //remove dämpfung
                        atmoLPFilter.frequency.setValueAtTime(20000, audioContext.currentTime + 0.2);
                        Prototyp.gameInstance.gameState = GAME_STATE.PLAYING;
                        thingDescriberText = Prototyp.gameInstance.currentRoom.getFocusedSlot().name;
                    }
                    else {
                        Prototyp.gameInstance.combiningItem = undefined;
                        speak("ich will doch nichts kombinieren");
                    }
                }
                else if (_action == "down") {
                    handleCombination();
                }
                else if (_action == "doubletap") {
                    Prototyp.gameInstance.currentCharacter.equippedItem = currentInventory.getFocusedItem();
                    speak(" ich nehme" + currentInventory.getFocusedItem().name + " in die Hand.");
                    thingDescriberText = currentInventory.getFocusedItem().name;
                }
                else if (_action != "") {
                    let itemList = currentInventory.items;
                    for (let idx = 0; idx < itemList.length; idx++) {
                        if (_action.includes(itemList[idx].itemID)) {
                            currentInventory.focusedItemIndex = idx;
                            thingDescriberText = currentInventory.getFocusedItem().name;
                            speak(" ich habe" + currentInventory.getFocusedItem().name + " ausgewählt");
                            break;
                        }
                    }
                }
                break;
            case GAME_STATE.CONTAINER:
                let currentContainer = Prototyp.gameInstance.currentRoom.getFocusedSlot();
                if (_action == "left") {
                    currentContainer.nextItemLeft();
                    //speak(currentContainer.getFocusedItem().name);
                    thingDescriberText = currentContainer.getFocusedItem().name;
                }
                else if (_action == "right") {
                    currentContainer.nextItemRight();
                    //speak(currentContainer.getFocusedItem().name);
                    thingDescriberText = currentContainer.getFocusedItem().name;
                }
                else if (_action == "up") {
                    /*if (!currentContainer.getFocusedItem().isOpen) {
                        speak("ich kann dieses item nicht aufheben");
                        return;
                    }*/
                    currentContainer.getFocusedItem().interact();
                    //speak("ich nehme mir" + currentContainer.getFocusedItem().name);
                    if (currentContainer.containerItems.length == 0) {
                        Prototyp.gameInstance.gameState = GAME_STATE.PLAYING;
                        thingDescriberText = currentContainer.name;
                    }
                    else {
                        thingDescriberText = currentContainer.getFocusedItem().name;
                    }
                }
                else if (_action == "down") {
                    Prototyp.gameInstance.gameState = GAME_STATE.PLAYING;
                    thingDescriberText = currentContainer.name;
                }
                break;
            case GAME_STATE.SEARCHING:
                let regExSearch = new RegExp(/^(search,)\d*(,)\d+$/);
                let regExDT = new RegExp(/^(doubletap,)\d*(,)\d+$/);
                let currentPosArray = _action.split(",");
                let currentX = parseInt(currentPosArray[1]);
                let currentY = parseInt(currentPosArray[2]);
                if ((regExSearch.test(_action)) && (!hasFoundSpoken)) {
                    caseDecider = "search";
                }
                else if (regExDT.test(_action) && (hasFoundSpoken)) {
                    caseDecider = "doubletap";
                }
                for (let i = 0; i < Prototyp.gameInstance.currentSearchField.hints.length; i++) {
                    let currentHint = Prototyp.gameInstance.searchHintMap.get(Prototyp.gameInstance.currentSearchField.hints[i]);
                    let distance = Math.sqrt(Math.pow((currentX - currentHint.positionX), 2) +
                        Math.pow((currentY - currentHint.positionY), 2));
                    switch (caseDecider) {
                        case "search":
                            if ((distance <= 10) && (!hasFoundSpoken)) {
                                speak("hier scheint sich etwas zu befinden");
                                window.navigator.vibrate(200); //TODO: variety
                                hasFoundSpoken = true;
                            }
                            break;
                        case "doubletap":
                            if (distance <= 15) {
                                speak(currentHint.hint);
                                if (Prototyp.gameInstance.currentSearchField.correctHint == currentHint.hintID) {
                                    atmoLPFilter.frequency.setValueAtTime(20000, audioContext.currentTime + 0.2);
                                    Prototyp.gameInstance.gameState = GAME_STATE.PLAYING;
                                    thingDescriberText = Prototyp.gameInstance.currentRoom.getFocusedSlot().name;
                                }
                                else {
                                    hasFoundSpoken = false;
                                }
                            }
                            break;
                        default:
                            break;
                    }
                }
                break;
            case GAME_STATE.SHOVE:
                let inputArray = _action.split(",");
                let velocity = parseFloat(inputArray[1]);
                let distanceX = parseFloat(inputArray[2]);
                let distanceY = parseFloat(inputArray[3]);
                if (inputArray[0] == "panend") {
                    if (distanceY >= -400) {
                        cancelVoiceIfSpeaking();
                        speak("mist nicht weit genug. Ich sollte es nächstes mal weiter versuchen");
                        Prototyp.gameInstance.gameState = GAME_STATE.PLAYING;
                        return;
                    }
                }
                if (inputArray[0] != "pan") {
                    return;
                }
                if (velocity <= -0.125) {
                    cancelVoiceIfSpeaking();
                    speak("mist zu schnell. Ich sollte es nächstes mal langsamer versuchen");
                    Prototyp.gameInstance.gameState = GAME_STATE.PLAYING;
                    return;
                }
                if (Math.abs(distanceX) >= 40) {
                    cancelVoiceIfSpeaking();
                    speak("mist zu schräg. Ich sollte es nächstes mal gerader versuchen");
                    Prototyp.gameInstance.gameState = GAME_STATE.PLAYING;
                    return;
                }
                let minHeight = window.innerHeight * 0.6;
                if (distanceY <= -400) {
                    cancelVoiceIfSpeaking();
                    speak("hurra, ich habe es geschafft EZ");
                    Prototyp.gameInstance.gameState = GAME_STATE.PLAYING;
                    return;
                }
                break;
        }
        thingDescriber.textContent = thingDescriberText;
    }
    Prototyp.onAction = onAction;
    function cancelVoiceIfSpeaking() {
        let synth = window.speechSynthesis;
        if (synth.speaking && Prototyp.gameInstance.gameState != GAME_STATE.SEARCHING) {
            synth.cancel();
        }
        else if (synth.speaking && caseDecider.startsWith("double")) {
            synth.cancel();
        }
    }
    function speak(_inputTxt) {
        let synth = window.speechSynthesis;
        if (synth.speaking) {
            //console.error("speechSynthesis.speaking");
            return;
        }
        if (_inputTxt.includes("mp3")) {
            playSound(_inputTxt);
            currentlyPlayingSound = _inputTxt;
        }
        else if (_inputTxt != " ") {
            let utterThis = new SpeechSynthesisUtterance(_inputTxt);
            utterThis.lang = "de-DE";
            synth.speak(utterThis);
        }
    }
})(Prototyp || (Prototyp = {}));
//# sourceMappingURL=game.js.map