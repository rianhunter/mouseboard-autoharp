
/* like autokalimba but specifically for mouse and keyboard
  rather than touch, and has automatic voice leading */

const BASE_FREQ = 261.625/2;
const N_VOICES_PER_INSTRUMENT = 4;

/* "application state", things that can change over the course of execution */
const MOUSEBOARD_STATE = 
  { "basspads":  undefined
  , "chordplayers": undefined
  , "drummer": undefined /* NEW (after autocomposer) a bossa nova drum kit */
  , "bassNoteSelected": {"label": "F", "cents": 500, "circleOfFifthsIndex": 0}
    /* ^ this isn't shown in chorddisplay but is used in setting the other ones
     * correctly. This will also be edited live by the autocomposer to play its
     * chords. */
  , "info_bassNotePlaying": ""
  , "info_bassNoteImpliedByVoicing": ""
  , "info_voicing": ""
    /* layout config */
  , "basspadLayout": "circle"
  , "voicingPadsShown": false
    /* this is just for disabling transform transitions on touch, bc theyre laggy */
  , "isTouchscreen": false
  };

function centsToRatio(c) {
    return Math.pow(2, (c / 1200));
}

function updateChordDisplay() {
    const chordSymbolDisplay = document.getElementById("chord-symbol-display");
    chordSymbolDisplay.textContent = "";
    
    const playingBassElem = document.createElement("strong"); /* clicked via the bass-only key */
    const impliedBassElem = document.createElement("strong"); /* activated whenever a voicing plays (the bass note implied by that voicing) */
    const voicingElem = document.createElement("span");
    
    /* the selected bass is the most recently hovered-on bass note. 
    It may be different from the bass note that is actually playing (which may 
    have been held from earlier), stored in MOUSEBOARD_STATE.info_bassNotePlaying, and
    different from the bass note implied by the voicing that is playing (which
    is the selected bass note from when the voicing was triggered, stored in 
    MOUSEBOARD_STATE.info_bassNoteImpliedByVoicing.)
    MOUSEBOARD_STATE.info_voicing is empty when no voicing is currently played.
    */
    impliedBassElem.append(MOUSEBOARD_STATE.info_bassNoteImpliedByVoicing);
    playingBassElem.append(MOUSEBOARD_STATE.info_bassNotePlaying);
    voicingElem.append(MOUSEBOARD_STATE.info_voicing);
    let longVoicing = false;
    if (MOUSEBOARD_STATE.info_voicing.length > 3) {
        voicingElem.style.fontSize = "calc(min(80pt, 12vw))";
        voicingElem.style.lineHeight = "1.1rem";
        longVoicing = true;
    }

    if (MOUSEBOARD_STATE.info_bassNoteImpliedByVoicing === MOUSEBOARD_STATE.info_bassNotePlaying) {
        chordSymbolDisplay.append(playingBassElem, voicingElem);
    }
    else {
        if (longVoicing) {
            playingBassElem.style.fontSize = "calc(min(80pt, 12vw))";
        }
        chordSymbolDisplay.append(impliedBassElem, voicingElem, (MOUSEBOARD_STATE.info_bassNotePlaying === "" ? "" : "/"), playingBassElem);
    }
    
    playingBassElem.style.color = MOUSEBOARD_STATE.info_bassNotePlaying === "" ? "lightgray" : "mediumslateblue";
    voicingElem.style.color = MOUSEBOARD_STATE.info_voicing === "" ? "lightgray" : "mediumslateblue";
    impliedBassElem.style.color = "lightgray";
}


/* timbre */
/* useful docs about time https://github.com/Tonejs/Tone.js/wiki/Time 
  changing envelope of Synth(): https://tonejs.github.io/docs/14.7.77/Synth#envelope
  https://tonejs.github.io/docs/14.7.77/AmplitudeEnvelope 
*/
// const BASE_MEOW_FILTER = 400;
// const MEOW_FILTER_MAX_INCREASE = 600;
/*
class Meowsynth {
    constructor() {
        this.volumeNode = new Tone.Volume(-12).toDestination();
        this.filterNode = new Tone.Filter(BASE_MEOW_FILTER, "lowpass").connect(this.volumeNode);
        this.synth = new Tone.Synth().connect(this.filterNode); 
        this.synth.oscillator.type = "sawtooth";
        
        const mult = new Tone.Multiply();
        const add = new Tone.Add();
        this.filterFreqBase = new Tone.Signal(BASE_MEOW_FILTER, "frequency");
        this.filterFreqIncrease = new Tone.Signal(MEOW_FILTER_MAX_INCREASE, "frequency"); // updated by tilt
        this.meowEnvelopeNode = new Tone.Envelope(0.001, 0, 1, 0.08); // triggered by touch/click

        this.filterFreqIncrease.connect(mult);
        this.meowEnvelopeNode.connect(mult.factor);

        mult.connect(add);
        this.filterFreqBase.connect(add.addend);
        
        add.connect(this.filterNode.frequency);

        this.synth.envelope.attack = 0.001;
        this.synth.envelope.decay = 0;
        this.synth.envelope.sustain = 1.0;
        this.synth.envelope.release = 0.08; // long release

    }
    on(f, velocity, scheduledDuration=undefined, scheduledTime=undefined) {
        if ((scheduledDuration === undefined) || (scheduledTime === undefined)) {
            this.synth.triggerAttack(f, "+0", velocity);
            this.meowEnvelopeNode.triggerAttack("+0");
        }
        else {
            this.synth.triggerAttackRelease(f, scheduledDuration, scheduledTime, velocity);
            this.meowEnvelopeNode.triggerAttackRelease(scheduledDuration, scheduledTime);
        }
    }
    off() {
        this.synth.triggerRelease();
        this.meowEnvelopeNode.triggerRelease("0");
    } 
    sync() {
        this.synth.sync();
        this.meowEnvelopeNode.sync();
    }
    unsync() {
        this.synth.unsync();
        this.meowEnvelopeNode.unsync();
    }
}
*/
class ToneInstrument {
    on(f, velocity, scheduledDuration=undefined, scheduledTime=undefined) {
        if ((scheduledDuration === undefined) || (scheduledTime === undefined)) {
            this.synth.triggerAttack(f, "+0", velocity);    
        }
        else {
            this.synth.triggerAttackRelease(f, scheduledDuration, scheduledTime, velocity);
        }
        
    }
    off() {
        this.synth.triggerRelease("+0");
    }
    sync() {
        this.synth.sync();
    }
    unsync() {
        this.synth.unsync();
    }
}

class ElecPiano extends ToneInstrument {
    constructor() {
        super();
        this.volumeNode = new Tone.Volume(-2).toDestination();
        this.filterNode = new Tone.Filter(2200, "lowpass").connect(this.volumeNode);
        this.synth = new Tone.FMSynth({
            "harmonicity":3,
            "modulationIndex": 14,
            "oscillator" : {
                "type": "sine"
            },
            "envelope": {
                "attack": 0.001,
                "decay": 1.6,
                "sustain": 0.2,
                "release": 2
            },
            "modulation" : {
                "type" : "sine"
            },
            "modulationEnvelope" : {
                "attack": 0.002,
                "decay": 0.2,
                "sustain": 0,
                "release": 0.2
            }
        }).connect(this.filterNode);
    }
} 

class SawBass extends ToneInstrument {
    constructor() {
        super();
        this.volumeNode = new Tone.Volume(-11).toDestination();
        this.filterNode = new Tone.Filter(500, "lowpass").connect(this.volumeNode);
        this.synth = new Tone.Synth().connect(this.filterNode); 
        this.synth.oscillator.type = "sawtooth";

        this.synth.envelope.attack = 0.01;
        this.synth.envelope.decay = 0.8;
        this.synth.envelope.sustain = 0.5;
        this.synth.envelope.release = 0.1;
    }
}

class AMBass extends ToneInstrument {
    constructor() {
        super();
        this.volumeNode = new Tone.Volume(9.5).toDestination();
        this.synth = new Tone.AMSynth({
            "harmonicity": 2,
            "oscillator": {
                "type": "amsine2",
                  "modulationType" : "sine",
                  "harmonicity": 3
            },
            "envelope": {
                "attack": 0.006,
                "decay": 4,
                "sustain": 0.04,
                "release": 0.5
            },
            "modulation" : {
                  "volume" : 12,
                "type": "amsine2",
                  "modulationType" : "sine",
                  "harmonicity": 2
            },
            "modulationEnvelope" : {
                "attack": 0.006,
                "decay": 0.2,
                "sustain": 0.2,
                "release": 0.4
            }
        }).connect(this.volumeNode);
    }
}

class BossaDrumKit extends ToneInstrument {
    constructor() {
        super();
        this.loaded = false;
        this.volumeNode = new Tone.Volume(-12).toDestination();
        this.synth = new Tone.Sampler({
            "urls": {
                "A1": __DATAURL_PERC_KICK_ELEC,
                "A2": __DATAURL_PERC_SHAKER,
                "A3": __DATAURL_PERC_
            },
            "onload": () => { this.loaded = true; }
        }).connect(this.volumeNode);
        this.keys = {
            "kick": "A1",
            "shaker": "A2",
            "stick": "A3"
        };
    }
    on(f, velocity, scheduledDuration=undefined, scheduledTime=undefined) {
        const samplerNote = this.keys[f];
        return super.on(samplerNote, velocity, scheduledDuration, scheduledTime);
    }
}


class Voice {
    constructor(instrument) {
        this.instrument = instrument;
        this.lastPlayedCents = undefined;
    }
    on(cents, velocity=1, scheduledDuration=undefined, scheduledTime=undefined) {
        this.instrument.on(BASE_FREQ * centsToRatio(cents), velocity, scheduledDuration, scheduledTime);
    }
    off() {
        this.instrument.off();
    }
}

/* a Chordplayer is a set of voices that are triggered at the same time  */
class Chordplayer {
    constructor(synthName, nVoices=N_VOICES_PER_INSTRUMENT, autoVoiceLeadingMode) {
        /* voice leading modes include "updown" and "down". "updown" mode can
         * pick a voice either an octave above or below the requested frequency;
         * "down" mode can only pick the frequency below. Good for bass voices.
         * */
        
        this.nVoices = nVoices;
        this.voices = new Array(nVoices);
        this.autoVoiceLeadingMode = autoVoiceLeadingMode;
        this.bassCents = MOUSEBOARD_STATE.bassNoteSelected.cents;
        for (let i = 0; i < nVoices; i++) {
            let synth;
            if (synthName === "meowsynth") {
                synth = new Meowsynth();
            }
            else if (synthName === "elecpiano") {
                synth = new ElecPiano();
            }
            else if (synthName === "sawbass") {
                synth = new SawBass();
            }
            else if (synthName === "ambass") {
                synth = new AMBass();
            }
            this.voices[i] = new Voice(synth);
        }
        this.currentlyPlayingDueToTrigger = undefined; 
        /* can be a keyboard key name or maybe touch button ID if present.
        * Needed to know which chordplayers to turn off when a key is released.
        * */

        /* voice leading state */

        /* the point of this one is to not change/recalculate a voiceled voicing
         * if the same trigger key /voicing is requested >=twice in a row, and
         * instead just reuse lastPlayedCents */
        this.lastRequestedKeyForVoiceleadPurposes = undefined;
        this.lastPlayedCents = undefined;
    }
    wholeChordOctaveAdjustment(cents) {
        if (this.lastPlayedCents === undefined) {
            return cents;
        }
        /* this is a weaker substitute for autoVoiceLeading for voicings that do
         * not otherwise use AVL. this will just octave-shift the whole
         * chord such that the top note diff is minimimzed; distances between
         * chord tones remains as specified in the voicing dict. Assumes cents
         * is sorted */
        const topNoteIdx = cents.filter(u => u !== undefined).length - 1;
        const lastPlayedTopCents = (cs => cs[cs.length - 1])(this.lastPlayedCents.filter(u => u !== undefined));
        const tries = [cents.map(c => c === undefined ? c : c + 1200), cents, cents.map(c => c === undefined ? c : c - 1200)]
        const topNoteDists = tries.map(cs => Math.abs(cs[topNoteIdx] - lastPlayedTopCents));
        const result = tries[topNoteDists.indexOf(Math.min(...topNoteDists))];
        return result;
    }
    autoVoiceLeading(cents, overrideVoiceLeadingMode=undefined) {
        if (this.lastPlayedCents === undefined) {
            return cents;
        }
        let voiceLeadingModeToUse = 
            overrideVoiceLeadingMode ? overrideVoiceLeadingMode : this.autoVoiceLeadingMode;
        
        if (voiceLeadingModeToUse === "keep") { // keep intervals, shift octaves for all voices
            return this.wholeChordOctaveAdjustment(cents);
        }
        /* we know that lastPlayedCents is sorted from low to high. build a 2D
         * array where the rows (subarrays) are each previous note and the cols
         * (elems in the subarrays) are each incoming note. Each cell [r][c] is
         * the min voiceleading distance from new note c to prev note r. We then
         * greedily select the min of these [r][c] values from top voice to
         * bottom
         */
        const downOnly = voiceLeadingModeToUse === "down";
        
        const a = Array(this.nVoices);
        for (let r = 0; r < this.nVoices; r++) {
            a[r] = { "minDists": Array(this.nVoices), "centValues": Array(this.nVoices) };
            for (let c = 0; c < this.nVoices; c++) {
                const itvl = cents[c];
                if (itvl === undefined) {
                    a[r].minDists[c] = undefined;
                    a[r].centValues[c] = undefined;
                    continue;
                }
                const last = this.lastPlayedCents[r];
                if (last === undefined) {
                    a[r].minDists[c] = 0;
                    a[r].centValues[c] = itvl;
                    continue;
                }
                const tries = downOnly ? [itvl-1200, itvl]
                                       : [itvl-1200, itvl, itvl+1200];
                const dists = tries.map(c => Math.abs(c - last));
                const minDist = Math.min(...dists);
                a[r].minDists[c] = minDist;
                a[r].centValues[c] = tries[dists.indexOf(minDist)];
            }
        }

        /* then scan through from highest prev-note to lowest */
        const assigned = Array(this.nVoices).fill(false);
        const result = Array(this.nVoices);
        for (let r = this.nVoices-1; r >= 0; r--) {
            if (r === this.nVoices - 1) {
                // first iteration, pick the centValue with the smallest of all minDists
                const i = a[r].minDists.indexOf(Math.min(...a[r].minDists.filter(u => u !== undefined)));
                result[r] = a[r].centValues[i];
                assigned[i] = true;
            }
            else {
                const argsortedIndices = Array.from(a[r].minDists.entries()).sort((a, b) => a[1] - b[1]).map(tup => tup[0]);
                for (const i in argsortedIndices) {
                    if (assigned[i]) {
                        continue;
                    }
                    else {
                        result[r] = a[r].centValues[i];
                        assigned[i] = true;
                        break;
                    }
                }
            }
        }

        /* heuristic: postprocess the results */
        result.sort((a, b) => a - b);
        const nNotes = result.filter(u => u !== undefined).length;
        const topNote = result[nNotes-1];
        const mean = result.reduce((a, x) => a + x) / nNotes;
        for (const i in result) {
            const c = result[i];
            const voiceDown = () => {
                result[i] -= 1200;
            }
            const voiceUp = () => {
                if ((c + 1200) < (topNote + 1000)) {
                    result[i] += 1200; 
                }
            }
            const diff = (i > 0 && c !== undefined) ? c - result[i-1] : undefined;
            if ((c < 0) || (mean < 1000 && c <= 700)) {
                /* heuristic: avoid too many notes that are too low (negative,
                or mean cents too low) */
                voiceUp();
                // console.log("heur: avoid low");
            }
            else if (mean > 1800 && (c > 2100)) {
                /* heuristic: avoid too many notes too high (mean too high,
                demote some super high outliers) */
                voiceDown();
                // console.log("heur: avoid high");
            }
            else if (diff <= 100 && (c % 1200 !== 0)) {
                /* heuristic: avoid <minor 2nds unless it's between the major 7
                and the I */
                // console.log("heur: avoid m2")
                voiceDown(); 
                /* no voiceUp option here, that would make an augmented octave
                 * which is even crunchier... */
            }
            else if ((c - mean) > 1200) {
                /* heuristic: adjust voices that are too outlying compared to the
                mean cents */
                // console.log("heur: dist to mean down ")
                voiceDown();
            }
            else if ((mean - c) > 1200) {
                // console.log("heur: dist to mean up")
                voiceUp();
            }
        }
        return result;
    }
    on(triggeredBy, intervals, bassCents=undefined, velocity=1, doAutoVoiceLeading=true, scheduledDuration=undefined, scheduledTime=undefined) {
        if (intervals.length === 0 || this.currentlyPlayingDueToTrigger !== undefined) {
            /* still playing, suppress new input */
            return false;
        }
        /* the "currentlyPlayingDueToTrigger" is only relevant if triggered by
         * keyboard, NOT when scheduled via other code (related to calledManually) */
        if (scheduledDuration === undefined || scheduledTime === undefined) {
            this.currentlyPlayingDueToTrigger = triggeredBy;
        }
        
        /* bassCents: bass note pitch, given in terms of cents relative to
         * BASE_FREQ. this class stores its "current" bass pitch but this
         * function can also be called with something other than this.bassCents
         * for flexibility */
        if (bassCents === undefined) {
            bassCents = this.bassCents;
        }
        let centsToPlay = intervals.map(u => u === undefined ? u : u + bassCents).sort((a, b) => a - b);
        if (triggeredBy === this.lastRequestedKeyForVoiceleadPurposes) {
            centsToPlay = this.lastPlayedCents;
        }
        else {
            centsToPlay = doAutoVoiceLeading ? this.autoVoiceLeading(centsToPlay, doAutoVoiceLeading) : centsToPlay; 
        }
        
        
        for (let i = 0; i < this.nVoices; i++) {
            const cents = centsToPlay[i];
            if (cents !== undefined) {
                this.voices[i].on(cents, velocity, scheduledDuration, scheduledTime);
            }
        }
        this.lastPlayedCents = centsToPlay;
        this.lastPlayedCents.sort((a, b) => a - b);
        this.lastRequestedKeyForVoiceleadPurposes = triggeredBy;
        return true;
    }
    off(triggeredBy) {
        /* returns true if this turned off due to this input trigger event */
        if (triggeredBy === this.currentlyPlayingDueToTrigger) {
            for (const i in this.voices) {
                this.voices[i].off();
            }
            this.currentlyPlayingDueToTrigger = undefined;
            return true;
        }
        return false;
    }
    sync() {
        for (const i in this.voices) {
            this.voices[i].instrument.sync();
        }
    }
    unsync() {
        for (const i in this.voices) {
            this.voices[i].instrument.unsync();
        }
    }
    setBass(cents) {
        this.bassCents = cents;
        this.lastRequestedKeyForVoiceleadPurposes = undefined;
    }
    resetVoiceLeadingMemory() {
        this.lastRequestedKeyForVoiceleadPurposes = undefined;
        this.lastPlayedCents = undefined;
    }
}

function globallySelectNewBass(circleOfFifthsIndex) {
    const {label, cents} = circleOfFifthsQueryFn(circleOfFifthsIndex);
    MOUSEBOARD_STATE.chordplayers.bass.setBass(cents);
    MOUSEBOARD_STATE.chordplayers.chord.setBass(cents);
    
    MOUSEBOARD_STATE.bassNoteSelected.label = label;
    MOUSEBOARD_STATE.bassNoteSelected.cents = cents; 
    MOUSEBOARD_STATE.bassNoteSelected.circleOfFifthsIndex = normalizeCircleOfFifthsIndex(circleOfFifthsIndex);
    return MOUSEBOARD_STATE.bassNoteSelected;
}

/* A basspad represents a hoverable pad labeled with a bass note. On hover it 
 will change the bass note of the chordplayers to the labeled note. */
class Basspad {
    constructor(circleOfFifthsIndex, label, cents, element) {
        this.circleOfFifthsIndex = circleOfFifthsIndex;
        this.label = label;
        this.cents = cents;
        this.element = element;  /* the html element for this basspad*/
        /* while autocomposer is playing, hovering should not do anything, only
        click and touchstart should */
        this.hoverEventEnabled = true; 

        const pointerEnter = e => {
            this.select(this);
            if (e.pointerType !== "mouse") {
                if (this.hoverEventEnabled) {
                    this.element.classList.add("pad-clicked");
                    ChordTriggers.on("z", true);
                }
                else {
                    this.element.classList.add("pad-clicked");
                }
            }
        }
        const pointerLeave = e => {
            if (e.pointerType !== "mouse") {
                this.element.classList.remove("pad-highlight");
                this.element.classList.remove("pad-clicked");
                ChordTriggers.off("z", true);
            }
        }
        this.element.addEventListener("pointerenter", pointerEnter);
        this.element.addEventListener("touchstart", e => e.preventDefault());
        this.element.addEventListener("pointerleave", pointerLeave);
        this.element.addEventListener("pointercancel", pointerLeave);
    }

    select(self) {
        if (!self.hoverEventEnabled) {
            return;
        }
        /* activates on hover... changes the current bass note of the
        chordplayers to the pad's cents */
        const {label, cents, _} = globallySelectNewBass(self.circleOfFifthsIndex);
        self.label = label;
        self.cents = cents;
        /* The idea is that a basspad can have its label and cents be
        dynamically changed depending on what the circle-of-fifths query
        function returns (i.e. can dynamically adjust cents based on last played
        bass or voices for instance), but the basspad's circle-of-fifths index
        should never change (i.e. its meaning and position in the circle of
        fifths stays constant, only its label and cent value may change.) This
        all relies on how the circleOfFifthsQueryFn is implemented of course,
        but it should give consistency of some form to the same basspad selected
        at different points in time */
    }
}

/* hidden:true means that the voicing is not available for manual key triggering 
 * (but is available for invoking via code)*/
const KEYBOARD_TO_VOICING_MAP = 
  { "z": {"name": "", "bass": [-1200], "chord": [], "voicelead": false, "hidden": false}
  , "a": {"name": "", "bass": [-1700], "chord": [], "voicelead": false, "hidden": true}
  , "x": {"name": "m7", "bass": [], "chord": [0, 300, 700, 1000], "voicelead":true, "hidden": false}
  , "c": {"name": "7", "bass": [], "chord": [0, undefined, 1000, 1600], "voicelead": true, "hidden": false}
  , "v": {"name": "M7", "bass": [], "chord": [0, 1200+400, 700, 1100], "voicelead": true, "hidden": false}
  , "b": {"name": "sus13", "bass": [], "chord": [1000, 0, 1700, 2100], "voicelead": true, "hidden": false}
  , "s": {"name": "m9", "bass": [], "chord": [1900-1200, 1000, 1400, 1500 ], "voicelead": true, "hidden": false}
  , "d": {"name": "9", "bass": [], "chord": [0,400, 1000, 1400-1200], "voicelead": true, "hidden": false}
  , "f": {"name": "M9", "bass": [], "chord": [1900-1200, 1100, 1400, 1600 ], "voicelead": true, "hidden": false}
  , "g": {"name": "13", "bass": [], "chord": [0, 1000, 1600, 2100], "voicelead": true, "hidden": false}
  , "h": {"name": "m7♭5", "bass": [], "chord": [0, 600, 1000, 300+1200], "voicelead": false, "hidden": false}
  , "q": {"name": "(II/)", "bass": [], "chord": [0, 600, 900, 1400], "voicelead": true, "hidden": false}
  , "w": {"name": "dim", "bass": [], "chord": [0, 300, 600, 900], "voicelead": true, "hidden": false}
  , "e": {"name": "aug", "bass": [], "chord": [0, 400, 800, 1200], "voicelead": true, "hidden": false}
  , "r": {"name": "7♭9", "bass": [], "chord": [undefined, 400, 1000, 1300], "voicelead": true, "hidden": false}
  , "t": {"name": "7♯9", "bass": [], "chord": [undefined, 400, 1000, 1500], "voicelead": "keep", "hidden": false} /* alt */
  , "y": {"name": "7♯5", "bass": [], "chord": [undefined, 800, 1000, 1600], "voicelead": true, "hidden": false}
  }

class ChordTriggers {
    /* handles listening to both keyboard and touchscreen button events (todo)
      to trigger chords... also defines the mapping from keyboard button/touchj
      button to voicings (maj7, min7, dom7, etc) Also also handles info display
      based on the bass and chords selected
    */
    static init() {
        console.log("initialized keyboard chord triggers");
        document.addEventListener("keydown", ChordTriggers.on);
        document.addEventListener("keyup", ChordTriggers.off);
        updateChordDisplay();
    }

    static on(e, calledManually=false, scheduledDuration=undefined, scheduledTime=undefined) {
        /* call this on the keydown/touchstart events */
        let eKey, eType, eRepeat;
        if (calledManually) {
            /* called from code, not from an event. manually fudge an obj that
             * looks like an event object, bc the "e" now contains just a 
             * key identifier! */
            eKey = e;
            eType = "keydown";
            eRepeat = false;
        }
        else {
            eKey = e.key;
            eType = e.type;
            eRepeat = e.repeat;
        }

        if (eType === "keydown" && !(eRepeat)) {
            const triggerSpec = KEYBOARD_TO_VOICING_MAP[eKey];
            if (triggerSpec && ((!calledManually && !triggerSpec.hidden) || (calledManually))) {
                const bassTurnedOn = MOUSEBOARD_STATE.chordplayers.bass.on(eKey, triggerSpec.bass, undefined, 1.0, false, scheduledDuration, scheduledTime);
                const chordTurnedOn = MOUSEBOARD_STATE.chordplayers.chord.on(eKey, triggerSpec.chord, undefined, 0.8, triggerSpec.voicelead, scheduledDuration, scheduledTime); /* lower velocity so we dont clip so horribly*/
                const wasCalledForScheduling = (scheduledTime !== undefined && scheduledDuration !== undefined);
                if (chordTurnedOn) {
                    /* chord info updates as a callback. If this on() call is to
                     * schedule a future note-On, then we also schedule the
                     * callback in the Transport. If not (i.e. called via
                     * keyboard event) then we just call it immediately. The
                     * reason we have to do the gymnastics with the partial
                     * applications is because the values in the chorddisplay
                     * should reflect the MOUSEBOARD_STATE at the time of
                     * scheduling (not the state after all the scheduling is
                     * done), and so we should do partial application to "pass
                     * in" the local scope at this instant where the on() call
                     * is used for scheduling. */

                    const onFn = (n, l) => {
                        MOUSEBOARD_STATE.info_voicing = n;
                        MOUSEBOARD_STATE.info_bassNoteImpliedByVoicing = l;
                    };
                    /* if this on() call is for scheduling w/ t and duration */                    
                    if (wasCalledForScheduling) {
                        const offFn = () => {
                            MOUSEBOARD_STATE.info_voicing = "";
                            MOUSEBOARD_STATE.info_bassNoteImpliedByVoicing = "";
                        }
                        Tone.Transport.scheduleOnce(((n, l) => (() => {onFn(n, l); updateChordDisplay();}))(triggerSpec.name, MOUSEBOARD_STATE.bassNoteSelected.label), scheduledTime);
                        Tone.Transport.scheduleOnce(() => {offFn(); updateChordDisplay();}, scheduledTime + scheduledDuration);
                    }
                    else {
                        onFn(triggerSpec.name, MOUSEBOARD_STATE.bassNoteSelected.label);
                    }
                }
                
                if (bassTurnedOn) {
                    const onFn = (l) => {
                        MOUSEBOARD_STATE.info_bassNotePlaying = l;
                    };
                    if (wasCalledForScheduling) {
                        const offFn = () => {
                            MOUSEBOARD_STATE.info_bassNotePlaying = "";
                        }
                        Tone.Transport.scheduleOnce(((l) => (() => {onFn(l); updateChordDisplay();}))(MOUSEBOARD_STATE.bassNoteSelected.label), scheduledTime);
                        Tone.Transport.scheduleOnce(() => {offFn(); updateChordDisplay();}, scheduledTime + scheduledDuration);
                    }
                    else {
                        onFn(MOUSEBOARD_STATE.bassNoteSelected.label);
                    }
                }
                if (!wasCalledForScheduling){
                    updateChordDisplay();
                }
            }
            else {
                if (eKey === "`") {
                    /* reset voice leading */
                    MOUSEBOARD_STATE.chordplayers.chord.resetVoiceLeadingMemory();
                    MOUSEBOARD_STATE.chordplayers.bass.resetVoiceLeadingMemory();
                }
            }
        }
        /* TODO handle touch trigger button event */
        
    }
    static off(e, calledManually=false) {
        let eKey;
        if (calledManually) {
            /* called from code, not from an event. manually fudge an obj that
             * looks like an event object, bc the "e" now contains just a 
             * key identifier! */
            eKey = e;
        }
        else {
            eKey = e.key;
        }
        /* if the keyup off event is for MOUSEBOARD_STATE.chordplayers.bass then it should
         * clear the MOUSEBOARD_STATE.info_bassNotePlaying value */
        if (MOUSEBOARD_STATE.chordplayers.bass.off(eKey) === true) {
            MOUSEBOARD_STATE.info_bassNotePlaying = "";
        }
        if (MOUSEBOARD_STATE.chordplayers.chord.off(eKey) === true) {
            MOUSEBOARD_STATE.info_voicing = "";
            MOUSEBOARD_STATE.info_bassNoteImpliedByVoicing = "";
        }
        updateChordDisplay();
    }

    static allOff() {
        MOUSEBOARD_STATE.chordplayers.bass.off(MOUSEBOARD_STATE.chordplayers.bass.currentlyPlayingDueToTrigger);
        MOUSEBOARD_STATE.chordplayers.chord.off(MOUSEBOARD_STATE.chordplayers.chord.currentlyPlayingDueToTrigger);
        MOUSEBOARD_STATE.info_voicing = "";
        MOUSEBOARD_STATE.info_bassNoteImpliedByVoicing = "";
        MOUSEBOARD_STATE.info_bassNotePlaying = "";
    }

    static sync() {
        MOUSEBOARD_STATE.chordplayers.bass.sync();
        MOUSEBOARD_STATE.chordplayers.chord.sync();
    }
    static unsync() {
        MOUSEBOARD_STATE.chordplayers.bass.unsync();
        MOUSEBOARD_STATE.chordplayers.chord.unsync();
    }
}

class DrumTriggers {
    /* very barebones static class but to match ChordTriggers. Might be nice to
    leave room for manual drum input later on maybe. */
    static on(drumSampleName, velocity, scheduledDuration=undefined, scheduledTime=undefined) {
        /* probably won't need "key off" handling for a drum machine input
         * trigger handler, so this will always take a duration argument.
         * (actually we just don't need it in this current state of the proj) */
        MOUSEBOARD_STATE.drummer.on(drumSampleName, velocity, scheduledDuration, scheduledTime);
    }
    static off() {
        MOUSEBOARD_STATE.drummer.off();
    }
    static allOff() {
        MOUSEBOARD_STATE.drummer.off();
    }
    static sync() {
        MOUSEBOARD_STATE.drummer.sync();
    }
    static unsync() {
        MOUSEBOARD_STATE.drummer.unsync();
    }
}

const CIRCLE_OF_FIFTHS_12EDO = 
  [ {"label": "F", "cents": 500}
  , {"label": "C", "cents": 0}
  , {"label": "G", "cents": 700}
  , {"label": "D", "cents": 200}
  , {"label": "A", "cents": 900}
  , {"label": "E", "cents": 400}
  , {"label": "B", "cents": 1100}
  , {"label": "F♯", "cents": 600}
  , {"label": "C♯", "cents": 100}
  , {"label": "A♭", "cents": 800}
  , {"label": "E♭", "cents": 300}
  , {"label": "B♭", "cents": 1000}
  ];

/* circle-of-fifths function... by default cycles through the 12-note circle,
 * but we can reimplement this function later to do exotic microtonal stuff. the
 * call signature should be (i, readonly : bool = false) -> {"label":str,
 * "cents":int}. These functions can be queried read-only (no state should be
 * modified) or not, which is how we could dynamically modify the circle of
 * fifths on each call to circleOfFifthsQueryFn. */
function queryCircleOfFifths12EDO(i, readonly=false) {
    return CIRCLE_OF_FIFTHS_12EDO[((i % 12) + 12) % 12];
}
function normalizeCircleOfFifthsIndex12EDO(i) {
    return ((i % 12) + 12) % 12;
}

let circleOfFifthsQueryFn = queryCircleOfFifths12EDO; /* change this out */
let normalizeCircleOfFifthsIndex = normalizeCircleOfFifthsIndex12EDO; /* changeable too */

/* for touchscreen use of manual mode */
function setupVoicingPads() {
    const panel = document.getElementById("panel-voicingpads");
    let c = 1;
    let r = 2;
    for (const key in KEYBOARD_TO_VOICING_MAP) {
        const triggerSpec = KEYBOARD_TO_VOICING_MAP[key];
        const name = triggerSpec.name;
        const isBass = triggerSpec.bass.length !== 0;

        const voicingPadElem = document.createElement("div");
        voicingPadElem.classList.add("voicingPad");
        voicingPadElem.append(name === "" ? "bass" : name);
        voicingPadElem.style.gridRow = r + "/" + r;
        voicingPadElem.style.gridColumn = c +  "/" + (c + (isBass ? 0 : 2));
        if (isBass) {
            voicingPadElem.style.fontSize = "calc(min(15pt, 3vh, 3vw))";
            c++;
        }
        else {
            c += 2;
            if (c >= 8) {
                c = 1;
                r++;
            }
        }
        const on = e => {
            voicingPadElem.classList.add("pad-clicked");
            ChordTriggers.on(key, true);
        }
        const off = e => {
            voicingPadElem.classList.remove("pad-clicked");
            ChordTriggers.off(key, true);
        }
        voicingPadElem.addEventListener("pointerdown", on);
        // voicingPadElem.addEventListener("pointerleave", off);
        // voicingPadElem.addEventListener("pointercancel", off);
        voicingPadElem.addEventListener("pointerup", off);
        voicingPadElem.addEventListener("touchstart", e => e.preventDefault());
        panel.append(voicingPadElem);
    }
    return panel;
}

function toggleVoicingPads() {
    MOUSEBOARD_STATE.voicingPadsShown = !MOUSEBOARD_STATE.voicingPadsShown;
    document.getElementById("panel-voicingpads").classList.toggle("collapsible-content-active");
}

/* lay out the basspads in either a circle of fifths or a tonnetz grid */
function layoutBasspads(style=undefined) {
    const n_basspads = MOUSEBOARD_STATE.basspads.length;

    if (!style) {
        /* toggle depending on the style stored in MOUSEBOARD_STATE */
        style = {"circle": "tonnetz", "tonnetz": "chromatic", "chromatic": "circle"}[MOUSEBOARD_STATE.basspadLayout];
        MOUSEBOARD_STATE.basspadLayout = style;
    }
    if (style === "circle") {
        const arc = 2 * Math.PI / n_basspads;
        const startAngle = 0.5 * Math.PI;
        const radiusPercentage = 35;

        for (const i in MOUSEBOARD_STATE.basspads) {
            const angle = startAngle + (-i) * arc;
            const basspadElem = MOUSEBOARD_STATE.basspads[i].element;
            
            basspadElem.classList.remove("basspad-tonnetz");
            basspadElem.classList.remove("basspad-chromatic-blackkey");
            basspadElem.classList.remove("basspad-chromatic-whitekey");
            basspadElem.classList.add("basspad-circle");
            
            basspadElem.style.top = (40 - Math.sin(angle) * radiusPercentage) + "%";
            basspadElem.style.left = (50 + Math.cos(angle) * radiusPercentage) + "%";
        }
    }
    else if (style === "tonnetz") {
        const gapPercentage = 3;
        const sepPercentage = 20;
        const topOffset = 20;
        const leftOffset = 20;
        for (const i in MOUSEBOARD_STATE.basspads) {
            const gridCol = i % 4;
            const gridRow = Math.floor(i / 4);
            const basspadElem = MOUSEBOARD_STATE.basspads[i].element;
            
            basspadElem.classList.remove("basspad-circle");
            basspadElem.classList.remove("basspad-chromatic-blackkey");
            basspadElem.classList.remove("basspad-chromatic-whitekey");
            basspadElem.classList.add("basspad-tonnetz");

            basspadElem.style.top = topOffset + (gridRow * sepPercentage + (gridRow - 1) * gapPercentage) + "%";
            basspadElem.style.left = leftOffset + (gridRow - 1)*(sepPercentage/2 + gapPercentage/4) + (gridCol * sepPercentage + (gridCol - 1) * gapPercentage) + "%";
        }
    }
    else if (style === "chromatic") {
        const wSepPercentage = 14.5;
        const bSepPercentage = 7.25;
        const topOffset = 30;
        const leftOffset = 8;
        const blackKeysCols = [8, 10, 1, 3, 5];
        const blackKeysOffsets = [1, 3, 7, 9, 11];
        const whiteKeysCols = [7,9,11,0,2,4,6];


        for (const wCol in whiteKeysCols) {
            const basspadElem = MOUSEBOARD_STATE.basspads[whiteKeysCols[wCol] * 7 % 12].element;
            basspadElem.classList.remove("basspad-circle");
            basspadElem.classList.remove("basspad-tonnetz");
            basspadElem.classList.add("basspad-chromatic-whitekey");
            basspadElem.style.top = topOffset + "%";
            basspadElem.style.left = leftOffset + wCol * wSepPercentage + "%";
        }
        for (const bCol in blackKeysCols) {
            const basspadElem = MOUSEBOARD_STATE.basspads[blackKeysCols[bCol] * 7 % 12].element;
            basspadElem.classList.remove("basspad-circle");
            basspadElem.classList.remove("basspad-tonnetz");
            basspadElem.classList.add("basspad-chromatic-blackkey");
            basspadElem.style.top = topOffset - 3 + "%";
            basspadElem.style.left = bSepPercentage + leftOffset + (blackKeysOffsets[bCol]-1) * bSepPercentage + "%";
        }
        
    }
}

function setupBasspads() {
    const cof = document.getElementById("circle-of-fifths");
    const n_basspads = 12;
    const basspads = Array(n_basspads);
    
    for (let i = 0;  i < n_basspads; i++) {
        const basspadElem = document.createElement("div");
        basspadElem.classList.add("basspad", "basspad-long-transitions");
        
        const basspadSpec = circleOfFifthsQueryFn(i, true);
        

        basspadElem.append((e => {e.textContent = (basspadSpec.label); return e;})(document.createElement("b")));
        cof.appendChild(basspadElem);

        /* initialize it as an object and put it in the state */
        const basspad = new Basspad(i, basspadSpec.label, basspadSpec.cents, basspadElem);
        basspads[i] = basspad;
        // MOUSEBOARD_STATE.lookupBasspadByCents[basspadSpec.cents] = basspad;
    }

    MOUSEBOARD_STATE.basspads = basspads;
    
    layoutBasspads(MOUSEBOARD_STATE.basspadLayout);
}

function setup(callbacksAfterwards) {
    const start_prompt_screen = document.getElementById("start-prompt-screen");
    start_prompt_screen?.addEventListener("click", async () => {
        await Tone.start()
        console.log("tonejs ready");
        MOUSEBOARD_STATE.chordplayers = {
            "chord": new Chordplayer("elecpiano", N_VOICES_PER_INSTRUMENT, "updown"),
            "bass": new Chordplayer("ambass", 1, "down") 
            /* this is just a bass note, played an octave below the 'chord' chordplayer */
        };
        MOUSEBOARD_STATE.drummer = new BossaDrumKit(); /* NEW */
        start_prompt_screen.remove();

        setupBasspads();
        setupVoicingPads();
        ChordTriggers.init(); /* start listening for keyboard triggers */
        callbacksAfterwards();
        if (MOUSEBOARD_STATE.isTouchscreen) {
            MOUSEBOARD_STATE.basspads.forEach(b => {
                b.element.classList.remove("basspad-long-transitions");
                b.element.classList.add("basspad-short-transitions");
            })
        }
    })
    start_prompt_screen?.addEventListener("touchstart", _ => {
        MOUSEBOARD_STATE.isTouchscreen = true;
    })

    /* show chord voicing keymap in the instructions  */
    const listChordKeyboardMapping = document.getElementById("list-chord-keyboard-mapping");
    for (const [key, voicing] of Object.entries(KEYBOARD_TO_VOICING_MAP)) {
        if (!voicing.hidden) {
            const li = document.createElement("li");
            const b = document.createElement("b");
            b.append(key);
            li.append(b, ": ", (voicing.name === "" ? "(bass only)" : voicing.name));
            listChordKeyboardMapping.append(li);
        }
    }   
}
