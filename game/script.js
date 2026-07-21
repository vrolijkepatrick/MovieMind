let currentPlayer = 1;
let selectedCell = null;
let database = [];
let gameOver = false;
let databaseLoaded = false;
let difficulty = "blockbuster";

let playerBlue = "";
let playerOrange = "";

let columns = [];
let rows = [];
let cells = [];
let usedMediaKeys = [];
let usedCoStarNames = [];
let selectedSuggestionKey = null;

const PLAYED_TOGETHER_CATEGORY = "Speelde samen met...";

const DIFFICULTY_PROFILES = {
    moviehouse: {
        label: "Movie House",
        normal: {
            minimum: 6,
            maximum: Infinity,
            target: 10
        },
        playedTogether: {
            minimum: 18,
            maximum: Infinity,
            target: 35
        },
        candidatePool: 35
    },

    blockbuster: {
        label: "Blockbuster",
        normal: {
            minimum: 3,
            maximum: 12,
            target: 6
        },
        playedTogether: {
            minimum: 8,
            maximum: 60,
            target: 24
        },
        candidatePool: 30
    },

    oscarnight: {
        label: "Oscar Night",
        normal: {
            minimum: 2,
            maximum: 5,
            target: 3
        },
        playedTogether: {
            minimum: 2,
            maximum: 25,
            target: 10
        },
        candidatePool: 25
    }
};

/*
De afbeeldingen staan vanuit dit script één map hoger:
images/actors/
images/ui/

Voorbeeld:
Al Pacino → images/actors/al_pacino.png
*/
const ACTOR_IMAGE_FOLDER = "images/actors/";
const ACTOR_PLACEHOLDER_IMAGE = "images/ui/placeholder_actor.png";

/*
De tijdelijke Al Pacino-portrettest is afgerond.
Vanaf nu kiest ieder bord de acteurs weer volledig automatisch.
*/
const FORCED_TEST_ACTOR = null;

const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");
const brandBlock = document.querySelector(".brand-block");

const startBtn = document.getElementById("startBtn");
const newRoundBtn = document.getElementById("newRoundBtn");

const playerBlueInput = document.getElementById("playerBlueInput");
const playerOrangeInput = document.getElementById("playerOrangeInput");

const difficultyCards =
    document.querySelectorAll(".difficulty-card");

const selectedDifficultyLabel =
    document.getElementById("selectedDifficultyLabel");

const board = document.getElementById("board");

const popup = document.getElementById("popup");
const question = document.getElementById("question");

const answerInput = document.getElementById("answerInput");
const movieSuggestions = document.getElementById("movieSuggestions");

const submitBtn = document.getElementById("submitBtn");
const passBtn = document.getElementById("passBtn");
const cancelBtn = document.getElementById("cancelBtn");

const playerText = document.getElementById("player");
const turnIndicator = document.getElementById("turnIndicator");
const winnerMessage = document.getElementById("winnerMessage");
const screenFrame = document.getElementById("screenFrame");
const winnerOverlay = document.getElementById("winnerOverlay");
const winnerOverlayText = document.getElementById("winnerOverlayText");
const winnerNewGameBtn = document.getElementById("winnerNewGameBtn");
const loadingScreen = document.getElementById("loadingScreen");
const loadingMessage = document.getElementById("loadingMessage");

const developerToggleBtn =
    document.getElementById("developerToggleBtn");

const developerPanel =
    document.getElementById("developerPanel");

const test100Btn =
    document.getElementById("test100Btn");

const databaseStatsBtn =
    document.getElementById("databaseStatsBtn");

const weakCombinationsBtn =
    document.getElementById("weakCombinationsBtn");

const developerProgress =
    document.getElementById("developerProgress");

const developerReport =
    document.getElementById("developerReport");


initializeGameHud();

function initializeGameHud() {
    if (!turnIndicator) {
        return;
    }

    const statusCenter =
        turnIndicator.querySelector(".status-center");

    const statusLabel =
        turnIndicator.querySelector(".status-label");

    if (statusLabel) {
        statusLabel.textContent = "is aan de beurt";
    }

    if (
        statusCenter &&
        !document.getElementById("hudDifficulty")
    ) {
        const difficultyPanel =
            document.createElement("div");

        difficultyPanel.className = "hud-difficulty";
        difficultyPanel.innerHTML =
            '<span id="hudDifficultyIcon" ' +
            'class="hud-difficulty-icon" ' +
            'aria-hidden="true">🎬</span>' +
            '<span id="hudDifficulty">Blockbuster</span>';

        turnIndicator.insertBefore(
            difficultyPanel,
            statusCenter
        );
    }

    if (!document.getElementById("hudRemaining")) {
        const progressPanel =
            document.createElement("div");

        progressPanel.className = "hud-progress";
        progressPanel.innerHTML =
            '<span id="hudRemaining">Nog 9 vakjes</span>';

        turnIndicator.appendChild(progressPanel);
    }

    turnIndicator.classList.add("hud-ready");
    addGameHudStyles();
    updateGameHud();
}

function addGameHudStyles() {
    if (document.getElementById("movieMindHudStyles")) {
        return;
    }

    const style = document.createElement("style");
    style.id = "movieMindHudStyles";

    style.textContent = `
        .status.hud-ready {
            grid-template-columns:
                minmax(0, 1fr)
                minmax(0, 1.65fr)
                minmax(0, 1fr);
            height: 7%;
            padding: 0 2.5%;
        }

        .status.hud-ready::before,
        .status.hud-ready::after {
            display: none;
        }

        .status.hud-ready .hud-difficulty,
        .status.hud-ready .hud-progress {
            display: flex;
            align-items: center;
            min-width: 0;
            white-space: nowrap;
        }

        .status.hud-ready .hud-difficulty {
            justify-content: flex-start;
            gap: clamp(5px, 0.5vw, 10px);
            color: var(--gold-light);
            font-family: Georgia, "Times New Roman", serif;
            font-size: clamp(8px, 0.76vw, 15px);
            font-weight: 800;
            letter-spacing: 0.045em;
        }

        .status.hud-ready .hud-difficulty-icon {
            font-size: clamp(10px, 0.95vw, 18px);
            line-height: 1;
        }

        .status.hud-ready .status-center {
            justify-content: center;
            gap: clamp(7px, 0.65vw, 13px);
        }

        .status.hud-ready .status-icon {
            width: clamp(22px, 2vw, 38px);
            height: clamp(22px, 2vw, 38px);
            font-size: clamp(10px, 1vw, 19px);
        }

        .status.hud-ready .status-copy {
            display: flex;
            align-items: baseline;
            justify-content: center;
            gap: clamp(5px, 0.5vw, 10px);
            min-width: 0;
        }

        .status.hud-ready .status-label {
            color: #e2e6e9;
            font-size: clamp(7px, 0.62vw, 12px);
            font-weight: 700;
            letter-spacing: 0.015em;
            text-transform: none;
        }

        .status.hud-ready #player {
            max-width: 15em;
            font-size: clamp(11px, 1.02vw, 20px);
            letter-spacing: 0.025em;
        }

        .status.hud-ready .hud-progress {
            justify-content: flex-end;
            color: #d9dfe3;
            font-size: clamp(7px, 0.63vw, 12px);
            font-weight: 700;
            letter-spacing: 0.025em;
        }

        .status.hud-ready .hud-progress.endgame {
            color: var(--gold-light);
        }
    `;

    document.head.appendChild(style);
}

function getDifficultyIcon(value) {
    const icons = {
        moviehouse: "🍿",
        blockbuster: "🎬",
        oscarnight: "🏆"
    };

    return icons[value] || "🎬";
}

function getRemainingCellCount() {
    if (!Array.isArray(cells) || cells.length === 0) {
        return 9;
    }

    return cells.filter(function (cell) {
        return !isOccupiedCell(cell);
    }).length;
}

function updateGameHud() {
    const difficultyText =
        document.getElementById("hudDifficulty");

    const difficultyIcon =
        document.getElementById("hudDifficultyIcon");

    const remainingText =
        document.getElementById("hudRemaining");

    const progressPanel =
        turnIndicator
            ? turnIndicator.querySelector(".hud-progress")
            : null;

    const statusIcon =
        turnIndicator
            ? turnIndicator.querySelector(".status-icon")
            : null;

    const activePlayer =
        currentPlayer === 1
            ? playerBlue
            : playerOrange;

    if (playerText) {
        playerText.textContent =
            activePlayer || "Speler";
    }

    if (statusIcon) {
        statusIcon.textContent =
            currentPlayer === 1 ? "🔵" : "🟠";
    }

    if (difficultyText) {
        difficultyText.textContent =
            getDifficultyLabel(difficulty);
    }

    if (difficultyIcon) {
        difficultyIcon.textContent =
            getDifficultyIcon(difficulty);
    }

    const remaining = getRemainingCellCount();

    if (remainingText) {
        if (remaining === 0) {
            remainingText.textContent = "Bord vol";
        } else if (remaining <= 3) {
            remainingText.textContent =
                "⚡ Eindspel · nog " +
                remaining +
                (remaining === 1 ? " vakje" : " vakjes");
        } else {
            remainingText.textContent =
                "Nog " +
                remaining +
                " vakjes";
        }
    }

    if (progressPanel) {
        progressPanel.classList.toggle(
            "endgame",
            remaining > 0 && remaining <= 3
        );
    }
}

function returnToStartScreen() {
    gameOver = true;
    selectedCell = null;

    closePopup();

    if (winnerOverlay) {
        winnerOverlay.classList.add("hidden");
        winnerOverlay.classList.remove("show");
    }

    if (winnerOverlayText) {
        winnerOverlayText.textContent = "";
    }

    if (winnerMessage) {
        winnerMessage.textContent = "";
        winnerMessage.classList.remove("winner-reveal");
    }

    if (screenFrame) {
        screenFrame.classList.add("hidden");
        screenFrame.classList.remove("game-won");
    }

    if (gameScreen) {
        gameScreen.classList.add("hidden");
    }

    if (startScreen) {
        startScreen.classList.remove("hidden");
    }

    if (brandBlock) {
        brandBlock.classList.remove("hidden");
    }

    hideLoadingScreen();

    document.body.classList.remove(
        "game-active",
        "loading-active",
        "victory-flash"
    );

    newRoundBtn.classList.add("hidden");
    newRoundBtn.textContent = "Nieuwe game";

    selectDifficulty(difficulty);
}

difficultyCards.forEach(function (card) {
    card.addEventListener("click", function () {
        selectDifficulty(card.dataset.difficulty);
    });
});

function selectDifficulty(selectedDifficulty) {
    difficulty = selectedDifficulty;

    difficultyCards.forEach(function (card) {
        const isSelected =
            card.dataset.difficulty === selectedDifficulty;

        card.classList.toggle("selected", isSelected);
        card.setAttribute(
            "aria-pressed",
            isSelected ? "true" : "false"
        );

        card.classList.remove("selection-pop");

        if (isSelected) {
            void card.offsetWidth;
            card.classList.add("selection-pop");
        }
    });

    if (selectedDifficultyLabel) {
        selectedDifficultyLabel.textContent =
            getDifficultyLabel(selectedDifficulty);
    }

    console.log(
        "Moeilijkheid gekozen:",
        getDifficultyLabel(selectedDifficulty)
    );
}

function getDifficultyLabel(value) {
    const profile = DIFFICULTY_PROFILES[value];

    return profile
        ? profile.label
        : DIFFICULTY_PROFILES.blockbuster.label;
}

function getDifficultyProfile() {
    return (
        DIFFICULTY_PROFILES[difficulty] ||
        DIFFICULTY_PROFILES.blockbuster
    );
}

function getAnswerLimits(category, profile = getDifficultyProfile()) {
    if (category === PLAYED_TOGETHER_CATEGORY) {
        return profile.playedTogether;
    }

    return profile.normal;
}

function isAnswerCountSuitable(actor, category, profile) {
    const answerCount =
        getMatchingAnswers(actor, category).length;

    const limits = getAnswerLimits(category, profile);

    return (
        answerCount >= limits.minimum &&
        answerCount <= limits.maximum
    );
}

function getAnswerDifficultyDistance(actor, category, profile) {
    const answerCount =
        getMatchingAnswers(actor, category).length;

    const limits = getAnswerLimits(category, profile);

    return Math.abs(answerCount - limits.target);
}

loadDatabase();


/* =========================================
   DATABASE LADEN
========================================= */

async function loadDatabase() {
    startBtn.disabled = true;
    startBtn.textContent = "Databases laden...";

    try {
        const [movieResponse, tvResponse] = await Promise.all([
            fetch("../data/cinegrid_database.json"),
            fetch("../data/moviemind_tv_database.json")
        ]);

        if (!movieResponse.ok) {
            throw new Error("Filmdatabase niet gevonden.");
        }

        if (!tvResponse.ok) {
            throw new Error("TV-database niet gevonden.");
        }

        const movieData = await movieResponse.json();
        const tvData = await tvResponse.json();

        if (!Array.isArray(movieData.films)) {
            throw new Error("Ongeldige filmdatabase.");
        }

        if (!Array.isArray(tvData.series)) {
            throw new Error("Ongeldige TV-database.");
        }

        const movies = movieData.films.map(function (item) {
            return normalizeMediaItem(item, "movie");
        });

        const series = tvData.series.map(function (item) {
            return normalizeMediaItem(item, "tv");
        });

        database = [...movies, ...series]
            .filter(isUsableMedia)
            .filter(removeDuplicateMedia);

        databaseLoaded = true;
        startBtn.disabled = false;
        startBtn.textContent = "Start spel";

        console.log(
            "Databases geladen:",
            movies.filter(isUsableMedia).length,
            "films en",
            series.filter(isUsableMedia).length,
            "series"
        );

    } catch (error) {
        console.error("Databasefout:", error);

        startBtn.disabled = true;
        startBtn.textContent = "Database niet gevonden";

        alert(
            "De databases konden niet worden geladen.\n\n" +
            "Controleer of deze bestanden bestaan:\n" +
            "data/cinegrid_database.json\n" +
            "data/moviemind_tv_database.json"
        );
    }
}

function normalizeMediaItem(item, fallbackType) {
    const mediaType = item.media_type === "tv" ? "tv" : fallbackType;

    return {
        ...item,
        media_type: mediaType,
        title: String(item.title || item.name || "").trim(),
        genre: normalizeGenreList(item.genre),
        actors: Array.isArray(item.actors)
            ? item.actors.filter(Boolean)
            : [],
        characters: Array.isArray(item.characters)
            ? item.characters.filter(Boolean)
            : [],
        game_key: mediaType + ":" + String(item.id)
    };
}

function normalizeGenreList(genres) {
    if (!Array.isArray(genres)) {
        return [];
    }

    const genreMap = {
        "Action & Adventure": "Actie",
        "Action": "Actie",
        "Adventure": "Actie",
        "Sci-Fi & Fantasy": "Sciencefiction",
        "Science Fiction": "Sciencefiction",
        "Comedy": "Komedie",
        "Romance": "Romantiek",
        "Crime": "Misdaad",
        "War & Politics": "Oorlog",
        "War": "Oorlog",
        "Mystery": "Thriller"
    };

    return [...new Set(
        genres
            .map(function (genre) {
                return genreMap[genre] || genre;
            })
            .filter(Boolean)
    )];
}

function isUsableMedia(item) {
    return (
        item &&
        item.id !== undefined &&
        typeof item.title === "string" &&
        item.title.trim() !== "" &&
        Array.isArray(item.genre) &&
        Array.isArray(item.actors) &&
        item.genre.length > 0 &&
        item.actors.length > 0 &&
        hasReadableText(item.title) &&
        !item.genre.includes("TV Movie") &&
        !item.genre.includes("TV Film")
    );
}

function removeDuplicateMedia(item, index, array) {
    return (
        array.findIndex(function (otherItem) {
            return otherItem.game_key === item.game_key;
        }) === index
    );
}

function hasReadableText(text) {
    return /^[\p{L}\p{N}\s:'".,!?\-&()]+$/u.test(text);
}


/* =========================================
   SPEL STARTEN
========================================= */

startBtn.addEventListener("click", async function () {
    if (!databaseLoaded) {
        alert("De database is nog niet geladen.");
        return;
    }

    playerBlue = playerBlueInput.value.trim();
    playerOrange = playerOrangeInput.value.trim();

    if (playerBlue === "" || playerOrange === "") {
        alert("Vul beide spelersnamen in.");
        return;
    }

    console.log(
        "Spel gestart op moeilijkheid:",
        getDifficultyLabel(difficulty)
    );

    await startGameWithLoadingScreen();
});

async function startGameWithLoadingScreen() {
    startBtn.disabled = true;

    if (startScreen) {
        startScreen.classList.add("hidden");
    }

    if (brandBlock) {
        brandBlock.classList.add("hidden");
    }

    if (screenFrame) {
        screenFrame.classList.add("hidden");
    }

    if (gameScreen) {
        gameScreen.classList.add("hidden");
    }

    document.body.classList.add("loading-active");
    showLoadingScreen("De zaal loopt vol...");

    await waitForPaint();
    await delay(450);
    setLoadingMessage("🍿 Popcorn wordt klaargezet...");

    await delay(450);
    setLoadingMessage("🎥 Projector wordt opgestart...");

    await delay(350);
    setLoadingMessage("🎞️ Speelbord wordt samengesteld...");

    await waitForPaint();

    try {
        startRound();

        setLoadingMessage("✨ De voorstelling kan beginnen!");
        await delay(400);

        hideLoadingScreen();
        document.body.classList.remove("loading-active");
        document.body.classList.add("game-active");

        if (screenFrame) {
            screenFrame.classList.remove("hidden");
            screenFrame.classList.add("screen-reveal");

            window.setTimeout(function () {
                screenFrame.classList.remove("screen-reveal");
            }, 650);
        }

        if (gameScreen) {
            gameScreen.classList.remove("hidden");
        }
    } catch (error) {
        console.error("Het speelbord kon niet worden gemaakt:", error);
        hideLoadingScreen();
        document.body.classList.remove("loading-active");
        returnToStartScreen();
        alert("Het speelbord kon niet worden geladen. Probeer het opnieuw.");
    } finally {
        startBtn.disabled = false;
    }
}

function showLoadingScreen(message) {
    setLoadingMessage(message);

    if (!loadingScreen) {
        return;
    }

    loadingScreen.classList.remove("hidden");
    loadingScreen.classList.remove("loading-leave");
}

function hideLoadingScreen() {
    if (!loadingScreen) {
        return;
    }

    loadingScreen.classList.add("loading-leave");

    window.setTimeout(function () {
        loadingScreen.classList.add("hidden");
        loadingScreen.classList.remove("loading-leave");
    }, 360);
}

function setLoadingMessage(message) {
    if (!loadingMessage) {
        return;
    }

    loadingMessage.classList.remove("message-change");
    void loadingMessage.offsetWidth;
    loadingMessage.textContent = message;
    loadingMessage.classList.add("message-change");
}

function delay(milliseconds) {
    return new Promise(function (resolve) {
        window.setTimeout(resolve, milliseconds);
    });
}

function waitForPaint() {
    return new Promise(function (resolve) {
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(resolve);
        });
    });
}

newRoundBtn.addEventListener("click", returnToStartScreen);

if (winnerNewGameBtn) {
    winnerNewGameBtn.addEventListener(
        "click",
        startNewGameFromWinner
    );
}


developerToggleBtn.addEventListener(
    "click",
    toggleDeveloperMode
);

test100Btn.addEventListener(
    "click",
    runGridTest
);

databaseStatsBtn.addEventListener(
    "click",
    showDatabaseStatistics
);

weakCombinationsBtn.addEventListener(
    "click",
    showWeakCombinations
);

function startNewGameFromWinner() {
    returnToStartScreen();
}

function startRound() {
    currentPlayer = 1;
    selectedCell = null;
    gameOver = false;

    usedMediaKeys = [];
    usedCoStarNames = [];
    selectedSuggestionKey = null;
    rows = [];
    columns = [];
    cells = [];

    winnerMessage.textContent = "";
    winnerMessage.classList.remove("winner-reveal");
    newRoundBtn.classList.add("hidden");
    newRoundBtn.textContent = "Nieuwe game";

    if (winnerOverlay) {
        winnerOverlay.classList.add("hidden");
        winnerOverlay.classList.remove("show");
    }

    if (winnerOverlayText) {
        winnerOverlayText.textContent = "";
    }

    if (screenFrame) {
        screenFrame.classList.remove("game-won");
    }

    updateTurnIndicatorColor();
    updateGameHud();
    animateTurnIndicator();

    createSmartGrid();
    updateGameHud();
}


/* =========================================
   GRID GENEREREN
========================================= */

const CATEGORY_IMAGE_FOLDER = "images/categories/";

function getCategoryImage(category) {
    const normalizedCategory = normalizeText(category);

    const categoryImages = {
        "actie": "actie.png",
        "actiefilm": "actie.png",
        "sciencefiction": "sciencefiction.png",
        "science fiction": "sciencefiction.png",
        "sci-fi": "sciencefiction.png",
        "oorlog": "oorlog.png",
        "war": "oorlog.png",
        "drama": "drama.png",
        "komedie": "komedie.png",
        "comedy": "komedie.png",
        "romantiek": "romantiek.png",
        "romance": "romantiek.png",
        "speelde samen met...": "speelde-samen-met.png"
    };

    return categoryImages[normalizedCategory] || null;
}

function createCategorySide(category) {
    const side = document.createElement("div");
    side.className = "side";

    const imageFilename = getCategoryImage(category);

    if (imageFilename) {
        const icon = document.createElement("img");
        icon.className = "side-icon side-icon-image";
        icon.src = CATEGORY_IMAGE_FOLDER + imageFilename;
        icon.alt = "";
        icon.setAttribute("aria-hidden", "true");

        icon.addEventListener("error", function () {
            icon.remove();
            side.classList.add("side-without-image");
        });

        side.appendChild(icon);
    } else {
        side.classList.add("side-without-image");
    }

    const label = document.createElement("span");
    label.className = "side-label";
    label.textContent = category;

    side.appendChild(label);

    return side;
}

function createSmartGrid() {
    board.innerHTML = "";
    cells = [];

    const smartGrid = findSmartGrid();

    if (!smartGrid) {
        winnerMessage.textContent =
            "Er kon geen speelbaar bord worden gemaakt.";

        newRoundBtn.classList.remove("hidden");

        console.warn(
            "Geen geldig bord gevonden.",
            "Titels:",
            database.length,
            "Acteurs:",
            getEligibleActors().length,
            "Categorieën:",
            getAllCategories().length
        );

        return;
    }

    columns = smartGrid.actors;
    rows = smartGrid.genres;

    console.log("Nieuw speelbaar bord:", smartGrid);

    const corner = document.createElement("div");
    corner.className = "corner";

    board.appendChild(corner);

    columns.forEach(function (actor) {
        const header = createActorHeader(actor);
        board.appendChild(header);
    });

    rows.forEach(function (genre, rowIndex) {
        const side = createCategorySide(genre);

        board.appendChild(side);

        columns.forEach(function (actor, columnIndex) {
            const cell = document.createElement("button");

            cell.className = "cell";
            cell.dataset.row = rowIndex;
            cell.dataset.column = columnIndex;
            cell.title = actor + " + " + genre;

            cell.addEventListener("click", function () {
                openAnswerPopup(cell);
            });

            cells.push(cell);
            board.appendChild(cell);
        });
    });
}

function findSmartGrid() {
    const categories = shuffleArray(getAllCategories());
    const actors = getEligibleActors();
    const profile = getDifficultyProfile();

    /*
    Tijdens de portrettest maken we eerst gericht een bord
    waarop de gekozen testacteur voorkomt. Zodra
    FORCED_TEST_ACTOR op null staat, werkt de generator weer
    volledig willekeurig zoals voorheen.
    */
    if (FORCED_TEST_ACTOR) {
        const forcedGrid = findGridWithForcedActor(
            FORCED_TEST_ACTOR,
            actors,
            categories,
            profile
        );

        if (forcedGrid) {
            return forcedGrid;
        }

        console.warn(
            "Testacteur kon niet worden geforceerd:",
            FORCED_TEST_ACTOR
        );
    }

    const maximumAttempts = 1200;

    for (let attempt = 0; attempt < maximumAttempts; attempt++) {
        const chosenGenres =
            shuffleArray(categories).slice(0, 3);

        if (chosenGenres.length < 3) {
            return null;
        }

        const possibleActors = actors.filter(function (actor) {
            return chosenGenres.every(function (genre) {
                return isAnswerCountSuitable(
                    actor,
                    genre,
                    profile
                );
            });
        });

        if (possibleActors.length >= 3) {
            const chosenActors = pickBalancedActors(
                possibleActors,
                chosenGenres,
                profile
            );

            if (chosenActors.length === 3) {
                logGeneratedGridDifficulty(
                    chosenActors,
                    chosenGenres,
                    profile
                );

                return {
                    genres: chosenGenres,
                    actors: chosenActors
                };
            }
        }
    }

    console.warn(
        "Geen bord gevonden binnen de gekozen moeilijkheid:",
        profile.label
    );

    return null;
}
function findGridWithForcedActor(forcedActor, actors, genres, profile) {
    const actualActor = actors.find(function (actor) {
        return normalizeText(actor) === normalizeText(forcedActor);
    });

    if (!actualActor) {
        return null;
    }

    const usableGenres = genres.filter(function (genre) {
        return isAnswerCountSuitable(
            actualActor,
            genre,
            profile
        );
    });

    if (usableGenres.length < 3) {
        return null;
    }

    const genreCombinations = [];

    for (let first = 0; first < usableGenres.length - 2; first++) {
        for (let second = first + 1; second < usableGenres.length - 1; second++) {
            for (let third = second + 1; third < usableGenres.length; third++) {
                genreCombinations.push([
                    usableGenres[first],
                    usableGenres[second],
                    usableGenres[third]
                ]);
            }
        }
    }

    const shuffledCombinations = shuffleArray(genreCombinations);

    for (const chosenGenres of shuffledCombinations) {
        const supportingActors = actors.filter(function (actor) {
            if (normalizeText(actor) === normalizeText(actualActor)) {
                return false;
            }

            return chosenGenres.every(function (genre) {
                return isAnswerCountSuitable(
                    actor,
                    genre,
                    profile
                );
            });
        });

        if (supportingActors.length >= 2) {
            const chosenSupportingActors = pickBalancedActors(
                supportingActors,
                chosenGenres,
                profile
            ).slice(0, 2);

            if (chosenSupportingActors.length === 2) {
                return {
                    genres: chosenGenres,
                    actors: shuffleArray([
                        actualActor,
                        ...chosenSupportingActors
                    ])
                };
            }
        }
    }

    return null;
}

function pickBalancedActors(
    possibleActors,
    chosenGenres,
    profile
) {
    const scoredActors = possibleActors.map(function (actor) {
        const difficultyDistance = chosenGenres.reduce(
            function (total, genre) {
                return (
                    total +
                    getAnswerDifficultyDistance(
                        actor,
                        genre,
                        profile
                    )
                );
            },
            0
        );

        const totalAnswers = chosenGenres.reduce(
            function (total, genre) {
                return (
                    total +
                    getMatchingAnswers(actor, genre).length
                );
            },
            0
        );

        return {
            name: actor,
            difficultyDistance: difficultyDistance,
            totalAnswers: totalAnswers
        };
    });

    const bestCandidates = scoredActors
        .sort(function (first, second) {
            if (
                first.difficultyDistance !==
                second.difficultyDistance
            ) {
                return (
                    first.difficultyDistance -
                    second.difficultyDistance
                );
            }

            if (difficulty === "moviehouse") {
                return (
                    second.totalAnswers -
                    first.totalAnswers
                );
            }

            if (difficulty === "oscarnight") {
                return (
                    first.totalAnswers -
                    second.totalAnswers
                );
            }

            return 0;
        })
        .slice(0, profile.candidatePool)
        .map(function (item) {
            return item.name;
        });

    return shuffleArray(bestCandidates).slice(0, 3);
}

function logGeneratedGridDifficulty(
    chosenActors,
    chosenGenres,
    profile
) {
    const counts = [];

    chosenGenres.forEach(function (genre) {
        chosenActors.forEach(function (actor) {
            counts.push({
                actor: actor,
                category: genre,
                answers:
                    getMatchingAnswers(actor, genre).length
            });
        });
    });

    const average =
        counts.reduce(function (total, item) {
            return total + item.answers;
        }, 0) / counts.length;

    console.log(
        "Bord gegenereerd:",
        profile.label,
        "| gemiddeld",
        average.toFixed(1),
        "antwoorden per vakje"
    );

    console.table(counts);
}


/* =========================================
   ACTEURS EN GENRES
========================================= */

function getMatchingMovies(actor, genre) {
    const normalizedActor = normalizeText(actor);
    const normalizedGenre = normalizeText(genre);

    return database.filter(function (movie) {
        const actorMatches = movie.actors.some(function (movieActor) {
            return normalizeText(movieActor) === normalizedActor;
        });

        const genreMatches = movie.genre.some(function (movieGenre) {
            return normalizeText(movieGenre) === normalizedGenre;
        });

        return actorMatches && genreMatches;
    });
}


function getMatchingAnswers(actor, category) {
    if (category === PLAYED_TOGETHER_CATEGORY) {
        return getMatchingCoStars(actor);
    }

    return getMatchingMovies(actor, category);
}

function getMatchingCoStars(actor) {
    const normalizedActor = normalizeText(actor);
    const coStars = new Map();

    database.forEach(function (item) {
        const actorAppears = item.actors.some(function (castMember) {
            return normalizeText(castMember) === normalizedActor;
        });

        if (!actorAppears) {
            return;
        }

        item.actors.forEach(function (castMember) {
            const normalizedCastMember = normalizeText(castMember);

            if (
                normalizedCastMember === "" ||
                normalizedCastMember === normalizedActor ||
                !hasReadableActorName(castMember)
            ) {
                return;
            }

            if (!coStars.has(normalizedCastMember)) {
                coStars.set(normalizedCastMember, {
                    name: castMember,
                    answer_key: "actor:" + normalizedCastMember
                });
            }
        });
    });

    return Array.from(coStars.values()).sort(function (first, second) {
        return first.name.localeCompare(second.name, "nl", {
            sensitivity: "base"
        });
    });
}

function getAllActorNames() {
    const actors = new Map();

    database.forEach(function (item) {
        item.actors.forEach(function (actor) {
            const normalizedActor = normalizeText(actor);

            if (
                normalizedActor &&
                hasReadableActorName(actor) &&
                !actors.has(normalizedActor)
            ) {
                actors.set(normalizedActor, actor);
            }
        });
    });

    return Array.from(actors.values());
}

function hasReadableActorName(text) {
    const simplified = String(text || "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’‘]/g, "'");

    /*
    \p{L} accepteert ook Chinese, Japanse en andere
    schriftsoorten. Voor de zichtbare grid staan we daarom
    alleen Latijnse letters, cijfers en normale leestekens toe.
    */
    return (
        /[A-Za-z]/.test(simplified) &&
        /^[A-Za-z0-9\s:'".,!?#&()\-]+$/.test(simplified)
    );
}

function getEligibleActors() {
    const actorCounts = {};

    database.forEach(function (movie) {
        movie.actors.forEach(function (actor) {
            if (!actor || !hasReadableActorName(actor)) {
                return;
            }

            actorCounts[actor] =
                (actorCounts[actor] || 0) + 1;
        });
    });

    return Object.keys(actorCounts)
        .filter(function (actor) {
            return actorCounts[actor] >= 5;
        })
        .sort(function (actorA, actorB) {
            return actorCounts[actorB] - actorCounts[actorA];
        });
}

function getAllGenres() {
    const allowedGenres = [
        "Actie",
        "Sciencefiction",
        "Oorlog",
        "Drama",
        "Komedie",
        "Romantiek"
    ];

    const genres = new Set();

    database.forEach(function (movie) {
        movie.genre.forEach(function (genre) {
            if (allowedGenres.includes(genre)) {
                genres.add(genre);
            }
        });
    });

    return Array.from(genres);
}

function getAllCategories() {
    const categories = getAllGenres();

    if (
        getEligibleActors().some(function (actor) {
            return getMatchingCoStars(actor).length >= 2;
        })
    ) {
        categories.push(PLAYED_TOGETHER_CATEGORY);
    }

    return categories;
}

function shuffleArray(array) {
    const copy = [...array];

    for (
        let index = copy.length - 1;
        index > 0;
        index--
    ) {
        const randomIndex = Math.floor(
            Math.random() * (index + 1)
        );

        [copy[index], copy[randomIndex]] =
            [copy[randomIndex], copy[index]];
    }

    return copy;
}


/* =========================================
   POPUP OPENEN
========================================= */

function openAnswerPopup(cell) {
    if (
        gameOver ||
        cell.classList.contains("blue") ||
        cell.classList.contains("orange")
    ) {
        return;
    }

    selectedCell = cell;

    const rowIndex = Number(cell.dataset.row);
    const columnIndex = Number(cell.dataset.column);

    const actor = columns[columnIndex];
    const genre = rows[rowIndex];

    question.textContent =
        actor + " + " + genre;

    answerInput.placeholder =
        genre === PLAYED_TOGETHER_CATEGORY
            ? "Typ de naam van een acteur..."
            : "Typ een film- of serietitel...";

    answerInput.value = "";

    movieSuggestions.innerHTML = "";
    movieSuggestions.classList.add("hidden");

    popup.classList.remove("hidden");
    answerInput.focus();
}


/* =========================================
   AUTOCOMPLETE FILMTITELS
========================================= */

answerInput.addEventListener(
    "input",
    showMovieSuggestions
);

answerInput.addEventListener(
    "blur",
    function () {
        setTimeout(function () {
            movieSuggestions.classList.add("hidden");
        }, 150);
    }
);

function showMovieSuggestions() {
    const searchText = normalizeText(answerInput.value);

    selectedSuggestionKey = null;
    movieSuggestions.innerHTML = "";

    if (searchText.length < 2 || !selectedCell) {
        movieSuggestions.classList.add("hidden");
        return;
    }

    const rowIndex = Number(selectedCell.dataset.row);
    const columnIndex = Number(selectedCell.dataset.column);
    const category = rows[rowIndex];
    const requiredActor = columns[columnIndex];

    if (category === PLAYED_TOGETHER_CATEGORY) {
        showActorSuggestions(searchText, requiredActor);
        return;
    }

    showTitleSuggestions(searchText);
}

function showTitleSuggestions(searchText) {
    const matchingTitles = database
        .filter(function (item) {
            return normalizeText(item.title).includes(searchText);
        })
        .filter(function (item) {
            return !usedMediaKeys.includes(item.game_key);
        })
        .sort(function (itemA, itemB) {
            const titleA = normalizeText(itemA.title);
            const titleB = normalizeText(itemB.title);
            const startsA = titleA.startsWith(searchText);
            const startsB = titleB.startsWith(searchText);

            if (startsA && !startsB) return -1;
            if (!startsA && startsB) return 1;

            return itemA.title.localeCompare(itemB.title, "nl", {
                sensitivity: "base"
            });
        })
        .slice(0, 10);

    if (matchingTitles.length === 0) {
        movieSuggestions.classList.add("hidden");
        return;
    }

    matchingTitles.forEach(function (item) {
        const suggestion = document.createElement("div");
        const mediaIcon = item.media_type === "tv" ? "📺" : "🎬";

        suggestion.className = "movie-suggestion";
        suggestion.textContent =
            mediaIcon + " " + item.title + " (" + (item.year || "?") + ")";

        suggestion.addEventListener("mousedown", function (event) {
            event.preventDefault();

            answerInput.value = item.title;
            selectedSuggestionKey = item.game_key;
            movieSuggestions.innerHTML = "";
            movieSuggestions.classList.add("hidden");
            answerInput.focus();
        });

        movieSuggestions.appendChild(suggestion);
    });

    movieSuggestions.classList.remove("hidden");
}

function showActorSuggestions(searchText, requiredActor) {
    const normalizedRequiredActor = normalizeText(requiredActor);

    const matchingActors = getAllActorNames()
        .filter(function (actor) {
            const normalizedActor = normalizeText(actor);

            return (
                normalizedActor !== normalizedRequiredActor &&
                normalizedActor.includes(searchText) &&
                !usedCoStarNames.includes(normalizedActor)
            );
        })
        .sort(function (actorA, actorB) {
            const normalizedActorA = normalizeText(actorA);
            const normalizedActorB = normalizeText(actorB);
            const startsA = normalizedActorA.startsWith(searchText);
            const startsB = normalizedActorB.startsWith(searchText);

            if (startsA && !startsB) return -1;
            if (!startsA && startsB) return 1;

            return actorA.localeCompare(actorB, "nl", {
                sensitivity: "base"
            });
        })
        .slice(0, 10);

    if (matchingActors.length === 0) {
        movieSuggestions.classList.add("hidden");
        return;
    }

    matchingActors.forEach(function (actor) {
        const suggestion = document.createElement("div");

        suggestion.className = "movie-suggestion";
        suggestion.textContent = "🎭 " + actor;

        suggestion.addEventListener("mousedown", function (event) {
            event.preventDefault();

            answerInput.value = actor;
            selectedSuggestionKey =
                "actor:" + normalizeText(actor);
            movieSuggestions.innerHTML = "";
            movieSuggestions.classList.add("hidden");
            answerInput.focus();
        });

        movieSuggestions.appendChild(suggestion);
    });

    movieSuggestions.classList.remove("hidden");
}

/* =========================================
   ANTWOORD BEVESTIGEN
========================================= */

submitBtn.addEventListener(
    "click",
    submitAnswer
);

answerInput.addEventListener(
    "keydown",
    function (event) {
        if (event.key === "Enter") {
            submitAnswer();
        }

        if (event.key === "Escape") {
            closePopup();
        }
    }
);

function submitAnswer() {
    if (!selectedCell || gameOver) {
        return;
    }

    const answer = answerInput.value.trim();

    if (answer === "") {
        const selectedCategory =
            rows[Number(selectedCell.dataset.row)];

        alert(
            selectedCategory === PLAYED_TOGETHER_CATEGORY
                ? "Typ eerst de naam van een acteur."
                : "Typ eerst een film- of serietitel."
        );
        return;
    }

    const rowIndex = Number(selectedCell.dataset.row);
    const columnIndex = Number(selectedCell.dataset.column);

    const result = checkAnswer(answer, rowIndex, columnIndex);

    if (result.status === "not-found") {
        alert(
            rows[rowIndex] === PLAYED_TOGETHER_CATEGORY
                ? "❌ Deze acteur staat niet in de database."
                : "❌ Deze film of serie staat niet in de database."
        );
        closePopup();
        switchPlayer();
        return;
    }

    if (result.status === "wrong-combination") {
        alert(
            rows[rowIndex] === PLAYED_TOGETHER_CATEGORY
                ? "❌ " + columns[columnIndex] +
                  " heeft volgens de database niet samengespeeld met " +
                  answer + "."
                : "❌ Deze titel past niet bij " +
                  columns[columnIndex] +
                  " en " +
                  rows[rowIndex] +
                  "."
        );
        closePopup();
        switchPlayer();
        return;
    }

    if (result.status === "already-used") {
        alert(
            rows[rowIndex] === PLAYED_TOGETHER_CATEGORY
                ? "❌ Deze acteur is deze ronde al gebruikt."
                : "❌ Deze film of serie is deze ronde al gebruikt."
        );
        closePopup();
        switchPlayer();
        return;
    }

    placeMedia(result.item);
}

function checkAnswer(answer, rowIndex, columnIndex) {
    const category = rows[rowIndex];

    if (category === PLAYED_TOGETHER_CATEGORY) {
        return checkCoStar(answer, columnIndex);
    }

    return checkMedia(answer, rowIndex, columnIndex);
}

function checkCoStar(actorAnswer, columnIndex) {
    const normalizedAnswer = normalizeText(actorAnswer);
    const requiredActor = columns[columnIndex];

    const actorInDatabase = getAllActorNames().find(function (actor) {
        return normalizeText(actor) === normalizedAnswer;
    });

    if (!actorInDatabase) {
        return { status: "not-found" };
    }

    if (usedCoStarNames.includes(normalizedAnswer)) {
        return { status: "already-used" };
    }

    const sharedTitles = findSharedTitles(
        requiredActor,
        actorInDatabase
    );

    if (sharedTitles.length === 0) {
        return { status: "wrong-combination" };
    }

    return {
        status: "correct",
        item: {
            answer_type: "actor",
            name: actorInDatabase,
            title: actorInDatabase,
            game_key: "actor:" + normalizedAnswer,
            shared_titles: sharedTitles
        }
    };
}

function checkMedia(title, rowIndex, columnIndex) {
    const normalizedTitle = normalizeText(title);
    const requiredActor = normalizeText(columns[columnIndex]);
    const requiredGenre = normalizeText(rows[rowIndex]);

    let candidates = database.filter(function (item) {
        return normalizeText(item.title) === normalizedTitle;
    });

    if (selectedSuggestionKey) {
        candidates = candidates.sort(function (item) {
            return item.game_key === selectedSuggestionKey ? -1 : 1;
        });
    }

    if (candidates.length === 0) {
        return { status: "not-found" };
    }

    const unusedCandidates = candidates.filter(function (item) {
        return !usedMediaKeys.includes(item.game_key);
    });

    if (unusedCandidates.length === 0) {
        return { status: "already-used" };
    }

    const matchingItem = unusedCandidates.find(function (item) {
        const actorMatches = item.actors.some(function (actor) {
            return normalizeText(actor) === requiredActor;
        });

        const genreMatches = item.genre.some(function (genre) {
            return normalizeText(genre) === requiredGenre;
        });

        return actorMatches && genreMatches;
    });

    if (!matchingItem) {
        return { status: "wrong-combination" };
    }

    return {
        status: "correct",
        item: matchingItem
    };
}

function placeMedia(item) {
    if (item.answer_type === "actor") {
        usedCoStarNames.push(normalizeText(item.name));

        selectedCell.textContent = item.name;

        const sharedTitleNames = item.shared_titles
            .slice(0, 3)
            .map(function (sharedItem) {
                return sharedItem.title;
            });

        selectedCell.title =
            item.name +
            " speelde samen met " +
            columns[Number(selectedCell.dataset.column)] +
            (sharedTitleNames.length
                ? " in " + sharedTitleNames.join(", ")
                : "");
    } else {
        usedMediaKeys.push(item.game_key);

        selectedCell.textContent = item.title;
        selectedCell.title =
            (item.media_type === "tv" ? "Serie: " : "Film: ") +
            item.title +
            " (" +
            (item.year || "?") +
            ")";
    }

    if (currentPlayer === 1) {
        selectedCell.classList.add("blue");
    } else {
        selectedCell.classList.add("orange");
    }

    selectedCell.classList.remove("movie-placed");
    void selectedCell.offsetWidth;
    selectedCell.classList.add("movie-placed");

    updateGameHud();
    closePopup();

    const winner = checkWinner();

    if (winner) {
        finishGame(winner);
        return;
    }

    if (cells.every(isOccupiedCell)) {
        finishDraw();
        return;
    }

    switchPlayer();
}

/* =========================================
   PASSEN EN ANNULEREN
========================================= */

passBtn.addEventListener(
    "click",
    function () {
        if (!gameOver) {
            closePopup();
            switchPlayer();
        }
    }
);

cancelBtn.addEventListener(
    "click",
    closePopup
);

popup.addEventListener(
    "click",
    function (event) {
        if (event.target === popup) {
            closePopup();
        }
    }
);

function closePopup() {
    popup.classList.add("hidden");

    answerInput.value = "";

    movieSuggestions.innerHTML = "";
    movieSuggestions.classList.add("hidden");

    selectedCell = null;
    selectedSuggestionKey = null;
}


/* =========================================
   SPELERS EN EINDE SPEL
========================================= */

function switchPlayer() {
    currentPlayer =
        currentPlayer === 1 ? 2 : 1;

    updateTurnIndicatorColor();
    updateGameHud();
    animateTurnIndicator();
}

function updateTurnIndicatorColor() {
    if (!turnIndicator) {
        return;
    }

    turnIndicator.classList.toggle("blue-turn", currentPlayer === 1);
    turnIndicator.classList.toggle("orange-turn", currentPlayer === 2);
}

function animateTurnIndicator() {
    playerText.classList.remove("turn-change");
    void playerText.offsetWidth;
    playerText.classList.add("turn-change");
}

function checkWinner() {
    const winningCombinations = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],

        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],

        [0, 4, 8],
        [2, 4, 6]
    ];

    for (
        const combination
        of winningCombinations
    ) {
        const first =
            cells[combination[0]];

        const second =
            cells[combination[1]];

        const third =
            cells[combination[2]];

        if (
            first.classList.contains("blue") &&
            second.classList.contains("blue") &&
            third.classList.contains("blue")
        ) {
            return playerBlue;
        }

        if (
            first.classList.contains("orange") &&
            second.classList.contains("orange") &&
            third.classList.contains("orange")
        ) {
            return playerOrange;
        }
    }

    return null;
}

function finishGame(winner) {
    gameOver = true;

    winnerMessage.textContent =
        "🏆 " +
        winner +
        " heeft gewonnen!";

    winnerMessage.classList.remove("winner-reveal");
    void winnerMessage.offsetWidth;
    winnerMessage.classList.add("winner-reveal");

    if (winnerOverlayText) {
        winnerOverlayText.textContent =
            winner + " heeft gewonnen!";
    }

    if (winnerOverlay) {
        winnerOverlay.classList.remove("hidden");
        winnerOverlay.classList.remove("show");
        void winnerOverlay.offsetWidth;
        winnerOverlay.classList.add("show");
    }

    if (screenFrame) {
        screenFrame.classList.remove("game-won");
        void screenFrame.offsetWidth;
        screenFrame.classList.add("game-won");
    }

    document.body.classList.remove("victory-flash");
    void document.body.offsetWidth;
    document.body.classList.add("victory-flash");

    setTimeout(function () {
        document.body.classList.remove("victory-flash");
    }, 1800);

    newRoundBtn.classList.remove("hidden");
}

function finishDraw() {
    gameOver = true;

    winnerMessage.textContent =
        "🤝 Gelijkspel: het bord is vol.";

    winnerMessage.classList.remove("winner-reveal");
    void winnerMessage.offsetWidth;
    winnerMessage.classList.add("winner-reveal");

    if (winnerOverlay) {
        winnerOverlay.classList.add("hidden");
        winnerOverlay.classList.remove("show");
    }

    newRoundBtn.classList.remove("hidden");
}

function isOccupiedCell(cell) {
    return (
        cell.classList.contains("blue") ||
        cell.classList.contains("orange")
    );
}


/* =========================================
   DEVELOPER MODE
========================================= */

function toggleDeveloperMode() {
    const isHidden =
        developerPanel.classList.contains("hidden");

    if (isHidden) {
        developerPanel.classList.remove("hidden");
        developerToggleBtn.textContent =
            "✖ Developer Mode sluiten";
    } else {
        developerPanel.classList.add("hidden");
        developerToggleBtn.textContent =
            "🛠 Developer Mode";
    }
}

async function runGridTest() {
    if (!databaseLoaded) {
        alert("De database is nog niet geladen.");
        return;
    }

    const testAmount = 100;

    test100Btn.disabled = true;
    test100Btn.textContent = "Test wordt uitgevoerd...";

    developerReport.classList.add("hidden");
    developerReport.innerHTML = "";

    developerProgress.classList.remove("hidden");
    developerProgress.textContent =
        "0 van " + testAmount + " grids getest";

    const actorCounts = {};
    const genreCounts = {};

    let successfulBoards = 0;
    let failedBoards = 0;
    let invalidBoards = 0;
    let emptyCells = 0;
    let totalAnswers = 0;
    let lowestAnswerCount = Infinity;
    let highestAnswerCount = 0;

    const failedExamples = [];

    const startedAt = performance.now();

    for (let testIndex = 0; testIndex < testAmount; testIndex++) {
        const testGrid = findSmartGrid();

        if (!testGrid) {
            failedBoards++;

            if (failedExamples.length < 10) {
                failedExamples.push(
                    "Poging " +
                    (testIndex + 1) +
                    ": geen bord gevonden"
                );
            }
        } else {
            const validation = validateTestGrid(testGrid);

            if (!validation.valid) {
                invalidBoards++;
                emptyCells += validation.emptyCells;

                if (failedExamples.length < 10) {
                    failedExamples.push(
                        "Poging " +
                        (testIndex + 1) +
                        ": ongeldig bord"
                    );
                }
            } else {
                successfulBoards++;
            }

            totalAnswers += validation.totalAnswers;

            if (
                validation.lowestAnswerCount <
                lowestAnswerCount
            ) {
                lowestAnswerCount =
                    validation.lowestAnswerCount;
            }

            if (
                validation.highestAnswerCount >
                highestAnswerCount
            ) {
                highestAnswerCount =
                    validation.highestAnswerCount;
            }

            testGrid.actors.forEach(function (actor) {
                actorCounts[actor] =
                    (actorCounts[actor] || 0) + 1;
            });

            testGrid.genres.forEach(function (genre) {
                genreCounts[genre] =
                    (genreCounts[genre] || 0) + 1;
            });
        }

        const completed = testIndex + 1;

        developerProgress.textContent =
            completed +
            " van " +
            testAmount +
            " grids getest";

        /*
        Iedere tien tests krijgt de browser kort lucht.
        Daardoor blijft de pagina reageren.
        */
        if (completed % 10 === 0) {
            await waitForBrowser();
        }
    }

    const duration =
        Math.round(performance.now() - startedAt);

    if (lowestAnswerCount === Infinity) {
        lowestAnswerCount = 0;
    }

    const testedCells =
        (successfulBoards + invalidBoards) * 9;

    const averageAnswers =
        testedCells > 0
            ? totalAnswers / testedCells
            : 0;

    const report = {
        testAmount: testAmount,
        successfulBoards: successfulBoards,
        failedBoards: failedBoards,
        invalidBoards: invalidBoards,
        emptyCells: emptyCells,
        averageAnswers: averageAnswers,
        lowestAnswerCount: lowestAnswerCount,
        highestAnswerCount: highestAnswerCount,
        actorCounts: actorCounts,
        genreCounts: genreCounts,
        failedExamples: failedExamples,
        duration: duration
    };

    renderDeveloperReport(report);

    developerProgress.classList.add("hidden");

    test100Btn.disabled = false;
    test100Btn.textContent = "🧪 Test 100 grids";
}

function validateTestGrid(testGrid) {
    let valid = true;
    let emptyCells = 0;
    let totalAnswers = 0;
    let lowestAnswerCount = Infinity;
    let highestAnswerCount = 0;

    if (
        !Array.isArray(testGrid.actors) ||
        !Array.isArray(testGrid.genres) ||
        testGrid.actors.length !== 3 ||
        testGrid.genres.length !== 3
    ) {
        return {
            valid: false,
            emptyCells: 9,
            totalAnswers: 0,
            lowestAnswerCount: 0,
            highestAnswerCount: 0
        };
    }

    testGrid.genres.forEach(function (genre) {
        testGrid.actors.forEach(function (actor) {
            const answerCount =
                getMatchingAnswers(actor, genre).length;

            totalAnswers += answerCount;

            if (answerCount < lowestAnswerCount) {
                lowestAnswerCount = answerCount;
            }

            if (answerCount > highestAnswerCount) {
                highestAnswerCount = answerCount;
            }

            /*
            De gewone generator verlangt minimaal
            twee geldige titels per vakje.
            */
            if (answerCount < 2) {
                valid = false;
                emptyCells++;
            }
        });
    });

    return {
        valid: valid,
        emptyCells: emptyCells,
        totalAnswers: totalAnswers,
        lowestAnswerCount:
            lowestAnswerCount === Infinity
                ? 0
                : lowestAnswerCount,
        highestAnswerCount: highestAnswerCount
    };
}


function showDatabaseStatistics() {
    if (!databaseLoaded) {
        alert("De database is nog niet geladen.");
        return;
    }

    developerProgress.classList.add("hidden");
    developerReport.innerHTML = "";

    const actorCounts = {};
    const genreCounts = {};
    const directorCounts = {};

    let filmsWithoutDirector = 0;
    let filmsWithoutCharacters = 0;
    let totalActors = 0;
    let totalCharacters = 0;

    database.forEach(function (movie) {
        totalActors += movie.actors.length;

        movie.actors.forEach(function (actor) {
            actorCounts[actor] = (actorCounts[actor] || 0) + 1;
        });

        movie.genre.forEach(function (genre) {
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        });

        if (!Array.isArray(movie.director) || movie.director.length === 0) {
            filmsWithoutDirector++;
        } else {
            movie.director.forEach(function (director) {
                directorCounts[director] =
                    (directorCounts[director] || 0) + 1;
            });
        }

        if (!Array.isArray(movie.characters) || movie.characters.length === 0) {
            filmsWithoutCharacters++;
        } else {
            totalCharacters += movie.characters.length;
        }
    });

    const title = document.createElement("h4");
    title.textContent = "Database statistieken";
    developerReport.appendChild(title);

    const summary = document.createElement("div");
    summary.className = "developerSummary";

    summary.appendChild(createDeveloperStat("Alle titels", database.length, ""));
    summary.appendChild(
        createDeveloperStat(
            "Films",
            database.filter(function (item) { return item.media_type === "movie"; }).length,
            ""
        )
    );
    summary.appendChild(
        createDeveloperStat(
            "Series",
            database.filter(function (item) { return item.media_type === "tv"; }).length,
            ""
        )
    );
    summary.appendChild(
        createDeveloperStat(
            "Unieke acteurs",
            Object.keys(actorCounts).length,
            ""
        )
    );
    summary.appendChild(
        createDeveloperStat(
            "Unieke regisseurs",
            Object.keys(directorCounts).length,
            ""
        )
    );
    summary.appendChild(
        createDeveloperStat(
            "Genres in database",
            Object.keys(genreCounts).length,
            ""
        )
    );
    summary.appendChild(
        createDeveloperStat(
            "Gem. acteurs per titel",
            database.length
                ? (totalActors / database.length).toFixed(1)
                : "0",
            ""
        )
    );
    summary.appendChild(
        createDeveloperStat(
            "Gem. personages per titel",
            database.length
                ? (totalCharacters / database.length).toFixed(1)
                : "0",
            ""
        )
    );

    developerReport.appendChild(summary);

    appendRankingSection(
        developerReport,
        "Acteurs met de meeste titels",
        actorCounts,
        15
    );

    appendRankingSection(
        developerReport,
        "Meest voorkomende genres",
        genreCounts,
        15
    );

    appendRankingSection(
        developerReport,
        "Makers met de meeste titels",
        directorCounts,
        15
    );

    const qualitySection = document.createElement("div");
    qualitySection.className = "developerReportSection";

    const heading = document.createElement("h5");
    heading.textContent = "Datakwaliteit";

    const list = document.createElement("ul");
    list.className = "developerReportList";

    const directorItem = document.createElement("li");
    directorItem.textContent =
        "Films zonder regisseur: " + filmsWithoutDirector;

    const characterItem = document.createElement("li");
    characterItem.textContent =
        "Films zonder personages: " + filmsWithoutCharacters;

    list.appendChild(directorItem);
    list.appendChild(characterItem);

    qualitySection.appendChild(heading);
    qualitySection.appendChild(list);
    developerReport.appendChild(qualitySection);

    developerReport.classList.remove("hidden");
}

function showWeakCombinations() {
    if (!databaseLoaded) {
        alert("De database is nog niet geladen.");
        return;
    }

    developerProgress.classList.remove("hidden");
    developerProgress.textContent = "Combinaties analyseren...";
    developerReport.classList.add("hidden");
    developerReport.innerHTML = "";

    setTimeout(function () {
        const actors = getEligibleActors();
        const genres = getAllCategories();
        const combinations = [];

        actors.forEach(function (actor) {
            genres.forEach(function (genre) {
                const answerCount =
                    getMatchingAnswers(actor, genre).length;

                if (answerCount > 0) {
                    combinations.push({
                        actor: actor,
                        genre: genre,
                        answers: answerCount
                    });
                }
            });
        });

        combinations.sort(function (a, b) {
            if (a.answers !== b.answers) {
                return a.answers - b.answers;
            }

            return a.actor.localeCompare(b.actor);
        });

        const weak = combinations
            .filter(function (item) {
                return item.answers <= 3;
            })
            .slice(0, 40);

        const impossibleCount =
            actors.length * genres.length - combinations.length;

        const title = document.createElement("h4");
        title.textContent = "Zwakke combinaties";
        developerReport.appendChild(title);

        const summary = document.createElement("div");
        summary.className = "developerSummary";

        summary.appendChild(
            createDeveloperStat("Geschikte acteurs", actors.length, "")
        );
        summary.appendChild(
            createDeveloperStat("Actieve categorieën", genres.length, "")
        );
        summary.appendChild(
            createDeveloperStat(
                "Combinaties zonder antwoord",
                impossibleCount,
                impossibleCount === 0
                    ? "developerSuccess"
                    : "developerWarning"
            )
        );
        summary.appendChild(
            createDeveloperStat(
                "Combinaties met 1-3 antwoorden",
                combinations.filter(function (item) {
                    return item.answers <= 3;
                }).length,
                "developerWarning"
            )
        );

        developerReport.appendChild(summary);

        const section = document.createElement("div");
        section.className = "developerReportSection";

        const heading = document.createElement("h5");
        heading.textContent = "Moeilijkste geldige combinaties";

        const list = document.createElement("ol");
        list.className = "developerReportList";

        weak.forEach(function (item) {
            const li = document.createElement("li");

            li.textContent =
                item.actor +
                " × " +
                item.genre +
                " — " +
                item.answers +
                (item.answers === 1 ? " antwoord" : " antwoorden");

            list.appendChild(li);
        });

        if (weak.length === 0) {
            const li = document.createElement("li");
            li.textContent = "Geen zwakke combinaties gevonden.";
            list.appendChild(li);
        }

        section.appendChild(heading);
        section.appendChild(list);
        developerReport.appendChild(section);

        const conclusion = document.createElement("div");
        conclusion.className = "developerConclusion";
        conclusion.textContent =
            "De bordgenerator gebruikt alleen vakjes met minimaal 2 geldige antwoorden.";


        developerReport.appendChild(conclusion);

        developerProgress.classList.add("hidden");
        developerReport.classList.remove("hidden");
    }, 0);
}

function renderDeveloperReport(report) {
    developerReport.innerHTML = "";

    const title = document.createElement("h4");
    title.textContent = "CineGrid testrapport";

    developerReport.appendChild(title);

    const summary = document.createElement("div");
    summary.className = "developerSummary";

    summary.appendChild(
        createDeveloperStat(
            "Geslaagde grids",
            report.successfulBoards +
            " / " +
            report.testAmount,
            report.successfulBoards === report.testAmount
                ? "developerSuccess"
                : "developerWarning"
        )
    );

    summary.appendChild(
        createDeveloperStat(
            "Mislukte grids",
            report.failedBoards,
            report.failedBoards === 0
                ? "developerSuccess"
                : "developerError"
        )
    );

    summary.appendChild(
        createDeveloperStat(
            "Ongeldige grids",
            report.invalidBoards,
            report.invalidBoards === 0
                ? "developerSuccess"
                : "developerError"
        )
    );

    summary.appendChild(
        createDeveloperStat(
            "Vakjes onder minimum",
            report.emptyCells,
            report.emptyCells === 0
                ? "developerSuccess"
                : "developerError"
        )
    );

    summary.appendChild(
        createDeveloperStat(
            "Gemiddeld antwoorden",
            report.averageAnswers.toFixed(1),
            ""
        )
    );

    summary.appendChild(
        createDeveloperStat(
            "Laagste / hoogste",
            report.lowestAnswerCount +
            " / " +
            report.highestAnswerCount,
            ""
        )
    );

    developerReport.appendChild(summary);

    appendRankingSection(
        developerReport,
        "Meest gekozen acteurs",
        report.actorCounts,
        10
    );

    appendRankingSection(
        developerReport,
        "Meest gekozen categorieën",
        report.genreCounts,
        10
    );

    if (report.failedExamples.length > 0) {
        const failedSection =
            document.createElement("div");

        failedSection.className =
            "developerReportSection";

        const heading =
            document.createElement("h5");

        heading.textContent =
            "Voorbeelden van problemen";

        failedSection.appendChild(heading);

        const list = document.createElement("ul");
        list.className = "developerReportList";

        report.failedExamples.forEach(function (example) {
            const item = document.createElement("li");
            item.textContent = example;
            list.appendChild(item);
        });

        failedSection.appendChild(list);
        developerReport.appendChild(failedSection);
    }

    const duration = document.createElement("div");
    duration.className = "developerConclusion";

    const allPassed =
        report.successfulBoards === report.testAmount &&
        report.failedBoards === 0 &&
        report.invalidBoards === 0 &&
        report.emptyCells === 0;

    if (allPassed) {
        duration.classList.add("developerSuccess");

        duration.textContent =
            "✅ Alle 100 grids zijn speelbaar. " +
            "Testduur: " +
            report.duration +
            " ms.";
    } else {
        duration.classList.add("developerWarning");

        duration.textContent =
            "⚠️ Er zijn problemen gevonden. " +
            "Testduur: " +
            report.duration +
            " ms.";
    }

    developerReport.appendChild(duration);
    developerReport.classList.remove("hidden");
}

function createDeveloperStat(label, value, className) {
    const stat = document.createElement("div");
    stat.className = "developerStat";

    const text = document.createElement("span");
    text.textContent = label;

    const strong = document.createElement("strong");
    strong.textContent = value;

    if (className) {
        strong.classList.add(className);
    }

    stat.appendChild(text);
    stat.appendChild(strong);

    return stat;
}

function appendRankingSection(
    parent,
    title,
    counts,
    maximumItems
) {
    const section = document.createElement("div");
    section.className = "developerReportSection";

    const heading = document.createElement("h5");
    heading.textContent = title;

    section.appendChild(heading);

    const ranking = Object.entries(counts)
        .sort(function (first, second) {
            return second[1] - first[1];
        })
        .slice(0, maximumItems);

    const list = document.createElement("ol");
    list.className = "developerReportList";

    ranking.forEach(function (entry) {
        const item = document.createElement("li");

        item.textContent =
            entry[0] +
            " — " +
            entry[1] +
            " keer";

        list.appendChild(item);
    });

    if (ranking.length === 0) {
        const item = document.createElement("li");
        item.textContent = "Geen gegevens beschikbaar.";
        list.appendChild(item);
    }

    section.appendChild(list);
    parent.appendChild(section);
}

function waitForBrowser() {
    return new Promise(function (resolve) {
        setTimeout(resolve, 0);
    });
}


/* =========================================
   ACTEURSPORTRETTEN
========================================= */

function createActorHeader(actor) {
    const header = document.createElement("div");
    header.className = "header actor-header";
    header.title = actor;
    header.setAttribute(
        "aria-label",
        "Acteur: " + actor
    );

    const portrait = document.createElement("img");
    portrait.className = "actor-portrait";
    portrait.alt = "Portret van " + actor;
    portrait.loading = "eager";
    portrait.decoding = "async";

    const imageCandidates = getActorImageCandidates(actor);
    let currentImageIndex = 0;

    portrait.src = imageCandidates[currentImageIndex];

    portrait.addEventListener("load", function () {
        header.classList.add("actor-header-has-photo");
    });

    portrait.addEventListener("error", function handleImageError() {
        currentImageIndex++;

        if (currentImageIndex < imageCandidates.length) {
            portrait.src = imageCandidates[currentImageIndex];
            return;
        }

        portrait.removeEventListener("error", handleImageError);
        portrait.src = ACTOR_PLACEHOLDER_IMAGE;

        portrait.addEventListener(
            "error",
            function () {
                portrait.style.display = "none";
                header.classList.remove("actor-header-has-photo");
                header.classList.add("actor-header-no-photo");
            },
            {
                once: true
            }
        );
    });

    const actorNamePlate = document.createElement("div");
    actorNamePlate.className = "actor-name-plate";

    const actorName = document.createElement("span");
    actorName.className = "actor-name";
    actorName.textContent = actor.toUpperCase();

    actorNamePlate.appendChild(actorName);

    header.appendChild(portrait);
    header.appendChild(actorNamePlate);

    return header;
}

function getActorImageCandidates(actor) {
    const baseName = createActorImageBaseName(actor);

    return [
        ACTOR_IMAGE_FOLDER + baseName + ".jpg",
        ACTOR_IMAGE_FOLDER + baseName + ".jpeg",
        ACTOR_IMAGE_FOLDER + baseName + ".png"
    ];
}

function createActorImageBaseName(actor) {
    return String(actor || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/['’`]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .replace(/_+/g, "_");
}


/* =========================================
   FASE 5.3.1 — SAMENSPEEL-ENGINE
========================================= */

/**
 * Zoekt alle films en series waarin twee acteurs samen voorkomen.
 *
 * @param {string} actorA - Naam van de eerste acteur.
 * @param {string} actorB - Naam van de tweede acteur.
 * @returns {Array<object>} Alle gedeelde films en series.
 */
function findSharedTitles(actorA, actorB) {
    const normalizedActorA = normalizeText(actorA);
    const normalizedActorB = normalizeText(actorB);

    if (
        normalizedActorA === "" ||
        normalizedActorB === "" ||
        normalizedActorA === normalizedActorB
    ) {
        return [];
    }

    return database.filter(function (item) {
        if (!Array.isArray(item.actors)) {
            return false;
        }

        let actorAFound = false;
        let actorBFound = false;

        item.actors.forEach(function (actor) {
            const normalizedActor = normalizeText(actor);

            if (normalizedActor === normalizedActorA) {
                actorAFound = true;
            }

            if (normalizedActor === normalizedActorB) {
                actorBFound = true;
            }
        });

        return actorAFound && actorBFound;
    });
}

/**
 * Geeft true terug wanneer twee acteurs minimaal één film
 * of serie samen hebben.
 *
 * @param {string} actorA - Naam van de eerste acteur.
 * @param {string} actorB - Naam van de tweede acteur.
 * @returns {boolean}
 */
function playedTogether(actorA, actorB) {
    return findSharedTitles(actorA, actorB).length > 0;
}

/**
 * Handige compacte versie voor meldingen en toekomstige
 * antwoordcontrole.
 *
 * Voorbeeld:
 * getSharedTitleNames("Robert De Niro", "Al Pacino")
 * → ["Heat", "The Irishman"]
 *
 * @param {string} actorA
 * @param {string} actorB
 * @returns {Array<string>}
 */
function getSharedTitleNames(actorA, actorB) {
    return findSharedTitles(actorA, actorB).map(function (item) {
        return item.title;
    });
}


/* =========================================
   HULPFUNCTIES
========================================= */

function normalizeText(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        );
}