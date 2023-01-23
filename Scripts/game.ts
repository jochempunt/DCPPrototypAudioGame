
namespace Prototyp {

    export enum GAME_STATE {
        PLAYING,
        INVENTORY,
        CONTAINER,
        SEARCHING,
        SHOVE,
        MENU
    }

    interface Serialized {
        [key: string]: any;
    }
    // ------ Audio Api Variables -----//




    window.AudioContext = window.AudioContext || window.webkitAudioContext;

    const audioContext: AudioContext = new AudioContext();
    let audioBufferMap: Map<string, AudioBuffer> = new Map();
    let audioSourceMap: Map<string, AudioBufferSourceNode> = new Map();
    let atmoLPFilter: BiquadFilterNode = audioContext.createBiquadFilter();
    let currentlyPlayingSound: string = "";
    atmoLPFilter.frequency.setValueAtTime(20000, 0);
    atmoLPFilter.type = "lowpass";

    async function loadSound(_url: string): Promise<void> {
        if (audioBufferMap.get(_url) == null) {
            if (_url.includes(".mp3")) {
                let response: Response = await fetch(_url);
                let arraybuffer: ArrayBuffer = await response.arrayBuffer();
                let audioBuffer: AudioBuffer = await audioContext.decodeAudioData(arraybuffer);
                audioBufferMap.set(_url, audioBuffer);
            }

        }

    }

    function playSound(_url: string, _loop: boolean = false, _duration: number = 0): void {
        let source: AudioBufferSourceNode = audioContext.createBufferSource();
        source.buffer = audioBufferMap.get(_url);
        source.connect(audioContext.destination);
        source.loop = _loop;
        source.start(_duration);
        audioSourceMap.set(_url, source);

    }

    function stopSound(_url: string): void {
        audioSourceMap.get(_url).stop();
        audioSourceMap.delete(_url);
    }

    function addFilter(_url: string, _filter: BiquadFilterNode): void {
        let tempsource: AudioBufferSourceNode = audioSourceMap.get(_url);
        tempsource.disconnect();
        tempsource.connect(_filter);
        _filter.connect(audioContext.destination);
    }

    let thingDescriberText: string = "";
    let hasFoundSpoken: boolean = false;

    class Game {
        gameState: GAME_STATE = GAME_STATE.MENU;
        gameProgress: number = 0;
        currentRoom: Room;
        currentCharacter: PlayableCharacter;
        roomMap: Map<string, Room> = new Map<string, Room>();
        locationMap: Map<string, Location> = new Map<string, Location>();
        characterMap: Map<string, PlayableCharacter> = new Map<string, PlayableCharacter>();
        firstEverFocusedSlot: number = 0;
        maxSlots: number = 8;
        combinationsMap: Map<string, string>;
        combiningItem: Item;
        obtainableItemMap: Map<string, Item>;
        searchHintMap: Map<string, SearchHint>;
        currentSearchingHint: SearchHint;

        searchFieldMap: Map<string, SearchField>;
        currentSearchField: SearchField;



        toJSON(): Serialized {
            let roomKeys: String[] = [];
            let characterKeys: String[] = [];
            let iterator: number = 0;
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

    export let gameInstance: Game = new Game();

    class Item {
        itemID: string;
        name: string;
        unlocked: boolean;
        usages: Usage[];
        itemSound: string;
        constructor(_itemID: string, _name: string, _unlocked: boolean = true, _usages: Usage[], _itemSound: string) {
            this.itemID = _itemID;
            this.name = _name;
            this.unlocked = _unlocked;
            this.usages = _usages;
            this.itemSound = _itemSound;
        }

    }

    class Inventory {
        inventoryID: string;
        focusedItemIndex: number = 0;
        items: Item[];

        constructor(_inventoryID: string, _items: Item[]) {
            this.inventoryID = _inventoryID;
            this.items = _items;
        }

        static fromJson(_json: Serialized): Inventory {
            let items1: Item[] = [];
            for (let i: number = 0; i < _json.items.length; i++) {
                items1[i] = new Item(_json.items[i].itemID, _json.items[i].name, _json.items[i].unlocked, _json.items[i].usages, _json.items[i].itemSound);
            }
            let inventory: Inventory = new Inventory(_json.inventoryID, items1);
            return inventory;
        }

        nextItemLeft(): void {
            if (this.focusedItemIndex > 0) {
                this.focusedItemIndex--;
            } else {
                this.focusedItemIndex = this.items.length - 1;
            }
        }

        nextItemRight(): void {
            if (this.focusedItemIndex < this.items.length - 1) {
                this.focusedItemIndex++;
            } else {
                this.focusedItemIndex = 0;
            }
        }

        getFocusedItem(): Item {
            return this.items[this.focusedItemIndex];
        }

        isEmpty(): boolean {
            if (this.items.length == 0) {
                return true;
            }
            return false;

        }

        removeItem(item: string): void {

            for (let i: number = 0; i < this.items.length; i++) {
                if (this.items[i].itemID == item) {
                    this.items.splice(i, 1);
                    return;
                }
            }
            ;
        }
    }

    class PlayableCharacter {
        characterID: string;
        inventory: Inventory;
        path: string;
        inventoryOpenSound: string;
        inventoryCloseSound: string;
        inventoryEmptySound: string;
        combinationNotPossibleSound: string;
        interactionNotPossibleSound: string;
        containerEmptySound: string;
        soundArrayIndex: number;
        equippedItem: Item;

        constructor(_characterID: string, _inventory: Inventory, _path: string, _inventoryOpenSound: string, _inventoryCloseSound: string, _inventoryEmptySound: string, _combinationNotPossibleSound: string, _interactionNotPossibleSound: string, _containerEmptySound: string, _soundArrayIndex: number, _equipedItem: Item = undefined) {
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

        static fromJson(_json: Serialized): PlayableCharacter {
            let inventory: Inventory = Inventory.fromJson(_json.inventory);
            let eItem: Item = undefined;
            if (_json.equippedItem != undefined) {///----------------------
                eItem = new Item(_json.equippedItem.itemID, _json.equippedItem.name, _json.equippedItem.unlocked, _json.equippedItem.usages, _json.equippedItem.itemSound);
            }
            let character: PlayableCharacter = new PlayableCharacter(_json.characterID, inventory, _json.path, _json.inventoryOpenSound, _json.inventoryCloseSound, _json.inventoryEmptySound, _json.combinationNotPossibleSound, _json.interactionNotPossibleSound, _json.containerEmptySound, _json.soundArrayIndex, eItem);
            return character;
        }
    }

    class Interactable { // abstract class for slot could be named entity aswell
        slotID: string;
        name: string;
        accessCharacter: string;
        interactSound: string[];
        facingSound: string[];
        discoverSound: string[];
        usages: Usage[];
        state: number;
        alreadySeen: boolean;
        isVisible: boolean;

        constructor(_slotID: string, _name: string, _accessCharacter: string, _interactSound: string[] = [], _facingSound: string[] = [], _discoverSound: string[] = [], _usages: Usage[] = [], _state: number = 0, _alreadySeen: boolean = false, _isVisible: boolean = true) {
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

        interact(): void {
            if (this.accessCharacter != undefined) {
                if (this.accessCharacter == gameInstance.currentCharacter.characterID) {
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
                speak(this.interactSound[gameInstance.currentCharacter.soundArrayIndex]);
                return;
            }
            let speechString: string = "ich interagiere mit " + this.name;
            speak(speechString);
        }

        useItem(itemToUse: Item): string {
            let currUsages: Usage[] = itemToUse.usages;

            for (let i: number = 0; i < currUsages.length; i++) {
                if (currUsages[i].targetSlotID == this.slotID) {
                    // usage effect method()
                    onUsage(currUsages[i]);
                    return currUsages[i].filepath;
                }
            }
            if (gameInstance.currentCharacter.interactionNotPossibleSound) {
                speak(gameInstance.currentCharacter.interactionNotPossibleSound);
                return "";
            } else {
                return "das kann ich hier nicht benutzen";
            }

        }

        toJSON(): Serialized {
            return {
                type: this.constructor.name,
                ...this
            };
        }
    }

    class SearchHint {
        hintID: string;
        positionX: number;
        positionY: number;
        hint: string;

        constructor(_hintID: string, _positionX: number, _positionY: number, _hint: string) {
            this.hintID = _hintID;
            this.positionX = _positionX;
            this.positionY = _positionY;
            this.hint = _hint;
        }
    }

    class SearchField {
        fieldID: string;
        hints: string[];
        correctHint: string;

        constructor(_fieldID: string, _hints: string[], _correctHint: string) {
            this.fieldID = _fieldID;
            this.hints = _hints;
            this.correctHint = _correctHint;
        }
    }

    class Usage {
        usageID: string;
        filepath: string;
        targetSlotID: string;
        effect: string;
        effectTargetID: string;
        destroyAfterUse: boolean;
        targetState: number;

        constructor(_usageID: string, _filepath: string, _targetSlotID: string, _effect: string, _effectTargetID: string, _destroyAfterUse: boolean = false, _targetState: number = undefined) {
            this.usageID = _usageID;
            this.filepath = _filepath;
            this.targetSlotID = _targetSlotID;
            this.effect = _effect;
            this.effectTargetID = _effectTargetID;
            this.destroyAfterUse = _destroyAfterUse;
            this.targetState = _targetState;
        }
    }

    function findUsageSlot(_effectSlotID: string): Interactable {
        for (let room of gameInstance.roomMap) {
            // --> if in case of alot of rooms, specify name of room for efficiency
            for (let i: number = 0; i < room[1].slots.length; i++) {
                if (room[1].slots[i] != null) {
                    if (room[1].slots[i].slotID == _effectSlotID) {
                        return room[1].slots[i];
                    }
                }
            }
        }
        return null;
    }

    function onUsage(_usage: Usage): void {
        if (_usage.effect != null) {
            let foundSlot: Interactable = findUsageSlot(_usage.effectTargetID);

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
                    let openSlot: Openable = <Openable><unknown>foundSlot;
                    openSlot.isOpen = true;

                    break;
                case "increment_state":

                    foundSlot.state++;
                    break;
                case "increment_both":

                    foundSlot.state++;
                    let incr_target1: Interactable = findUsageSlot(_usage.targetSlotID);
                    incr_target1.state++;
                    break;
                case "open_and_increment":
                    let openEffectTarget: Openable = <Openable><unknown>foundSlot;
                    openEffectTarget.isOpen = true;
                    // targetslot vs effectTargetslot // bezeichnung klären 
                    let incr_target2: Interactable = findUsageSlot(_usage.targetSlotID);
                    incr_target2.state++;
                    break;
                case "give_item":
                    gameInstance.currentCharacter.inventory.items.unshift(gameInstance.obtainableItemMap.get(_usage.effectTargetID));
                    let incr_target3: Interactable = findUsageSlot(_usage.targetSlotID);
                    incr_target3.state++;
                    // item löschen? muss state incrementiert werden?
                    break;
                case "search":
                    gameInstance.currentSearchField = gameInstance.searchFieldMap.get(_usage.effectTargetID);
                    gameInstance.gameState = GAME_STATE.SEARCHING;
                    atmoLPFilter.frequency.setValueAtTime(320, audioContext.currentTime + 0.2);
                    speak("Fahre mit dem Finger über den Bildschirm um zu suchen.");
                    break;
                case "shove":
                    speak("Fahre langsam mit dem Finger nach oben um zu schieben.");
                    gameInstance.gameState = GAME_STATE.SHOVE;
                    atmoLPFilter.frequency.setValueAtTime(320, audioContext.currentTime + 0.2);
                    break;
            }
            if (_usage.destroyAfterUse) {
                let itemString: string = gameInstance.currentCharacter.equippedItem.itemID;
                gameInstance.currentCharacter.inventory.removeItem(itemString);
            }
        }
    }

    class Openable {
        isOpen: boolean;
        closedSound: string[];
    }

    class Portal extends Interactable implements Openable {

        enteringRoomID: string;
        facingSlotInOppositeRoom: number;
        closedSound: string[];
        isOpen: boolean;
        constructor(_slotID: string, _name: string, _accessCharacter: string, _enteringRoomID: string, _facingSlotInOppositeRoom: number, _closedSound: string[], _interactSound: string[] = [], _isOpen: boolean, _facingSound: string[] = [], _discoverSound: string[] = [], _state: number = 0, _alreadyseen: boolean = false, _isVisible: boolean = true) {
            super(_slotID, _name, _accessCharacter, _interactSound, _facingSound, _discoverSound, null, _state, _alreadyseen, _isVisible);
            this.enteringRoomID = _enteringRoomID;
            this.facingSlotInOppositeRoom = _facingSlotInOppositeRoom;
            this.closedSound = _closedSound;
            this.isOpen = _isOpen;

        }
        interact(): void {

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
                    playSound(this.closedSound[gameInstance.currentCharacter.soundArrayIndex]);
                    return;
                }
                speak("das ist verschlossen");
                return;
            }

            if (audioSourceMap.get(gameInstance.currentRoom.atmoSound) != undefined) {
                stopSound(gameInstance.currentRoom.atmoSound);
            }

            playSound(this.interactSound[0]);
            gameInstance.currentRoom = gameInstance.roomMap.get(this.enteringRoomID);
            gameInstance.currentRoom.focusedSlotIndex = this.facingSlotInOppositeRoom;

            let audio: AudioBuffer = audioBufferMap.get(this.interactSound[0]);

            setTimeout(function (): void {
                playSound(gameInstance.currentRoom.atmoSound, true);
                addFilter(gameInstance.currentRoom.atmoSound, atmoLPFilter);
            }, audio.duration * 700);



            if (gameInstance.currentRoom.getFocusedSlot().facingSound.length != 0) {
                speakDiscover(gameInstance.currentRoom.getFocusedSlot());
                return;
            }




        }

        toJSON(): Serialized {
            return {
                type: this.constructor.name,
                ...this,
                isOpen: this.isOpen + ""
            };
        }

    }

    function sleep(milliseconds: number): void {
        const date: number = Date.now();
        let currentDate: number = null;
        do {
            currentDate = Date.now();
        } while (currentDate - date < milliseconds);
    }

    class Alter extends Interactable {
        newLocationID: string;
        newCharacterID: string;

        constructor(_slotID: string, _name: string, _accessCharacter: string, _newLocationID: string, _newCharacterID: string, _interactSound: string[] = [], _facingSound: string[] = [], _discoverSound: string[] = [], _usages: Usage[] = [], _state: number = 0, _alreadyseen: boolean = false, _isVisible: boolean = true) {
            super(_slotID, _name, _accessCharacter, _interactSound, _facingSound, _discoverSound, _usages, _state, _alreadyseen, _isVisible);
            this.newLocationID = _newLocationID;
            this.newCharacterID = _newCharacterID;
        }

        interact(): string {

            if (this.usages[this.state] != undefined) {
                speak(this.usages[this.state].filepath);
                onUsage(this.usages[this.state])

                //sleep(audioBufferMap.get())
                sleep(audioBufferMap.get(this.usages[this.state - 1].filepath).duration * 1000);

            }
            let location: Location = gameInstance.locationMap.get(this.newLocationID);
            let character: PlayableCharacter = gameInstance.characterMap.get(this.newCharacterID);
            let newRoom: Room = gameInstance.roomMap.get(location.firstRoom);


            stopSound(gameInstance.currentRoom.atmoSound);
            gameInstance.currentRoom = newRoom;

            playSound(location.arrivingSound);
            playSound(gameInstance.currentRoom.atmoSound, true);
            gameInstance.currentCharacter = gameInstance.characterMap.get(character.characterID);
            thingDescriberText = newRoom.slots[gameInstance.currentRoom.focusedSlotIndex].name;
            // !! attention temporary code --> sleep, will be replaced  later (when voicelines are replaced by audio files)
            sleep(audioBufferMap.get(location.arrivingSound).duration * 1000);
            if (this.usages[this.state] != undefined) {
                playSound(this.usages[this.state].filepath);
                sleep(audioBufferMap.get(this.usages[this.state].filepath).duration * 1000);
                // achtung dieses hier sollte wahrscheinlich danach wieder gelöscht werden

                speakDiscover(gameInstance.currentRoom.getFocusedSlot());
                this.state = 0;
                return "";
            } else {
                return "Ich befinde mich nun in " + location.name + " in " + location.firstRoom + " und habe eine neue Stimme.";
            }
        }
    }

    class Pickupable extends Interactable implements Openable {
        closedSound: string[];
        usages: Usage[] = [];
        isOpen: boolean;
        itemSound: string;
        constructor(_slotID: string, _name: string, _accessCharacter: string, _closedSound: string[], _usages: Usage[], _interactSound: string[] = [], _isOpen: boolean = true, _facingSound: string[] = [], _discoverSound: string[] = [], _alreadyseen: boolean = false, _isVisible: boolean = true, _itemSound: string) {
            super(_slotID, _name, _accessCharacter, _interactSound, _facingSound, _discoverSound, null, 0, _alreadyseen, _isVisible);
            this.closedSound = _closedSound;
            this.usages = _usages;
            this.isOpen = _isOpen;
            this.itemSound = _itemSound;
        }
        interact(): string {
            if (!this.isOpen) {
                if (this.closedSound != undefined) {
                    if (this.closedSound.length == 0) {

                        return "das ist verschlossen";
                    }
                    if (this.interactSound.length == 1) {
                        speak(this.closedSound[0]);
                        return "";
                    }
                    speak(this.closedSound[gameInstance.currentCharacter.soundArrayIndex]);
                    return "";
                }
                return "ich kann dies nicht aufheben";
            }

            if (this.accessCharacter != undefined) {

                if (this.accessCharacter == gameInstance.currentCharacter.characterID) {
                    let item: Item = new Item(this.slotID, this.name, this.isOpen, this.usages, this.itemSound);
                    gameInstance.currentCharacter.inventory.items.unshift(item);
                    if (gameInstance.gameState != GAME_STATE.CONTAINER) {

                        gameInstance.currentRoom.slots[gameInstance.currentRoom.focusedSlotIndex];
                        gameInstance.currentRoom.nextSlotRight();
                    } else {
                        let container: Container = <Container>gameInstance.currentRoom.slots[gameInstance.currentRoom.focusedSlotIndex];

                        if (container.containerItems.length > 0) {
                            container.containerItems.splice(container.focusedItemIndex, 1);
                            if (container.containerItems.length == 0) {
                                speak(container.name + " ist leer");
                                gameInstance.gameState = GAME_STATE.PLAYING;
                                return "";
                            }
                            container.nextItemRight();
                            if (container.getFocusedItem().facingSound.length > 0) {
                                speakDiscover(container.getFocusedItem());
                            } else {
                                speak(container.getFocusedItem().name);

                            }


                            return "";
                        } else {

                            if (gameInstance.currentCharacter.containerEmptySound) {
                                speak(gameInstance.currentCharacter.containerEmptySound);
                            } else {
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
                    playSound(this.interactSound[gameInstance.currentCharacter.soundArrayIndex]);
                }

                return "";
            }
            let item: Item = new Item(this.slotID, this.name, this.isOpen, this.usages, this.itemSound);
            gameInstance.currentCharacter.inventory.items.unshift(item);
            gameInstance.currentRoom.slots[gameInstance.currentRoom.focusedSlotIndex] = undefined;
            // error wegen automatisch nextSlotRight//thingdescriber
            gameInstance.currentRoom.nextSlotRight();

            //speak wird nicht ausgeführt
            speak("ich habe" + item.itemID + " aufgesammelt");
            // TODO character spricht / sound das etwas aufgesammelt worden ist
            return "ich habe" + item.itemID + " aufgesammelt";
        }
    }

    class Container extends Interactable implements Openable {
        containerItems: Pickupable[];
        focusedItemIndex: number = 0;
        closedSound: string[];
        isOpen: boolean;
        constructor(_slotID: string, _name: string, _accessCharacter: string, _containerItems: Pickupable[], _focusedItemIndex: number = 0, _usages: Usage[], _state: number = 0, _closedSound: string[], _interactSound: string[] = [], _isOpen: boolean, _facingSound: string[] = [], _discoverSound: string[] = [], _alreadyseen: boolean = false, _isVisible: boolean = true) {
            super(_slotID, _name, _accessCharacter, _interactSound, _facingSound, _discoverSound, _usages, _state, _alreadyseen, _isVisible);
            this.closedSound = _closedSound;
            this.containerItems = _containerItems;
            this.focusedItemIndex = _focusedItemIndex;
            this.isOpen = _isOpen;
        }

        interact(): string {
            if (this.isOpen) {

                if (this.containerItems.length == 0) {
                    if (gameInstance.currentCharacter.containerEmptySound) {
                        speak(gameInstance.currentCharacter.containerEmptySound);
                        return "";
                    } else {
                        speak("dieser container ist leer");
                        return "";
                    }

                }
                let currentItemName: string = this.containerItems[this.focusedItemIndex].name;

                thingDescriberText = currentItemName;
                gameInstance.gameState = GAME_STATE.CONTAINER;
                if (this.getFocusedItem().facingSound.length != 0) {
                    speakDiscover(this.getFocusedItem());
                } else {
                    speak(currentItemName);
                }


                return "container open sound " + currentItemName;
            }
            if (this.closedSound != undefined) {
                if (this.closedSound.length == 0) {


                } else if (this.interactSound.length == 1) {
                    playSound(this.closedSound[0]);

                } else {
                    playSound(this.closedSound[gameInstance.currentCharacter.soundArrayIndex]);
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

        nextItemLeft(): void {
            if (this.focusedItemIndex > 0) {
                this.focusedItemIndex--;
            } else {
                this.focusedItemIndex = this.containerItems.length - 1;
            }
            if (this.getFocusedItem().facingSound.length > 0) {
                speakDiscover(this.getFocusedItem());
            } else {
                speak(this.getFocusedItem().name);
            }

        }

        nextItemRight(): void {
            if (this.focusedItemIndex < this.containerItems.length - 1) {
                this.focusedItemIndex++;
            } else {
                this.focusedItemIndex = 0;
            }
            if (this.getFocusedItem().facingSound.length > 0) {
                speakDiscover(this.getFocusedItem());
            } else {
                speak(this.getFocusedItem().name)
            }
        }

        getFocusedItem(): Pickupable {
            return this.containerItems[this.focusedItemIndex];
        }
    }

    class Room { //name suggenstion would be "Site", "Spot" or "Place"
        roomID: string;
        name: string;
        focusedSlotIndex: number;
        slots: Interactable[];
        path: string;
        atmoSound: string;

        constructor(_RoomID: string, _name: string, _slots: Interactable[], _path: string, _atmoSound: string, _focusedSlotIndex: number = 0) {
            if (_slots.length != gameInstance.maxSlots) {

            } else {
                this.roomID = _RoomID;
                this.name = _name;
                this.slots = _slots;
                this.focusedSlotIndex = _focusedSlotIndex;
                this.path = _path;
                this.atmoSound = _atmoSound;
            }
        }

        static fromJSON(_json: Serialized): Room {

            let slots: Interactable[] = [];
            let currentSlot: Serialized = undefined;
            for (let i: number = 0; i < gameInstance.maxSlots; i++) {
                currentSlot = _json.slots[i];
                if (currentSlot == undefined) {
                    slots[i] = undefined;
                } else {
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
                            let pickupables: Pickupable[] = [];

                            for (let c: number = 0; c < currentSlot.containerItems.length; c++) {
                                let tempP: Pickupable = new Pickupable(currentSlot.containerItems[c].slotID, currentSlot.containerItems[c].name, currentSlot.containerItems[c].accessCharacter, currentSlot.containerItems[c].closedSound, currentSlot.containerItems[c].usages, currentSlot.containerItems[c].interactSound, currentSlot.containerItems[c].isOpen, currentSlot.containerItems[c].facingSound, currentSlot.containerItems[c].discoverSound, currentSlot.containerItems[c].alreadySeen, currentSlot.containerItems[c].isVisible, currentSlot.containerItems[c].itemSound);
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
            let newRoom: Room = new Room(_json.roomID, _json.name, slots, _json.path, _json.atmoSound, _json.focusedSlotIndex);
            return newRoom;
        }

        getFocusedSlot(): Interactable {
            return this.slots[this.focusedSlotIndex];
        }

        nextSlotLeft(): void {    // this should occur when the user swipes left
            if (this.focusedSlotIndex > 0) {
                this.focusedSlotIndex--;

            } else {
                this.focusedSlotIndex = gameInstance.maxSlots - 1;
            }
            if ((this.getFocusedSlot() == undefined) || (!this.getFocusedSlot().isVisible)) {
                this.nextSlotLeft();
            } else {
                speakDiscover(this.getFocusedSlot());
            }
        }

        nextSlotRight(): void { // this should occur when the user swipes right
            if (this.focusedSlotIndex < gameInstance.maxSlots - 1) {
                this.focusedSlotIndex++;
            } else {
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
        locationID: string;
        name: string;
        firstRoom: string;
        arrivingSound: string;
        constructor(_locationID: string, _name: string, _firstRoom: string, _arrivingSound: string) {
            this.locationID = _locationID;
            this.firstRoom = _firstRoom;
            this.arrivingSound = _arrivingSound;
            this.name = _name;
        }
    }


    //-------------------------------------------------main Programm------------------------------------------------//

    //------------------- Loading Rooms from Json Data ----------------------------//

    function loadJsonFromLS(_key: string): JSON {
        let obj: JSON = undefined;
        try {
            obj = JSON.parse(localStorage.getItem(_key));
        } catch (error) {
            console.log(error);
        }
        return obj;
    }

    async function loadJson(_path: string): Promise<JSON> {
        let response: Response = await fetch(_path);
        let json: JSON = await response.json();
        return json;
    }

    async function loadObtainableItemMap(): Promise<Map<string, Item>> {
        let arrayObject: Serialized = await loadJson("../Data/Game/obtainable_items.json");
        let tempItemMap: Map<string, Item> = new Map();

        for (let i: number = 0; i < arrayObject.length; i++) {
            let item: Item = new Item(arrayObject[i].itemID, arrayObject[i].name, arrayObject[i].unlocked, arrayObject[i].usages, arrayObject[i].itemSound);
            tempItemMap.set(item.itemID, item);
            if (item.itemSound) {
                loadSound(item.itemSound);
            }

        }
        return tempItemMap;
    }

    async function loadSearchHintMap(): Promise<Map<string, SearchHint>> {
        let arrayObject: Serialized = await loadJson("../Data/Game/searchhints.json");

        let tempHintMap: Map<string, SearchHint> = new Map();

        for (let i: number = 0; i < arrayObject.length; i++) {
            let hint: SearchHint = new SearchHint(arrayObject[i].hintID, arrayObject[i].positionX, arrayObject[i].positionY, arrayObject[i].hint);

            tempHintMap.set(hint.hintID, hint);
        }
        return tempHintMap;
    }

    async function loadSearchFieldMap(): Promise<Map<string, SearchField>> {
        let arrayObject: Serialized = await loadJson("../Data/Game/searchfields.json");

        let tempFieldMap: Map<string, SearchField> = new Map();

        for (let i: number = 0; i < arrayObject.length; i++) {
            let field: SearchField = new SearchField(arrayObject[i].fieldID, arrayObject[i].hints, arrayObject[i].correctHint);

            tempFieldMap.set(field.fieldID, field);
        }
        return tempFieldMap;
    }

    async function loadLocationMap(): Promise<Map<string, Location>> {
        let arrayObject: Serialized = await loadJson("../Data/Game/locations.json");

        let tempLocationMap: Map<string, Location> = new Map();

        for (let i: number = 0; i < arrayObject.length; i++) {
            let loc: Location = new Location(arrayObject[i].locationID, arrayObject[i].name, arrayObject[i].firstRoom, arrayObject[i].arrivingSound);

            tempLocationMap.set(loc.locationID, loc);
        }
        return tempLocationMap;
    }

    async function loadMapFromArray(_path: string): Promise<Map<string, string>> {
        let mapObject: Object = await loadJson(_path);
        return new Map(Object.entries(mapObject));
    }

    async function loadGamefromJSON(_json: Serialized): Promise<Game> {
        console.log("loading...");
        let tempGameInstance: Game = new Game();
        tempGameInstance.combinationsMap = await loadMapFromArray("../Data/Game/combinations.json");
        tempGameInstance.obtainableItemMap = await loadObtainableItemMap();
        tempGameInstance.searchHintMap = await loadSearchHintMap();
        tempGameInstance.searchFieldMap = await loadSearchFieldMap();
        tempGameInstance.locationMap = await loadLocationMap();
        tempGameInstance.gameProgress = _json.gameProgress;
        tempGameInstance.firstEverFocusedSlot = _json.firstEverFocusedSlot;
        tempGameInstance.gameState = GAME_STATE.MENU;

        let prgBar: HTMLDivElement = <HTMLDivElement>document.getElementById("myBar");
        let soundCount: number = 14;
        let prgwidth: number = 0;
        let loadSpace: number = 100 / soundCount;




        let locations: Location[] = Array.from(tempGameInstance.locationMap.values());
        for (let i: number = 0; i < locations.length; i++) {
            await loadSound(locations[i].arrivingSound);
            prgwidth += loadSpace;
            prgBar.style.width = prgwidth + "%";
        }

        let sounds: string[] = [];

        if (_json.saved != true) {
            for (let i: number = 0; i < _json.rooms.length; i++) {
                let tempRoom: Room = Room.fromJSON(await loadJson(_json.rooms[i]));
                tempGameInstance.roomMap.set(tempRoom.roomID, tempRoom);
                await loadSound(tempRoom.atmoSound);
                prgwidth += loadSpace;
                prgBar.style.width = prgwidth + "%";

                for (let ii: number = 0; ii < tempRoom.slots.length; ii++) {
                    if (tempRoom.slots[ii] != undefined) {
                        if (tempRoom.slots[ii].interactSound != undefined) {
                            sounds = tempRoom.slots[ii].interactSound;

                            for (let j: number = 0; j < tempRoom.slots[ii].interactSound.length; j++) {
                                await loadSound(tempRoom.slots[ii].interactSound[j]);
                            }

                            prgwidth += loadSpace;
                            prgBar.style.width = prgwidth + "%";

                        }

                        let serializedSlot: Serialized = <Serialized>tempRoom.slots[ii];
                        if (serializedSlot.closedSound != undefined) {
                            for (let j: number = 0; j < serializedSlot.closedSound.length; j++) {
                                await loadSound(serializedSlot.closedSound[j]);
                            }
                        }


                        if (serializedSlot.containerItems) {
                            for (let c: number = 0; c < serializedSlot.containerItems.length; c++) {

                                if (serializedSlot.containerItems[c].facingSound.length > 0) {
                                    for (let fc: number = 0; fc < serializedSlot.containerItems[c].facingSound.length; fc++) {
                                        await loadSound(serializedSlot.containerItems[c].facingSound[fc]);
                                    }

                                }
                                if (serializedSlot.containerItems[c].discoverSound.length > 0) {
                                    for (let dc: number = 0; dc < serializedSlot.containerItems[c].discoverSound.length; dc++) {
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


                        for (let j: number = 0; j < tempRoom.slots[ii].facingSound.length; j++) {
                            await loadSound(tempRoom.slots[ii].facingSound[j]);
                        }

                        for (let d: number = 0; d < tempRoom.slots[ii].discoverSound.length; d++) {
                            await loadSound(tempRoom.slots[ii].discoverSound[d]);
                        }


                        if (tempRoom.slots[ii].usages != undefined) {
                            let usages: Usage[] = tempRoom.slots[ii].usages;

                            for (let iii: number = 0; iii < usages.length; iii++) {
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

            for (let i: number = 0; i < _json.characters.length; i++) {
                let tempCharacter: PlayableCharacter = PlayableCharacter.fromJson(await loadJson(_json.characters[i]));

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
            for (let i: number = 0; i < _json.rooms.length; i++) {
                let tempRoom: Room = Room.fromJSON(loadJsonFromLS(_json.rooms[i]));
                tempGameInstance.roomMap.set(tempRoom.roomID, tempRoom);
                await loadSound(tempRoom.atmoSound);
                prgwidth += loadSpace;
                prgBar.style.width = prgwidth + "%";
                for (let ii: number = 0; i < tempRoom.slots.length; i++) {
                    if (tempRoom.slots[ii] != undefined) {
                        for (let j: number = 0; j < tempRoom.slots[ii].interactSound.length; j++) {
                            await loadSound(tempRoom.slots[ii].interactSound[j]);
                        }
                        prgwidth += loadSpace;
                        prgBar.style.width = prgwidth + "%";
                        for (let j: number = 0; j < tempRoom.slots[ii].facingSound.length; j++) {
                            await loadSound(tempRoom.slots[ii].facingSound[j]);
                        }

                        let serializedSlot: Serialized = <Serialized>tempRoom.slots[ii];
                        if (serializedSlot.closedSound != undefined) {
                            for (let j: number = 0; j < serializedSlot.closedSound.length; j++) {
                                await loadSound(serializedSlot.closedSound[j]);
                            }
                        }

                        if (serializedSlot.containerItems) {
                            for (let c: number = 0; c < serializedSlot.containerItems.length; c++) {
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


                        for (let d: number = 0; d < tempRoom.slots[ii].discoverSound.length; d++) {
                            await loadSound(tempRoom.slots[ii].discoverSound[d]);
                        }
                    }

                }
            }

            for (let i: number = 0; i < _json.characters.length; i++) {
                let tempCharacter: PlayableCharacter = PlayableCharacter.fromJson(loadJsonFromLS(_json.characters[i]));
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

        let currentRoomKey: string = _json.currentRoom;
        tempGameInstance.currentRoom = tempGameInstance.roomMap.get(currentRoomKey);

        let currentCharacterKey: string = _json.currentCharacter;
        tempGameInstance.currentCharacter = tempGameInstance.characterMap.get(currentCharacterKey);
        console.log("finished");
        prgBar.id = "myBarFinished";
        return tempGameInstance;


    }

    async function setGame(): Promise<void> {

        gameInstance = await loadGamefromJSON(await loadJson("../Data/Game/game.json"));

        // speak("finde die 2 beweismittel und untersuche sie unter dem mikroskop");
    }

    function saveGame(): void {
        let gameInstanceString: string = JSON.stringify(gameInstance);
        localStorage.setItem("gameInstance", gameInstanceString);
        let tempRoom: Room = undefined;
        for (let [key, value] of gameInstance.roomMap) {
            tempRoom = value;
            let roomString: string = JSON.stringify(tempRoom);
            localStorage.setItem(key, roomString);
        }
        let tempCharacter: PlayableCharacter = undefined;
        for (let [key, value] of gameInstance.characterMap) {
            tempCharacter = value;
            let characterString: string = JSON.stringify(tempCharacter);
            localStorage.setItem(key, characterString);
        }
    }

    const thingDescriber: HTMLParagraphElement = <HTMLParagraphElement>document.getElementById("thingText");

    async function loadGame(): Promise<void> {
        let gameJSON: JSON = JSON.parse(localStorage.getItem("gameInstance"));
        gameInstance = await loadGamefromJSON(gameJSON);
        gameInstance.gameState = GAME_STATE.PLAYING;
        thingDescriber.textContent = gameInstance.currentRoom.getFocusedSlot().name;
    }
    async function clearGame(): Promise<void> {
        localStorage.clear();
        gameInstance = await loadGamefromJSON(await loadJson("../Data/Game/game.json"));
        thingDescriber.textContent = gameInstance.currentRoom.getFocusedSlot().name;
    }


    let saveButton: HTMLButtonElement = <HTMLButtonElement>document.getElementById("saveGame");
    let loadButton: HTMLButtonElement = <HTMLButtonElement>document.getElementById("loadGame");
    let clearButton: HTMLButtonElement = <HTMLButtonElement>document.getElementById("clearGame");

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
    let startBtn: HTMLButtonElement = <HTMLButtonElement>document.getElementById("startBtn");
    function main(): void {

        startBtn.className = "";

        //UI dependent code for prototype only
        startBtn.addEventListener("click", startGame);
        //saveButton.addEventListener("click", saveGame);
        //saveButton.addEventListener("touch", saveGame);
        //loadButton.addEventListener("click", loadGame);
        //clearButton.addEventListener("click", clearGame);

    }

    function startGame(e: Event): void {
        startBtn.disabled = true;
        onAction("startgame");
    }
    let caseDecider: string;



    function speakFacing(slot: Interactable): void {
        if (slot.facingSound.length == 0) {
            speak(slot.name);
            return;
        }
        if (slot.facingSound.length > 1) {
            currentlyPlayingSound = slot.facingSound[gameInstance.currentCharacter.soundArrayIndex];
            playSound(slot.facingSound[gameInstance.currentCharacter.soundArrayIndex]);

        } else {
            currentlyPlayingSound = slot.facingSound[0];
            playSound(slot.facingSound[0]);
        }

    }

    function speakDiscover(slot: Interactable): void {
        if (slot.alreadySeen) {
            speakFacing(slot);
        } else {
            if (slot.discoverSound.length == 0) {
                speakFacing(slot);
            }
            if (slot.discoverSound.length > 1) {
                currentlyPlayingSound = slot.discoverSound[gameInstance.currentCharacter.soundArrayIndex];
                playSound(slot.discoverSound[gameInstance.currentCharacter.soundArrayIndex]);
            } else {
                if (slot.facingSound.length > 1) {
                    speakFacing(slot);
                } else {
                    currentlyPlayingSound = slot.discoverSound[0];
                    playSound(slot.discoverSound[0]);
                }

            }
            slot.alreadySeen = true;
        }
    }


    function handleCombination(): void {
        let currentInventory: Inventory = gameInstance.currentCharacter.inventory;
        if (gameInstance.combiningItem == undefined) {
            //play combination starting sound
            gameInstance.combiningItem = currentInventory.getFocusedItem();
            speak("ich will " + gameInstance.combiningItem.name + " kombinieren");
        } else {
            let selectedItem: string = currentInventory.getFocusedItem().itemID;
            let combineItem: string = gameInstance.combiningItem.itemID;
            if (combineItem == selectedItem) {
                if (gameInstance.currentCharacter.combinationNotPossibleSound) {
                    speak(gameInstance.currentCharacter.combinationNotPossibleSound);
                } else {
                    speak("dass scheint nicht zu funktionieren");
                }
                gameInstance.combiningItem = undefined;
            }
            else if (!gameInstance.combinationsMap.has(selectedItem) || !gameInstance.combinationsMap.has(combineItem)) {
                if (gameInstance.currentCharacter.combinationNotPossibleSound) {
                    speak(gameInstance.currentCharacter.combinationNotPossibleSound);
                } else {
                    speak("dass scheint nicht zu funktionieren");
                }
                gameInstance.combiningItem = undefined;
            }
            else {
                if (gameInstance.combinationsMap.get(combineItem) != gameInstance.combinationsMap.get(selectedItem)) {
                    if (gameInstance.currentCharacter.combinationNotPossibleSound) {
                        speak(gameInstance.currentCharacter.combinationNotPossibleSound);
                    } else {
                        speak("dass lässt sich nicht kombinieren");
                    }
                } else {
                    let aquiredItem: Item = gameInstance.obtainableItemMap.get(gameInstance.combinationsMap.get(combineItem));
                    speak("ich habe" + gameInstance.combiningItem.name + "mit" + currentInventory.getFocusedItem().name + " kombiniert und erhalte:"
                        + aquiredItem.name);
                    currentInventory.items.unshift(aquiredItem);
                    currentInventory.removeItem(selectedItem);
                    currentInventory.removeItem(combineItem);
                    currentInventory.focusedItemIndex = 0;
                    thingDescriberText = currentInventory.getFocusedItem().name;
                    gameInstance.combiningItem = undefined;
                }
            }
        }
    }

    let gameStarted: boolean = false;





    export function onAction(_action: string): void {
        cancelVoiceIfSpeaking();
        switch (gameInstance.gameState) {
            case GAME_STATE.MENU:
                if (_action == "startgame") {
                    thingDescriberText = gameInstance.currentRoom.getFocusedSlot().name;
                    speakDiscover(gameInstance.currentRoom.getFocusedSlot());

                    //speak(thingDescriberText);
                    playSound(gameInstance.currentRoom.atmoSound, true);
                    addFilter(gameInstance.currentRoom.atmoSound, atmoLPFilter);
                    let preElements: HTMLElement = document.getElementById("preGrameElements");
                    preElements.className = "invisible";
                    document.getElementById("screen").className = "";
                    gameInstance.gameState = GAME_STATE.PLAYING;

                }
                break;
            case GAME_STATE.PLAYING:

                if (!gameStarted) {
                    gameStarted = true;
                }
                if (_action == "left") {
                    if (audioSourceMap.get(currentlyPlayingSound) != undefined) {
                        let playingSource: AudioBufferSourceNode = audioSourceMap.get(currentlyPlayingSound);
                        playingSource.stop();
                    }


                    gameInstance.currentRoom.nextSlotLeft();


                    //gameInstance.currentRoom.slots[gameInstance.currentRoom.focusedSlotIndex];
                    //speakFacing(gameInstance.currentRoom.getFocusedSlot());
                    //speak(gameInstance.currentRoom.getFocusedSlot().name);
                    thingDescriberText = gameInstance.currentRoom.getFocusedSlot().name;
                } else if (_action == "right") {
                    if (audioSourceMap.get(currentlyPlayingSound) != undefined) {
                        let playingSource: AudioBufferSourceNode = audioSourceMap.get(currentlyPlayingSound);
                        playingSource.stop();
                    }
                    /*if (audioSourceMap.get(gameInstance.currentRoom.getFocusedSlot().discoverSound) != undefined) {
                        let playingSource: AudioBufferSourceNode = audioSourceMap.get(gameInstance.currentRoom.getFocusedSlot().discoverSound);
                        playingSource.stop();
                    }*/

                    gameInstance.currentRoom.nextSlotRight();
                    //speakFacing(gameInstance.currentRoom.getFocusedSlot());
                    //speak(gameInstance.currentRoom.getFocusedSlot().name);
                    thingDescriberText = gameInstance.currentRoom.getFocusedSlot().name;
                } else if (_action == "up") {
                    if (audioSourceMap.get(currentlyPlayingSound) != undefined) {
                        let playingSource: AudioBufferSourceNode = audioSourceMap.get(currentlyPlayingSound);
                        playingSource.stop();
                    }
                    let slot: Interactable = gameInstance.currentRoom.getFocusedSlot();
                    slot.interact();
                    if (slot.toJSON().type == "Portal") {
                        thingDescriberText = gameInstance.currentRoom.getFocusedSlot().name;
                    }

                } else if (_action == "down") {
                    if (audioSourceMap.get(currentlyPlayingSound) != undefined) {
                        let playingSource: AudioBufferSourceNode = audioSourceMap.get(currentlyPlayingSound);
                        playingSource.stop();
                    }
                    if (gameInstance.currentCharacter.inventory.isEmpty()) {
                        if (gameInstance.currentCharacter.inventoryEmptySound) {
                            speak(gameInstance.currentCharacter.inventoryEmptySound);
                        } else {
                            speak("Es befindet sich nichts im Inventar");
                        }

                    }
                    else {
                        gameInstance.gameState = GAME_STATE.INVENTORY;
                        playSound(gameInstance.currentCharacter.inventoryOpenSound);
                        //set dämpfung
                        atmoLPFilter.frequency.setValueAtTime(320, audioContext.currentTime + 0.2);
                        let currentItem: Item = gameInstance.currentCharacter.inventory.items[gameInstance.currentCharacter.inventory.focusedItemIndex];
                        let currentItemName: string = gameInstance.currentCharacter.inventory.items[gameInstance.currentCharacter.inventory.focusedItemIndex].name;
                        thingDescriberText = currentItemName;
                        if (currentItem.itemSound) {
                            speak(currentItem.itemSound);
                        } else {
                            speak(currentItemName);
                        }

                    }
                } else if (_action == "doubletap") {
                    if (gameInstance.currentCharacter.equippedItem == undefined) {
                        speak("Ich habe nichts in der Hand");
                        thingDescriberText = gameInstance.currentRoom.getFocusedSlot().name;
                    }
                    else {
                        speak(gameInstance.currentRoom.getFocusedSlot().useItem(gameInstance.currentCharacter.equippedItem));
                        thingDescriberText = gameInstance.currentRoom.getFocusedSlot().name;
                    }
                }
                break;
            case GAME_STATE.INVENTORY:
                let currentInventory: Inventory = gameInstance.currentCharacter.inventory;
                if (audioSourceMap.get(currentlyPlayingSound) != undefined) {
                    let playingSource: AudioBufferSourceNode = audioSourceMap.get(currentlyPlayingSound);
                    playingSource.stop();
                }

                if (_action == "left") {
                    currentInventory.nextItemLeft();
                    if (currentInventory.getFocusedItem().itemSound) {
                        speak(currentInventory.getFocusedItem().itemSound);
                    } else {
                        speak(currentInventory.getFocusedItem().name);
                    }

                    thingDescriberText = currentInventory.getFocusedItem().name;
                } else if (_action == "right") {
                    currentInventory.nextItemRight();
                    if (currentInventory.getFocusedItem().itemSound) {
                        speak(currentInventory.getFocusedItem().itemSound);
                    } else {
                        speak(currentInventory.getFocusedItem().name);
                    }

                    thingDescriberText = currentInventory.getFocusedItem().name;
                } else if (_action == "up") {
                    if (gameInstance.combiningItem == undefined) {
                        playSound(gameInstance.currentCharacter.inventoryCloseSound);
                        //remove dämpfung
                        atmoLPFilter.frequency.setValueAtTime(20000, audioContext.currentTime + 0.2);
                        gameInstance.gameState = GAME_STATE.PLAYING;
                        thingDescriberText = gameInstance.currentRoom.getFocusedSlot().name;

                    } else {
                        gameInstance.combiningItem = undefined;
                        speak("ich will doch nichts kombinieren");
                    }
                } else if (_action == "down") {
                    handleCombination();
                } else if (_action == "doubletap") {
                    gameInstance.currentCharacter.equippedItem = currentInventory.getFocusedItem();
                    speak(" ich nehme" + currentInventory.getFocusedItem().name + " in die Hand.");
                    thingDescriberText = currentInventory.getFocusedItem().name;
                }
                else if (_action != "") {
                    let itemList: Item[] = currentInventory.items;
                    for (let idx: number = 0; idx < itemList.length; idx++) {
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
                let currentContainer: Container = <Container>gameInstance.currentRoom.getFocusedSlot();
                if (_action == "left") {
                    currentContainer.nextItemLeft();
                    //speak(currentContainer.getFocusedItem().name);
                    thingDescriberText = currentContainer.getFocusedItem().name;
                } else if (_action == "right") {
                    currentContainer.nextItemRight();
                    //speak(currentContainer.getFocusedItem().name);
                    thingDescriberText = currentContainer.getFocusedItem().name;
                } else if (_action == "up") {
                    /*if (!currentContainer.getFocusedItem().isOpen) {
                        speak("ich kann dieses item nicht aufheben");
                        return;
                    }*/

                    currentContainer.getFocusedItem().interact();
                    //speak("ich nehme mir" + currentContainer.getFocusedItem().name);



                    if (currentContainer.containerItems.length == 0) {

                        gameInstance.gameState = GAME_STATE.PLAYING;
                        thingDescriberText = currentContainer.name;
                    } else {
                        thingDescriberText = currentContainer.getFocusedItem().name;
                    }
                } else if (_action == "down") {
                    gameInstance.gameState = GAME_STATE.PLAYING;
                    thingDescriberText = currentContainer.name;
                }
                break;

            case GAME_STATE.SEARCHING:

                let regExSearch: RegExp = new RegExp(/^(search,)\d*(,)\d+$/);
                let regExDT: RegExp = new RegExp(/^(doubletap,)\d*(,)\d+$/);
                let currentPosArray: string[] = _action.split(",");
                let currentX: number = parseInt(currentPosArray[1]);
                let currentY: number = parseInt(currentPosArray[2]);

                if ((regExSearch.test(_action)) && (!hasFoundSpoken)) {
                    caseDecider = "search";

                }
                else if (regExDT.test(_action) && (hasFoundSpoken)) {
                    caseDecider = "doubletap";
                }
                for (let i: number = 0; i < gameInstance.currentSearchField.hints.length; i++) {
                    let currentHint: SearchHint = gameInstance.searchHintMap.get(gameInstance.currentSearchField.hints[i]);
                    let distance: number = Math.sqrt(Math.pow((currentX - currentHint.positionX), 2) +
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
                                if (gameInstance.currentSearchField.correctHint == currentHint.hintID) {
                                    atmoLPFilter.frequency.setValueAtTime(20000, audioContext.currentTime + 0.2);
                                    gameInstance.gameState = GAME_STATE.PLAYING;
                                    thingDescriberText = gameInstance.currentRoom.getFocusedSlot().name;
                                } else {
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


                let inputArray: string[] = _action.split(",");
                let velocity: number = parseFloat(inputArray[1]);
                let distanceX: number = parseFloat(inputArray[2]);
                let distanceY: number = parseFloat(inputArray[3]);

                if (inputArray[0] == "panend") {
                    if (distanceY >= -400) {
                        cancelVoiceIfSpeaking();
                        speak("mist nicht weit genug. Ich sollte es nächstes mal weiter versuchen");
                        gameInstance.gameState = GAME_STATE.PLAYING;
                        return;
                    }
                }

                if (inputArray[0] != "pan") {
                    return;
                }

                if (velocity <= -0.125) {
                    cancelVoiceIfSpeaking();
                    speak("mist zu schnell. Ich sollte es nächstes mal langsamer versuchen");
                    gameInstance.gameState = GAME_STATE.PLAYING;
                    return;
                }

                if (Math.abs(distanceX) >= 40) {
                    cancelVoiceIfSpeaking();
                    speak("mist zu schräg. Ich sollte es nächstes mal gerader versuchen");
                    gameInstance.gameState = GAME_STATE.PLAYING;
                    return;
                }

                let minHeight: number = window.innerHeight * 0.6;
                if (distanceY <= - 400) {
                    cancelVoiceIfSpeaking();
                    speak("hurra, ich habe es geschafft EZ");
                    gameInstance.gameState = GAME_STATE.PLAYING;
                    return;
                }
                break;
        }

        thingDescriber.textContent = thingDescriberText;
    }




    function cancelVoiceIfSpeaking(): void {
        let synth: SpeechSynthesis = window.speechSynthesis;
        if (synth.speaking && gameInstance.gameState != GAME_STATE.SEARCHING) {
            synth.cancel();
        } else if (synth.speaking && caseDecider.startsWith("double")) {
            synth.cancel();
        }
    }


    function speak(_inputTxt: string): void {
        let synth: SpeechSynthesis = window.speechSynthesis;
        if (synth.speaking) {
            //console.error("speechSynthesis.speaking");
            return;
        }
        if (_inputTxt.includes("mp3")) {
            playSound(_inputTxt);
            currentlyPlayingSound = _inputTxt;
        } else if (_inputTxt != " ") {
            let utterThis: SpeechSynthesisUtterance = new SpeechSynthesisUtterance(_inputTxt);

            utterThis.lang = "de-DE";

            synth.speak(utterThis);
        }
    }
}